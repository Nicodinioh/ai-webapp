import fs from 'node:fs'
import path from 'node:path'
import { EXTRACT_DIR } from '../db.js'

export interface Extraction {
  text: string
  pages: number
  chars: number
  textPath: string
}

/**
 * Extrahiert den Volltext seitenweise. Die Seitenmarken sind wichtig: nur mit
 * ihnen kann ein Agent eine Fundstelle angeben, statt eine Seitenzahl zu raten.
 */
export async function extractPdf(absPdfPath: string, key: string): Promise<Extraction> {
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(fs.readFileSync(absPdfPath))
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise

  const chunks: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    let last: number | null = null
    let line = ''
    const lines: string[] = []
    for (const item of content.items as any[]) {
      if (typeof item.str !== 'string') continue
      const y = Math.round(item.transform?.[5] ?? 0)
      if (last !== null && Math.abs(y - last) > 2) {
        lines.push(line.trim())
        line = ''
      }
      line += item.str
      if (item.hasEOL) {
        lines.push(line.trim())
        line = ''
      }
      last = y
    }
    if (line.trim()) lines.push(line.trim())
    chunks.push(`\n[[S. ${p}]]\n` + lines.filter(Boolean).join('\n'))
    page.cleanup()
  }
  await doc.destroy()

  const text = chunks.join('\n').replace(/\n{4,}/g, '\n\n\n')
  const textPath = path.join(EXTRACT_DIR, `${key}.txt`)
  fs.writeFileSync(textPath, text, 'utf8')
  return { text, pages: doc.numPages, chars: text.length, textPath }
}

export function readExtract(textPath: string | null): string {
  if (!textPath) return ''
  const abs = path.isAbsolute(textPath) ? textPath : path.join(EXTRACT_DIR, textPath)
  try {
    return fs.readFileSync(abs, 'utf8')
  } catch {
    return ''
  }
}

/**
 * Kuerzt den Volltext auf ein Budget, ohne stillschweigend hinten abzuschneiden:
 * Anfang und Ende bleiben erhalten, die Auslassung wird sichtbar markiert, damit
 * der Agent weiss, dass ihm etwas fehlt.
 */
export function fitToBudget(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false }
  const head = Math.floor(maxChars * 0.62)
  const tail = maxChars - head
  const marker =
    `\n\n[[ ${(text.length - maxChars).toLocaleString('de-DE')} Zeichen aus der Mitte des Dokuments ` +
    `sind hier ausgelassen. Aussagen ueber diesen Bereich sind nicht gedeckt. ]]\n\n`
  return { text: text.slice(0, head) + marker + text.slice(text.length - tail), truncated: true }
}
