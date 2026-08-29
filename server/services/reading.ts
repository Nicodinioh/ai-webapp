import { db } from '../db.js'
import { STAGES } from '../agents/tasks.js'

/** Gewichtung der Stufen. Rekonstruktion und Wuerdigung tragen zusammen 55 %. */
export const STAGE_WEIGHTS: Record<number, number> = { 0: 0, 1: 10, 2: 25, 3: 30, 4: 25, 5: 10 }

export function sessionFor(sourceId: number): { id: number; stage: number; status: string } {
  const existing = db
    .prepare("SELECT id, stage, status FROM reading_sessions WHERE source_id = ? ORDER BY id DESC LIMIT 1")
    .get(sourceId) as { id: number; stage: number; status: string } | undefined
  if (existing) return existing
  const info = db.prepare('INSERT INTO reading_sessions (source_id) VALUES (?)').run(sourceId)
  db.prepare("UPDATE sources SET status = 'lesen' WHERE id = ? AND status IN ('eingang','triage')").run(sourceId)
  return { id: Number(info.lastInsertRowid), stage: 0, status: 'laufend' }
}

/** Verinnerlichungsgrad: gewichteter Mittelwert der bewerteten Stufen. */
export function recomputeInternalization(sourceId: number): number {
  const rows = db
    .prepare(
      `SELECT st.stage, AVG(st.score) AS avg_score
       FROM reading_steps st JOIN reading_sessions rs ON rs.id = st.session_id
       WHERE rs.source_id = ? AND st.score IS NOT NULL GROUP BY st.stage`,
    )
    .all(sourceId) as { stage: number; avg_score: number }[]

  let weighted = 0
  let total = 0
  for (const w of Object.entries(STAGE_WEIGHTS)) {
    const stage = Number(w[0])
    const weight = w[1]
    if (!weight) continue
    total += weight
    const row = rows.find((r) => r.stage === stage)
    if (row) weighted += weight * (row.avg_score / 100)
  }
  const value = total ? Math.round((weighted / total) * 100) : 0
  db.prepare('UPDATE sources SET internalization = ? WHERE id = ?').run(value, sourceId)
  if (value >= 75) {
    db.prepare("UPDATE sources SET status = 'verinnerlicht' WHERE id = ? AND status = 'lesen'").run(sourceId)
  }
  return value
}

export function stageHistory(sessionId: number): string {
  const steps = db
    .prepare('SELECT stage, prompt, answer, score FROM reading_steps WHERE session_id = ? ORDER BY id')
    .all(sessionId) as { stage: number; prompt: string; answer: string | null; score: number | null }[]
  return steps
    .filter((s) => s.answer)
    .map(
      (s) =>
        `[Stufe ${s.stage} - ${STAGES[s.stage]?.name}] Frage: ${s.prompt}\nAntwort: ${s.answer}\nBewertung: ${s.score ?? '-'}`,
    )
    .join('\n\n')
    .slice(-12000)
}

export function stageComplete(sessionId: number, stage: number): boolean {
  const rows = db
    .prepare('SELECT score FROM reading_steps WHERE session_id = ? AND stage = ?')
    .all(sessionId, stage) as { score: number | null }[]
  if (!rows.length) return false
  return rows.every((r) => r.score !== null)
}
