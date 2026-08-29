import { Router } from 'express'
import multer from 'multer'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { db, projectId, UPLOAD_DIR } from '../db.js'
import { extractPdf } from '../services/pdf.js'
import { analyzeSource, critiqueSource, placeSource, triageSource, guardExcerpt } from '../agents/tasks.js'

export const sources = Router()

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const key = crypto.randomBytes(8).toString('hex')
      cb(null, `${key}${path.extname(file.originalname) || '.pdf'}`)
    },
  }),
  limits: { fileSize: 80 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf'))
  },
})

function hydrate(row: any) {
  if (!row) return row
  row.tags = db
    .prepare('SELECT t.id, t.name, t.kind, t.color FROM source_tags st JOIN tags t ON t.id = st.tag_id WHERE st.source_id = ?')
    .all(row.id)
  row.chapters = db
    .prepare(
      `SELECT c.id, c.number, c.title, sc.role, sc.relevance, sc.rationale
       FROM source_chapters sc JOIN chapters c ON c.id = sc.chapter_id WHERE sc.source_id = ? ORDER BY c.sort`,
    )
    .all(row.id)
  row.excerpts = db.prepare('SELECT * FROM excerpts WHERE source_id = ? ORDER BY id').all(row.id)
  row.hasFullText = Boolean(row.text_path)
  delete row.text_path
  return row
}

sources.get('/sources', (req, res) => {
  const where = ['s.project_id = ?']
  const args: unknown[] = [projectId()]
  if (req.query.status) {
    where.push('s.status = ?')
    args.push(req.query.status)
  }
  if (req.query.chapter_id) {
    where.push('EXISTS (SELECT 1 FROM source_chapters sc WHERE sc.source_id = s.id AND sc.chapter_id = ?)')
    args.push(req.query.chapter_id)
  }
  if (req.query.tag) {
    where.push('EXISTS (SELECT 1 FROM source_tags st JOIN tags t ON t.id = st.tag_id WHERE st.source_id = s.id AND t.name = ?)')
    args.push(req.query.tag)
  }
  if (req.query.q) {
    where.push('(s.title LIKE ? OR s.authors LIKE ? OR s.core_claim LIKE ?)')
    const like = `%${req.query.q}%`
    args.push(like, like, like)
  }
  const rows = db
    .prepare(`SELECT * FROM sources s WHERE ${where.join(' AND ')} ORDER BY s.added_at DESC`)
    .all(...args) as any[]
  res.json(rows.map(hydrate))
})

sources.get('/sources/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM sources WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Quelle nicht gefunden' })
  res.json(hydrate(row))
})

