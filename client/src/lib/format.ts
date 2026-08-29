export function minutes(n: number): string {
  if (!n) return '0 min'
  if (n < 60) return `${Math.round(n)} min`
  const h = Math.floor(n / 60)
  const m = Math.round(n % 60)
  return m ? `${h} h ${m} min` : `${h} h`
}

export function scoreClass(v: number | null | undefined): string {
  if (v == null) return ''
  if (v >= 75) return 'hi'
  if (v >= 50) return 'mid'
  return 'lo'
}

export const STATUS_TONE: Record<string, string> = {
  eingang: '', triage: 'violet', lesen: 'teal', verinnerlicht: 'green', zitiert: 'amber', verworfen: 'rose',
  offen: '', laeuft: 'amber', erledigt: 'green', entwurf: 'teal', ueberarbeitung: 'violet', fertig: 'green',
}

export const EVIDENCE_LABEL: Record<string, string> = {
  peer_review: 'Peer Review',
  institutionell: 'Institutionell',
  praxis: 'Praxis',
  presse: 'Presse',
  unbekannt: 'Ungeprueft',
}

export const ROLE_LABEL: Record<string, string> = {
  kern: 'Kern', beleg: 'Beleg', kontrast: 'Kontrast', kontext: 'Kontext', methode: 'Methode',
}

export const KIND_LABEL: Record<string, string> = {
  lesen: 'Lesen', schreiben: 'Schreiben', recherche: 'Recherche',
  pruefung: 'Pruefung', formatierung: 'Formalia',
}

export function relDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: '2-digit' })
}
