#!/usr/bin/env node
/**
 * Prueft, ob diese Maschine KOMPASS starten kann - und sagt beim ersten Problem,
 * was zu tun ist. Laeuft ohne Abhaengigkeiten, also auch vor `npm install`.
 *
 *   node scripts/doctor.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const c = {
  ok: (s) => `\x1b[32m✓\x1b[0m ${s}`,
  warn: (s) => `\x1b[33m!\x1b[0m ${s}`,
  bad: (s) => `\x1b[31m✗\x1b[0m ${s}`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`,
}

const problems = []
const hints = []

console.log(`\n${c.b('KOMPASS · Startprüfung')}\n`)

/* 1 — Node ------------------------------------------------------------- */
const major = Number(process.versions.node.split('.')[0])
if (major >= 20) {
  console.log(c.ok(`Node ${process.versions.node}`))
} else {
  console.log(c.bad(`Node ${process.versions.node} ist zu alt — nötig ist Node 20 oder neuer.`))
  problems.push('Node aktualisieren: https://nodejs.org (LTS-Version wählen)')
}

/* 2 — Abhängigkeiten --------------------------------------------------- */
const hasModules = fs.existsSync(path.join(root, 'node_modules'))
if (hasModules) {
  console.log(c.ok('Abhängigkeiten installiert'))
  try {
    const req = (await import('node:module')).createRequire(import.meta.url)
    req('better-sqlite3')
    console.log(c.ok('Datenbanktreiber lädt'))
  } catch {
    console.log(c.bad('better-sqlite3 lässt sich nicht laden.'))
    problems.push('Einmal neu installieren: rm -rf node_modules && npm install')
  }
} else {
  console.log(c.bad('node_modules fehlt'))
  problems.push('npm install')
}

/* 3 — API-Schlüssel ---------------------------------------------------- */
const envPath = path.join(root, '.env')
let key = process.env.ANTHROPIC_API_KEY ?? ''
if (fs.existsSync(envPath)) {
  const line = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
    .find((l) => l.trim().startsWith('ANTHROPIC_API_KEY='))
  if (line) key = line.split('=').slice(1).join('=').trim()
  console.log(c.ok('.env vorhanden'))
} else {
  console.log(c.warn('.env fehlt'))
  hints.push('cp .env.example .env   (Windows: copy .env.example .env)')
}
if (key && key.length > 20) {
  console.log(c.ok(`API-Schlüssel gesetzt ${c.dim('(' + key.slice(0, 10) + '…)')} — Agenten aktiv`))
} else {
  console.log(c.warn('Kein API-Schlüssel — die App läuft im Offline-Modus'))
  console.log(c.dim('    Erfassung, Kapitel, Aufgaben und der Lesesaal funktionieren.'))
  console.log(c.dim('    Die neun Agenten antworten mit einem Hinweis statt mit Inhalt.'))
  hints.push('Schlüssel holen: console.anthropic.com → API Keys → in .env eintragen')
}

/* 4 — Schreibrechte ---------------------------------------------------- */
try {
  fs.mkdirSync(path.join(root, 'data'), { recursive: true })
  const probe = path.join(root, 'data', '.probe')
  fs.writeFileSync(probe, 'x')
  fs.rmSync(probe)
  console.log(c.ok('data/ ist beschreibbar'))
} catch (err) {
  console.log(c.bad(`data/ nicht beschreibbar: ${err.message}`))
  problems.push('Schreibrechte im Projektordner prüfen')
}

/* 5 — Datenbestand ----------------------------------------------------- */
const dbPath = path.join(root, 'data', 'kompass.db')
if (fs.existsSync(dbPath)) {
  const kb = Math.round(fs.statSync(dbPath).size / 1024)
  console.log(c.ok(`Datenbank vorhanden ${c.dim(`(${kb} kB)`)}`))
} else {
  console.log(c.warn('Noch keine Datenbank — wird beim ersten Start angelegt'))
  hints.push('npm run seed   legt die Beispielarbeit mit Kapitelstruktur an')
}

/* 6 — Ports ------------------------------------------------------------ */
const free = (port) =>
  new Promise((res) => {
    const s = net.createServer()
    s.once('error', () => res(false))
    s.once('listening', () => s.close(() => res(true)))
    s.listen(port, '127.0.0.1')
  })

for (const [port, what] of [[5177, 'API'], [5173, 'Oberfläche']]) {
  if (await free(port)) console.log(c.ok(`Port ${port} frei (${what})`))
  else {
    console.log(c.warn(`Port ${port} ist belegt (${what})`))
    hints.push(
      port === 5177
        ? 'Anderen API-Port wählen: PORT=5200 npm run dev'
        : 'Belegtes Programm auf Port 5173 beenden, oder in vite.config.ts den Port ändern',
    )
  }
}

/* Fazit ---------------------------------------------------------------- */
console.log('')
if (problems.length) {
  console.log(c.b('Das muss zuerst behoben werden:'))
  problems.forEach((p) => console.log(`  → ${p}`))
  console.log('')
  process.exitCode = 1
} else {
  console.log(c.b('Startklar.  npm run dev  →  http://localhost:5173'))
}
if (hints.length) {
  console.log(`\n${c.dim('Hinweise:')}`)
  hints.forEach((h) => console.log(c.dim(`  · ${h}`)))
}
console.log('')
