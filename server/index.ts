import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { core } from './routes/core.js'
import { sources } from './routes/sources.js'
import { reading } from './routes/reading.js'
import { misc } from './routes/misc.js'
import { hasApiKey, MODEL } from './claude.js'
import { projectId } from './db.js'

const app = express()
app.use(express.json({ limit: '4mb' }))

projectId() // legt das Projekt an, falls die Datenbank neu ist

app.use('/api', core, sources, reading, misc)

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err?.status && Number.isInteger(err.status) ? err.status : 500
  console.error('[kompass]', err)
  res.status(status).json({ error: err?.message ?? 'Unerwarteter Serverfehler' })
})

const dist = path.resolve(process.cwd(), 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

const port = Number(process.env.PORT) || 5177

/**
 * Standardmaessig nur lokal erreichbar. Die Anwendung hat keine eigene
 * Anmeldung - im Netz gehoert ein Reverse Proxy davor, der die Zugangskontrolle
 * uebernimmt (siehe docs/betrieb.md). Wer bewusst direkt exponieren will, setzt
 * HOST=0.0.0.0.
 */
const host = process.env.HOST || '127.0.0.1'

app.listen(port, host, () => {
  console.log(`KOMPASS API auf http://${host}:${port}`)
  if (host === '0.0.0.0') {
    console.warn(
      'WARNUNG: Der Server ist ohne Zugangskontrolle im Netz erreichbar. ' +
        'Jeder, der die Adresse kennt, kann Quellen lesen, Dateien hochladen und ' +
        'Agentenlaeufe auf deine Kosten starten.',
    )
  }
  console.log(
    hasApiKey()
      ? `Agenten aktiv, Modell ${MODEL}`
      : 'Offline-Modus: ANTHROPIC_API_KEY fehlt. Erfassung, Kapitel, Aufgaben und Lesesaal funktionieren, die Agenten sind stumm.',
  )
})
