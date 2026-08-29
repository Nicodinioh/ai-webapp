import { Router } from 'express'
import { db, projectId } from '../db.js'
import { chapters, project } from '../services/context.js'
import { planChapter } from '../agents/tasks.js'

export const core = Router()

core.get('/project', (_req, res) => {
  res.json({ project: project(), chapters: chapters() })
})

core.patch('/project', (req, res) => {
  const fields = ['title', 'subtitle', 'institution', 'degree', 'examiner', 'page_budget', 'deadline', 'research_question']
  const set = fields.filter((f) => f in req.body)
  if (!set.length) return res.json(project())
  db.prepare(`UPDATE projects SET ${set.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`).run(
    ...set.map((f) => req.body[f]),
    projectId(),
  )
  res.json(project())
})

/* ------------------------------------------------------------- Kapitel */

core.get('/chapters', (_req, res) => {
  const rows = chapters().map((c) => {
    const sources = db
      .prepare(
        `SELECT s.id, s.title, s.authors, s.year, s.status, s.internalization, sc.role, sc.relevance
         FROM source_chapters sc JOIN sources s ON s.id = sc.source_id
         WHERE sc.chapter_id = ? ORDER BY sc.relevance DESC`,
      )
      .all(c.id)
    const tasks = db
      .prepare('SELECT * FROM tasks WHERE chapter_id = ? ORDER BY status, priority, sort, id')
      .all(c.id) as { status: string; estimate_min: number }[]
    const openMin = tasks
      .filter((t) => t.status === 'offen' || t.status === 'laeuft')
      .reduce((n, t) => n + t.estimate_min, 0)
    return { ...c, sources, tasks, openMinutes: openMin }
  })
  res.json(rows)
})

core.post('/chapters', (req, res) => {
  const { number, title, goal, target_pages, parent_id } = req.body
  const maxSort = db.prepare('SELECT COALESCE(MAX(sort),0) AS m FROM chapters WHERE project_id = ?').get(projectId()) as { m: number }
  const info = db
    .prepare(
      'INSERT INTO chapters (project_id, parent_id, number, title, goal, target_pages, sort) VALUES (?,?,?,?,?,?,?)',
    )
    .run(projectId(), parent_id ?? null, number, title, goal ?? null, target_pages ?? 0, maxSort.m + 10)
  res.json(db.prepare('SELECT * FROM chapters WHERE id = ?').get(info.lastInsertRowid))
})

core.patch('/chapters/:id', (req, res) => {
  const allowed = ['number', 'title', 'goal', 'target_pages', 'written_pages', 'status', 'sort', 'parent_id']
  const set = allowed.filter((f) => f in req.body)
  if (set.length) {
    db.prepare(`UPDATE chapters SET ${set.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`).run(
      ...set.map((f) => req.body[f]),
      req.params.id,
    )
  }
  res.json(db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id))
})

