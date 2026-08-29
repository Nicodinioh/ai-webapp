import { Router } from 'express'
import { db } from '../db.js'
import { STAGES, tutorEvaluate, tutorQuestions } from '../agents/tasks.js'
import { recomputeInternalization, sessionFor, stageComplete, stageHistory } from '../services/reading.js'

export const reading = Router()

reading.get('/reading/stages', (_req, res) => res.json(STAGES))

reading.get('/reading/:sourceId', (req, res) => {
  const sourceId = Number(req.params.sourceId)
  const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(sourceId) as any
  if (!source) return res.status(404).json({ error: 'Quelle nicht gefunden' })
  const session = sessionFor(sourceId)
  const steps = db
    .prepare('SELECT * FROM reading_steps WHERE session_id = ? ORDER BY stage, id')
    .all(session.id) as any[]
  const perStage = STAGES.map((s) => {
    const own = steps.filter((st) => st.stage === s.stage)
    const scored = own.filter((st) => st.score !== null)
    return {
      ...s,
      asked: own.length,
      answered: scored.length,
      score: scored.length ? Math.round(scored.reduce((n, st) => n + st.score, 0) / scored.length) : null,
      complete: own.length > 0 && scored.length === own.length,
    }
  })
  res.json({
    source: { id: source.id, title: source.title, authors: source.authors, year: source.year, hasFullText: Boolean(source.text_path), internalization: source.internalization },
    session,
    steps: steps.map((s) => ({ ...s, gaps: s.gaps ? JSON.parse(s.gaps) : [] })),
    perStage,
  })
})

/** Holt Leitfragen fuer eine Stufe. Fragen werden nur einmal erzeugt und dann gespeichert. */
reading.post('/reading/:sourceId/stage/:stage/questions', async (req, res) => {
  const sourceId = Number(req.params.sourceId)
  const stage = Number(req.params.stage)
  const session = sessionFor(sourceId)

  const existing = db
    .prepare('SELECT * FROM reading_steps WHERE session_id = ? AND stage = ? ORDER BY id')
    .all(session.id, stage) as any[]
  if (existing.length && !req.body.regenerate) {
    return res.json({ steps: existing, reused: true })
  }

  const result = await tutorQuestions(sourceId, stage, stageHistory(session.id))
  if (!result.data) {
    return res.status(result.offline ? 503 : 502).json({ error: result.error ?? 'Der Tutor hat keine verwertbaren Fragen geliefert.', runId: result.runId, offline: result.offline })
  }
  if (req.body.regenerate) {
    db.prepare('DELETE FROM reading_steps WHERE session_id = ? AND stage = ? AND answer IS NULL').run(session.id, stage)
  }
  const insert = db.prepare('INSERT INTO reading_steps (session_id, stage, prompt, hint) VALUES (?,?,?,?)')
  const created = result.data.fragen.map((f) => {
    const info = insert.run(session.id, stage, f.frage, f.hinweis)
    return db.prepare('SELECT * FROM reading_steps WHERE id = ?').get(info.lastInsertRowid)
  })
  db.prepare('UPDATE reading_sessions SET stage = MAX(stage, ?) WHERE id = ?').run(stage, session.id)
  res.json({ intro: result.data.einstieg, steps: created, runId: result.runId })
})

/** Antwort abgeben. Erst hier entsteht ein Verinnerlichungswert. */
reading.post('/reading/step/:stepId/answer', async (req, res) => {
  const stepId = Number(req.params.stepId)
  const step = db
    .prepare(
      `SELECT st.*, rs.source_id FROM reading_steps st JOIN reading_sessions rs ON rs.id = st.session_id WHERE st.id = ?`,
    )
    .get(stepId) as any
  if (!step) return res.status(404).json({ error: 'Schritt nicht gefunden' })

  const answer = String(req.body.answer ?? '').trim()
  if (!answer) return res.status(400).json({ error: 'Ohne Antwort gibt es keine Bewertung.' })

  db.prepare("UPDATE reading_steps SET answer = ?, answered_at = datetime('now') WHERE id = ?").run(answer, stepId)

  const result = await tutorEvaluate(step.source_id, step.stage, step.prompt, answer)
  if (!result.data) {
    return res.status(result.offline ? 503 : 502).json({
      error: result.error ?? 'Der Tutor hat keine verwertbare Bewertung geliefert. Die Antwort ist gespeichert.',
      runId: result.runId,
      offline: result.offline,
    })
  }
  const d = result.data
  db.prepare('UPDATE reading_steps SET feedback = ?, score = ?, gaps = ? WHERE id = ?').run(
    `${d.trifft_zu}\n\nOffen: ${d.fehlt}\n\nNaechster Schritt: ${d.naechster_schritt}`,
    Math.round(d.score),
    JSON.stringify(d.luecken ?? []),
    stepId,
  )
  db.prepare("UPDATE agent_runs SET verdict = 'uebernommen', verdict_at = datetime('now'), verdict_note = 'Bewertung im Lesesaal angenommen' WHERE id = ?").run(result.runId)

  const internalization = recomputeInternalization(step.source_id)
  const complete = stageComplete(step.session_id, step.stage)
  if (complete && step.stage >= 5) {
    db.prepare("UPDATE reading_sessions SET status = 'abgeschlossen', finished_at = datetime('now') WHERE id = ?").run(step.session_id)
  }
  res.json({
    step: db.prepare('SELECT * FROM reading_steps WHERE id = ?').get(stepId),
    internalization,
    stageComplete: complete,
    runId: result.runId,
  })
})

reading.post('/reading/:sourceId/minutes', (req, res) => {
  const session = sessionFor(Number(req.params.sourceId))
  db.prepare('UPDATE reading_sessions SET minutes = minutes + ? WHERE id = ?').run(
    Math.max(0, Math.round(Number(req.body.minutes) || 0)),
    session.id,
  )
  res.json(db.prepare('SELECT * FROM reading_sessions WHERE id = ?').get(session.id))
})
