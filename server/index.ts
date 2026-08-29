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
app.listen(port, () => {
  console.log(`KOMPASS API auf http://localhost:${port}`)
  console.log(
    hasApiKey()
      ? `Agenten aktiv, Modell ${MODEL}`
      : 'Offline-Modus: ANTHROPIC_API_KEY fehlt. Erfassung, Kapitel, Aufgaben und Lesesaal funktionieren, die Agenten sind stumm.',
  )
})