core.delete('/chapters/:id', (req, res) => {
  db.prepare('DELETE FROM chapters WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

/* ------------------------------------------------------------ Aufgaben */

core.get('/tasks', (req, res) => {
  const where: string[] = ['project_id = ?']
  const args: unknown[] = [projectId()]
  if (req.query.status) {
    where.push('status = ?')
    args.push(req.query.status)
  }
  if (req.query.chapter_id) {
    where.push('chapter_id = ?')
    args.push(req.query.chapter_id)
  }
  const rows = db
    .prepare(
      `SELECT t.*, c.number AS chapter_number, c.title AS chapter_title, s.title AS source_title
       FROM tasks t LEFT JOIN chapters c ON c.id = t.chapter_id
       LEFT JOIN sources s ON s.id = t.source_id
       WHERE ${where.join(' AND ')}
       ORDER BY CASE t.status WHEN 'laeuft' THEN 0 WHEN 'offen' THEN 1 ELSE 2 END,
                t.priority, c.sort, t.sort, t.id`,
    )
    .all(...args)
  res.json(rows)
})

core.post('/tasks', (req, res) => {
  const { chapter_id, source_id, title, detail, kind, estimate_min, priority, blocked_by, origin } = req.body
  const info = db
    .prepare(
      `INSERT INTO tasks (project_id, chapter_id, source_id, title, detail, kind, estimate_min, priority, blocked_by, origin)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      projectId(),
      chapter_id ?? null,
      source_id ?? null,
      title,
      detail ?? null,
      kind ?? 'schreiben',
      estimate_min ?? 30,
      priority ?? 2,
      blocked_by ?? null,
      origin ?? 'mensch',
    )
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid))
})

core.patch('/tasks/:id', (req, res) => {
  const allowed = ['title', 'detail', 'kind', 'estimate_min', 'actual_min', 'status', 'priority', 'blocked_by', 'chapter_id', 'sort']
  const set = allowed.filter((f) => f in req.body)
  if (set.length) {
    db.prepare(`UPDATE tasks SET ${set.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`).run(
      ...set.map((f) => req.body[f]),
      req.params.id,
    )
  }
  if (req.body.status === 'erledigt') {
    db.prepare("UPDATE tasks SET done_at = datetime('now') WHERE id = ?").run(req.params.id)
  }
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id))
})

core.delete('/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

/** Der Planer schlaegt vor - uebernommen wird erst nach menschlicher Sichtung. */
core.post('/chapters/:id/plan', async (req, res) => {
  const chapterId = Number(req.params.id)
  const result = await planChapter(chapterId)
  res.json({
    runId: result.runId,
    offline: result.offline,
    error: result.error,
    plan: result.data,
  })
})

core.post('/chapters/:id/plan/accept', (req, res) => {
  const chapterId = Number(req.params.id)
  const items = (req.body.aufgaben ?? []) as {
    titel: string
    ergebnis: string
    art: string
    minuten: number
    prioritaet: number
    voraussetzung: string
  }[]
  const insert = db.prepare(
    `INSERT INTO tasks (project_id, chapter_id, title, detail, kind, estimate_min, priority, blocked_by, origin, sort)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  )
  const created: unknown[] = []
  items.forEach((t, i) => {
    const info = insert.run(
      projectId(),
      chapterId,
      t.titel,
      t.ergebnis,
      t.art,
      Math.round(t.minuten),
      t.prioritaet ?? 2,
      t.voraussetzung && t.voraussetzung !== 'keine' ? t.voraussetzung : null,
      'agent:planner',
      i * 10,
    )
    created.push(db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid))
  })
  if (req.body.runId) {
    db.prepare("UPDATE agent_runs SET verdict = 'uebernommen', verdict_at = datetime('now'), verdict_note = ? WHERE id = ?").run(
      `${created.length} von ${items.length} Aufgaben uebernommen`,
      req.body.runId,
    )
  }
  res.json(created)
})

/* ----------------------------------------------------------- Cockpit */

core.get('/dashboard', (_req, res) => {
  const p = project()
  const chs = chapters()
  const pages = db
    .prepare('SELECT COALESCE(SUM(target_pages),0) AS target, COALESCE(SUM(written_pages),0) AS written FROM chapters WHERE project_id = ?')
    .get(p.id) as { target: number; written: number }

  const sources = db
    .prepare(
      `SELECT status, COUNT(*) AS n, COALESCE(AVG(internalization),0) AS avg_int
       FROM sources WHERE project_id = ? GROUP BY status`,
    )
    .all(p.id) as { status: string; n: number; avg_int: number }[]

  const tasks = db
    .prepare(
      `SELECT status, COUNT(*) AS n, COALESCE(SUM(estimate_min),0) AS minutes
       FROM tasks WHERE project_id = ? GROUP BY status`,
    )
    .all(p.id) as { status: string; n: number; minutes: number }[]

  const nextTasks = db
    .prepare(
      `SELECT t.*, c.number AS chapter_number FROM tasks t LEFT JOIN chapters c ON c.id = t.chapter_id
       WHERE t.project_id = ? AND t.status IN ('offen','laeuft')
       ORDER BY CASE t.status WHEN 'laeuft' THEN 0 ELSE 1 END, t.priority, c.sort, t.sort LIMIT 6`,
    )
    .all(p.id)

  const runs = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN verdict = 'offen' THEN 1 ELSE 0 END) AS offen,
              SUM(CASE WHEN verdict = 'uebernommen' THEN 1 ELSE 0 END) AS uebernommen,
              SUM(CASE WHEN verdict = 'geaendert' THEN 1 ELSE 0 END) AS geaendert,
              SUM(CASE WHEN verdict = 'verworfen' THEN 1 ELSE 0 END) AS verworfen
       FROM agent_runs`,
    )
    .get() as Record<string, number>

  const uncovered = chs
    .filter((c) => c.goal)
    .map((c) => {
      const n = db.prepare('SELECT COUNT(*) AS n FROM source_chapters WHERE chapter_id = ?').get(c.id) as { n: number }
      return { ...c, sourceCount: n.n }
    })
    .filter((c) => c.sourceCount === 0)

  const news = db
    .prepare("SELECT COUNT(*) AS n FROM news_items WHERE state = 'neu' AND relevance >= 60")
    .get() as { n: number }

  const daysLeft = p.deadline
    ? Math.ceil((new Date(p.deadline).getTime() - Date.now()) / 86_400_000)
    : null

  res.json({ project: p, pages, sources, tasks, nextTasks, runs, uncovered, newsHot: news.n, daysLeft })
})