sources.post('/sources', upload.single('file'), async (req, res) => {
  const body = req.body as Record<string, string>
  const file = req.file
  if (!file && !body.title) {
    return res.status(400).json({ error: 'Entweder eine PDF-Datei oder mindestens ein Titel wird benoetigt.' })
  }

  const title = body.title?.trim() || file?.originalname.replace(/\.pdf$/i, '') || 'Ohne Titel'
  const info = db
    .prepare(
      `INSERT INTO sources (project_id, title, authors, year, venue, url, doi, kind, evidence, abstract, notes, file_path)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      projectId(),
      title,
      body.authors || null,
      body.year ? Number(body.year) : null,
      body.venue || null,
      body.url || null,
      body.doi || null,
      body.kind || 'artikel',
      body.evidence || 'unbekannt',
      body.abstract || null,
      body.notes || null,
      file ? path.basename(file.path) : null,
    )
  const id = Number(info.lastInsertRowid)

  if (file) {
    try {
      const key = path.basename(file.path, path.extname(file.path))
      const ex = await extractPdf(file.path, key)
      db.prepare('UPDATE sources SET text_path = ?, page_count = ?, char_count = ? WHERE id = ?').run(
        ex.textPath,
        ex.pages,
        ex.chars,
        id,
      )
    } catch (err) {
      db.prepare('UPDATE sources SET notes = COALESCE(notes || char(10), "") || ? WHERE id = ?').run(
        `[Textextraktion fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}. Vermutlich ein Scan ohne Textebene - die Agenten koennen den Inhalt nicht lesen.]`,
        id,
      )
    }
  }
  res.json(hydrate(db.prepare('SELECT * FROM sources WHERE id = ?').get(id)))
})

sources.patch('/sources/:id', (req, res) => {
  const allowed = ['citekey', 'title', 'authors', 'year', 'venue', 'url', 'doi', 'kind', 'evidence', 'status', 'core_claim', 'abstract', 'notes']
  const set = allowed.filter((f) => f in req.body)
  if (set.length) {
    db.prepare(`UPDATE sources SET ${set.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`).run(
      ...set.map((f) => req.body[f]),
      req.params.id,
    )
  }
  res.json(hydrate(db.prepare('SELECT * FROM sources WHERE id = ?').get(req.params.id)))
})

sources.delete('/sources/:id', (req, res) => {
  const row = db.prepare('SELECT file_path, text_path FROM sources WHERE id = ?').get(req.params.id) as any
  db.prepare('DELETE FROM sources WHERE id = ?').run(req.params.id)
  if (row?.file_path) fs.rmSync(path.join(UPLOAD_DIR, row.file_path), { force: true })
  if (row?.text_path) fs.rmSync(row.text_path, { force: true })
  res.json({ ok: true })
})

sources.get('/sources/:id/pdf', (req, res) => {
  const row = db.prepare('SELECT file_path, title FROM sources WHERE id = ?').get(req.params.id) as any
  if (!row?.file_path) return res.status(404).json({ error: 'Keine Datei hinterlegt' })
  res.type('application/pdf').sendFile(path.join(UPLOAD_DIR, row.file_path))
})

/* -------------------------------------------------------- Verschlagwortung */

function tagId(name: string, kind: string): number {
  const found = db.prepare('SELECT id FROM tags WHERE name = ?').get(name) as { id: number } | undefined
  if (found) return found.id
  const info = db.prepare('INSERT INTO tags (name, kind) VALUES (?,?)').run(name, kind)
  return Number(info.lastInsertRowid)
}

sources.get('/tags', (_req, res) => {
  res.json(
    db
      .prepare(
        `SELECT t.*, (SELECT COUNT(*) FROM source_tags st WHERE st.tag_id = t.id) AS uses
         FROM tags t ORDER BY uses DESC, t.name`,
      )
      .all(),
  )
})

sources.post('/sources/:id/tags', (req, res) => {
  const id = Number(req.params.id)
  const list = (req.body.tags ?? []) as { name: string; art?: string }[]
  const link = db.prepare('INSERT OR IGNORE INTO source_tags (source_id, tag_id) VALUES (?,?)')
  for (const t of list) if (t.name?.trim()) link.run(id, tagId(t.name.trim(), t.art ?? 'thema'))
  res.json(hydrate(db.prepare('SELECT * FROM sources WHERE id = ?').get(id)))
})

sources.delete('/sources/:id/tags/:tagId', (req, res) => {
  db.prepare('DELETE FROM source_tags WHERE source_id = ? AND tag_id = ?').run(req.params.id, req.params.tagId)
  res.json({ ok: true })
})

/* ---------------------------------------------------- Kapitelzuordnung */

sources.post('/sources/:id/chapters', (req, res) => {
  const id = Number(req.params.id)
  const list = (req.body.chapters ?? []) as { chapter_id: number; role?: string; relevance?: number; rationale?: string }[]
  const stmt = db.prepare(
    `INSERT INTO source_chapters (source_id, chapter_id, role, relevance, rationale) VALUES (?,?,?,?,?)
     ON CONFLICT(source_id, chapter_id) DO UPDATE SET role = excluded.role, relevance = excluded.relevance, rationale = excluded.rationale`,
  )
  for (const c of list) stmt.run(id, c.chapter_id, c.role ?? 'beleg', c.relevance ?? 3, c.rationale ?? null)
  res.json(hydrate(db.prepare('SELECT * FROM sources WHERE id = ?').get(id)))
})

sources.delete('/sources/:id/chapters/:chapterId', (req, res) => {
  db.prepare('DELETE FROM source_chapters WHERE source_id = ? AND chapter_id = ?').run(req.params.id, req.params.chapterId)
  res.json({ ok: true })
})

/* ------------------------------------------------------------ Belegstellen */

sources.post('/sources/:id/excerpts', (req, res) => {
  const { chapter_id, page, quote, paraphrase, kind } = req.body
  const info = db
    .prepare('INSERT INTO excerpts (source_id, chapter_id, page, quote, paraphrase, kind) VALUES (?,?,?,?,?,?)')
    .run(req.params.id, chapter_id ?? null, page ?? null, quote ?? null, paraphrase ?? null, kind ?? 'paraphrase')
  res.json(db.prepare('SELECT * FROM excerpts WHERE id = ?').get(info.lastInsertRowid))
})

sources.patch('/excerpts/:id', (req, res) => {
  const allowed = ['chapter_id', 'page', 'quote', 'paraphrase', 'kind', 'verified']
  const set = allowed.filter((f) => f in req.body)
  if (set.length) {
    db.prepare(`UPDATE excerpts SET ${set.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`).run(
      ...set.map((f) => req.body[f]),
      req.params.id,
    )
  }
  res.json(db.prepare('SELECT * FROM excerpts WHERE id = ?').get(req.params.id))
})

sources.delete('/excerpts/:id', (req, res) => {
  db.prepare('DELETE FROM excerpts WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

sources.post('/excerpts/:id/check', async (req, res) => {
  const result = await guardExcerpt(Number(req.params.id))
  res.json({ runId: result.runId, offline: result.offline, error: result.error, check: result.data })
})

/* -------------------------------------------------------------- Agenten */

sources.post('/sources/:id/agent/:agentId', async (req, res) => {
  const id = Number(req.params.id)
  const map: Record<string, (n: number) => Promise<any>> = {
    triage: triageSource,
    analyst: analyzeSource,
    critic: critiqueSource,
    architect: placeSource,
  }
  const fn = map[req.params.agentId]
  if (!fn) return res.status(400).json({ error: `Agent ${req.params.agentId} arbeitet nicht auf Quellen.` })

  const result = await fn(id)
  res.json({ runId: result.runId, offline: result.offline, error: result.error, result: result.data, text: result.text })
})

/** Uebernahme eines Triage-Ergebnisses - erst hier wird aus einem Vorschlag Datenbestand. */
sources.post('/sources/:id/agent/triage/accept', (req, res) => {
  const id = Number(req.params.id)
  const d = req.body.result ?? {}
  const fields: Record<string, unknown> = {}
  if (d.titel) fields.title = d.titel
  if (d.urheber) fields.authors = d.urheber
  if (d.jahr && /^\d{4}$/.test(String(d.jahr))) fields.year = Number(d.jahr)
  if (d.erscheinungsort) fields.venue = d.erscheinungsort
  if (d.typ) fields.kind = d.typ
  if (d.evidenzstufe) fields.evidenzstufe = d.evidenzstufe
  if (d.kernthese) fields.core_claim = d.kernthese
  const set = Object.keys(fields).map((k) => (k === 'evidenzstufe' ? 'evidence' : k))
  if (set.length) {
    db.prepare(`UPDATE sources SET ${set.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`).run(
      ...Object.values(fields),
      id,
    )
  }
  db.prepare("UPDATE sources SET status = ? WHERE id = ?").run(
    d.votum === 'verwerfen' ? 'verworfen' : 'triage',
    id,
  )

  const linkTag = db.prepare('INSERT OR IGNORE INTO source_tags (source_id, tag_id) VALUES (?,?)')
  for (const t of d.schlagworte ?? []) if (t?.name) linkTag.run(id, tagId(t.name, t.art ?? 'thema'))

  const chapterByNumber = db.prepare('SELECT id FROM chapters WHERE number = ? AND project_id = ?')
  const linkChapter = db.prepare(
    `INSERT INTO source_chapters (source_id, chapter_id, role, relevance, rationale) VALUES (?,?,?,?,?)
     ON CONFLICT(source_id, chapter_id) DO UPDATE SET role = excluded.role, relevance = excluded.relevance`,
  )
  for (const c of d.kapitel ?? []) {
    const row = chapterByNumber.get(String(c.nummer), projectId()) as { id: number } | undefined
    if (row) linkChapter.run(id, row.id, c.rolle ?? 'beleg', Math.round(c.relevanz ?? 3), c.begruendung ?? null)
  }

  if (req.body.runId) {
    db.prepare("UPDATE agent_runs SET verdict = 'uebernommen', verdict_at = datetime('now') WHERE id = ?").run(req.body.runId)
  }
  res.json(hydrate(db.prepare('SELECT * FROM sources WHERE id = ?').get(id)))
})

sources.post('/sources/:id/agent/architect/accept', (req, res) => {
  const id = Number(req.params.id)
  const list = (req.body.zuordnungen ?? []) as { kapitel_nummer: string; rolle: string; relevanz: number; begruendung: string }[]
  const byNumber = db.prepare('SELECT id FROM chapters WHERE number = ? AND project_id = ?')
  const link = db.prepare(
    `INSERT INTO source_chapters (source_id, chapter_id, role, relevance, rationale) VALUES (?,?,?,?,?)
     ON CONFLICT(source_id, chapter_id) DO UPDATE SET role = excluded.role, relevance = excluded.relevance, rationale = excluded.rationale`,
  )
  let n = 0
  for (const z of list) {
    const row = byNumber.get(String(z.kapitel_nummer), projectId()) as { id: number } | undefined
    if (row) {
      link.run(id, row.id, z.rolle ?? 'beleg', Math.round(z.relevanz ?? 3), z.begruendung ?? null)
      n++
    }
  }
  if (req.body.runId) {
    db.prepare("UPDATE agent_runs SET verdict = 'uebernommen', verdict_at = datetime('now'), verdict_note = ? WHERE id = ?").run(
      `${n} Zuordnungen uebernommen`,
      req.body.runId,
    )
  }
  res.json(hydrate(db.prepare('SELECT * FROM sources WHERE id = ?').get(id)))
})
