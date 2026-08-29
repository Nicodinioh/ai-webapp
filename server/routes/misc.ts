import { Router } from 'express'
import { db, projectId } from '../db.js'
import { AGENTS } from '../agents/registry.js'
import { hasApiKey, MODEL } from '../claude.js'
import { scoutChapter } from '../agents/tasks.js'
import { curatePending, DEFAULT_FEEDS, ensureFeeds, refreshFeeds } from '../services/news.js'
import { project } from '../services/context.js'

export const misc = Router()

/* --------------------------------------------------------------- Agenten */

misc.get('/agents', (_req, res) => {
  res.json(
    AGENTS.map((a) => {
      const stats = db
        .prepare(
          `SELECT COUNT(*) AS runs,
                  SUM(CASE WHEN verdict = 'uebernommen' THEN 1 ELSE 0 END) AS accepted,
                  SUM(CASE WHEN verdict = 'geaendert' THEN 1 ELSE 0 END) AS changed,
                  SUM(CASE WHEN verdict = 'verworfen' THEN 1 ELSE 0 END) AS rejected,
                  SUM(CASE WHEN verdict = 'offen' THEN 1 ELSE 0 END) AS pending,
                  COALESCE(SUM(tokens_in),0) AS tin, COALESCE(SUM(tokens_out),0) AS tout,
                  COALESCE(SUM(cache_read),0) AS cached
           FROM agent_runs WHERE agent_id = ?`,
        )
        .get(a.id) as Record<string, number>
      return {
        id: a.id,
        name: a.name,
        mandate: a.mandate,
        boundary: a.boundary,
        knowledge: a.knowledge,
        effort: a.effort,
        automation: a.automation,
        webSearch: Boolean(a.webSearch),
        stats,
      }
    }),
  )
})

misc.get('/status', (_req, res) => {
  res.json({ online: hasApiKey(), model: hasApiKey() ? MODEL : null })
})

/* ------------------------------------------------------------ HCAI-Nachweis */

misc.get('/runs', (req, res) => {
  const where: string[] = []
  const args: unknown[] = []
  if (req.query.agent_id) {
    where.push('agent_id = ?')
    args.push(req.query.agent_id)
  }
  if (req.query.verdict) {
    where.push('verdict = ?')
    args.push(req.query.verdict)
  }
  const rows = db
    .prepare(
      `SELECT * FROM agent_runs ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY created_at DESC, id DESC LIMIT ?`,
    )
    .all(...args, Number(req.query.limit) || 100)
  res.json(rows)
})

misc.patch('/runs/:id', (req, res) => {
  const { verdict, verdict_note } = req.body
  db.prepare("UPDATE agent_runs SET verdict = ?, verdict_note = ?, verdict_at = datetime('now') WHERE id = ?").run(
    verdict,
    verdict_note ?? null,
    req.params.id,
  )
  res.json(db.prepare('SELECT * FROM agent_runs WHERE id = ?').get(req.params.id))
})

/** Der Nachweis, den die Hochschule sehen will: wo, wofuer, mit welcher Pruefung. */
misc.get('/hcai/export', (_req, res) => {
  const p = project()
  const runs = db.prepare('SELECT * FROM agent_runs ORDER BY created_at').all() as any[]
  const byAgent = new Map<string, any[]>()
  for (const r of runs) {
    if (!byAgent.has(r.agent_id)) byAgent.set(r.agent_id, [])
    byAgent.get(r.agent_id)!.push(r)
  }
  const levels: Record<number, string> = {
    1: 'Werkzeug (der Mensch fuehrt, das System rechnet zu)',
    2: 'Vorschlag (das System schlaegt vor, der Mensch entscheidet)',
    3: 'Entwurf (das System formuliert, der Mensch ueberarbeitet)',
    4: 'Delegation (das System handelt, der Mensch prueft nachgelagert)',
  }

  const lines: string[] = []
  lines.push(`# Nachweis der KI-Nutzung`, '')
  lines.push(`**Arbeit:** ${p.title}`)
  if (p.institution) lines.push(`**Hochschule:** ${p.institution}`)
  lines.push(`**Erstellt am:** ${new Date().toLocaleString('de-DE')}`)
  lines.push(`**Eingesetztes Modell:** ${MODEL}`, '')
  lines.push(
    'Dieser Nachweis dokumentiert jede Interaktion mit einem KI-Agenten der Arbeitsplattform,',
    'den jeweiligen Automatisierungsgrad und das menschliche Urteil ueber das Ergebnis.',
    'Grundlage der Systematik ist die Unterscheidung von Automatisierungsgrad und menschlicher',
    'Kontrolle nach Shneiderman (2020).',
    '',
  )

  const total = runs.length
  const accepted = runs.filter((r) => r.verdict === 'uebernommen').length
  const changed = runs.filter((r) => r.verdict === 'geaendert').length
  const rejected = runs.filter((r) => r.verdict === 'verworfen').length
  const open = runs.filter((r) => r.verdict === 'offen').length

  lines.push('## Uebersicht', '')
  lines.push(`| Kennzahl | Wert |`, `|---|---|`)
  lines.push(`| Agentenlaeufe gesamt | ${total} |`)
  lines.push(`| unveraendert uebernommen | ${accepted} |`)
  lines.push(`| geaendert uebernommen | ${changed} |`)
  lines.push(`| verworfen | ${rejected} |`)
  lines.push(`| ohne menschliches Urteil | ${open} |`)
  const reviewed = total - open
  const overrideRate = reviewed ? Math.round(((changed + rejected) / reviewed) * 100) : 0
  lines.push(`| Uebersteuerungsquote | ${overrideRate} % der geprueften Laeufe geaendert oder verworfen |`)
  lines.push('')

  for (const [agentId, list] of byAgent) {
    const def = AGENTS.find((a) => a.id === agentId)
    lines.push(`## Agent: ${def?.name ?? agentId}`, '')
    if (def) {
      lines.push(`**Aufgabe:** ${def.mandate}`)
      lines.push(`**Grenze:** ${def.boundary}`)
      lines.push(`**Wissensbasis:** ${def.knowledge.join(', ')}`)
      lines.push(`**Automatisierungsgrad:** ${def.automation} - ${levels[def.automation]}`, '')
    }
    lines.push('| Zeitpunkt | Zweck | Urteil | Anmerkung |', '|---|---|---|---|')
    for (const r of list) {
      lines.push(
        `| ${r.created_at} | ${String(r.purpose).replace(/\|/g, '/')} | ${r.verdict} | ${(r.verdict_note ?? '').replace(/\|/g, '/')} |`,
      )
    }
    lines.push('')
  }

  res.type('text/markdown; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="ki-nutzungsnachweis.md"')
  res.send(lines.join('\n'))
})

/* -------------------------------------------------------- Quellenvorschlaege */

misc.get('/suggestions', (req, res) => {
  const where = req.query.chapter_id ? 'WHERE s.chapter_id = ?' : ''
  const args = req.query.chapter_id ? [req.query.chapter_id] : []
  res.json(
    db
      .prepare(
        `SELECT s.*, c.number AS chapter_number, c.title AS chapter_title
         FROM suggestions s JOIN chapters c ON c.id = s.chapter_id ${where}
         ORDER BY s.status, s.confidence DESC, s.id DESC`,
      )
      .all(...args),
  )
})

misc.post('/chapters/:id/scout', async (req, res) => {
  const chapterId = Number(req.params.id)
  const result = await scoutChapter(chapterId, String(req.body.gap ?? ''))
  if (!result.data) {
    return res.json({ runId: result.runId, offline: result.offline, error: result.error, text: result.text, suggestions: [], citations: result.citations })
  }
  const insert = db.prepare(
    `INSERT INTO suggestions (chapter_id, title, authors, year, venue, url, evidence, rationale, gap, confidence, verified)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  )
  const seen = new Set(result.citations.map((c) => c.url))
  const created = result.data.vorschlaege.map((v) => {
    const info = insert.run(
      chapterId,
      v.titel,
      v.urheber,
      v.jahr,
      v.erscheinungsort,
      v.url,
      v.evidenzstufe,
      v.begruendung,
      v.schliesst_luecke,
      Math.round(v.vertrauen),
      seen.has(v.url) ? 1 : 0,
    )
    return db.prepare('SELECT * FROM suggestions WHERE id = ?').get(info.lastInsertRowid)
  })
  res.json({
    runId: result.runId,
    queries: result.data.suchanfragen,
    notFound: result.data.nicht_gefunden,
    suggestions: created,
    citations: result.citations,
  })
})

misc.patch('/suggestions/:id', (req, res) => {
  db.prepare('UPDATE suggestions SET status = ? WHERE id = ?').run(req.body.status ?? 'offen', req.params.id)
  res.json(db.prepare('SELECT * FROM suggestions WHERE id = ?').get(req.params.id))
})

/** Ein Vorschlag wird zur Quelle - die PDF laedt der Mensch nach. */
misc.post('/suggestions/:id/adopt', (req, res) => {
  const s = db.prepare('SELECT * FROM suggestions WHERE id = ?').get(req.params.id) as any
  if (!s) return res.status(404).json({ error: 'Vorschlag nicht gefunden' })
  const info = db
    .prepare(
      `INSERT INTO sources (project_id, title, authors, year, venue, url, evidence, notes, status)
       VALUES (?,?,?,?,?,?,?,?, 'eingang')`,
    )
    .run(
      projectId(),
      s.title,
      s.authors,
      /^\d{4}$/.test(String(s.year)) ? Number(s.year) : null,
      s.venue,
      s.url,
      s.evidence,
      `Vom Quellen-Scout vorgeschlagen. Luecke: ${s.gap}\nBibliografische Angaben sind vor der Verwendung am Original zu pruefen.`,
    )
  db.prepare(
    `INSERT OR IGNORE INTO source_chapters (source_id, chapter_id, role, relevance, rationale) VALUES (?,?,?,?,?)`,
  ).run(info.lastInsertRowid, s.chapter_id, 'beleg', 3, s.rationale)
  db.prepare("UPDATE suggestions SET status = 'uebernommen' WHERE id = ?").run(s.id)
  res.json(db.prepare('SELECT * FROM sources WHERE id = ?').get(info.lastInsertRowid))
})

/* ------------------------------------------------------------------ Feed */

misc.get('/feeds', (_req, res) => {
  ensureFeeds()
  res.json(db.prepare('SELECT * FROM feeds ORDER BY name').all())
})

misc.post('/feeds', (req, res) => {
  const info = db.prepare('INSERT OR IGNORE INTO feeds (name, url) VALUES (?,?)').run(req.body.name, req.body.url)
  res.json(db.prepare('SELECT * FROM feeds WHERE id = ?').get(info.lastInsertRowid) ?? { ok: true })
})

misc.delete('/feeds/:id', (req, res) => {
  db.prepare('DELETE FROM feeds WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

misc.get('/news', (req, res) => {
  const where: string[] = []
  const args: unknown[] = []
  if (req.query.state) {
    where.push('state = ?')
    args.push(req.query.state)
  }
  if (req.query.min) {
    where.push('relevance >= ?')
    args.push(Number(req.query.min))
  }
  res.json(
    db
      .prepare(
        `SELECT * FROM news_items ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY (relevance IS NULL), relevance DESC, fetched_at DESC LIMIT 120`,
      )
      .all(...args),
  )
})

misc.post('/news/refresh', async (_req, res) => {
  const reports = await refreshFeeds()
  res.json({ reports, defaults: DEFAULT_FEEDS.length })
})

misc.post('/news/curate', async (req, res) => {
  const out = await curatePending(Number(req.body.limit) || 20)
  res.json(out)
})

misc.patch('/news/:id', (req, res) => {
  db.prepare('UPDATE news_items SET state = ? WHERE id = ?').run(req.body.state ?? 'gelesen', req.params.id)
  res.json(db.prepare('SELECT * FROM news_items WHERE id = ?').get(req.params.id))
})

/** Eine Meldung wird zur Quelle im Eingang. */
misc.post('/news/:id/adopt', (req, res) => {
  const n = db.prepare('SELECT * FROM news_items WHERE id = ?').get(req.params.id) as any
  if (!n) return res.status(404).json({ error: 'Meldung nicht gefunden' })
  const info = db
    .prepare(
      `INSERT INTO sources (project_id, title, venue, url, kind, evidence, abstract, notes, status)
       VALUES (?,?,?,?,?,?,?,?, 'eingang')`,
    )
    .run(
      projectId(),
      n.title,
      n.feed_name,
      n.url,
      'web',
      'presse',
      n.summary,
      `Aus dem Feed uebernommen. Einordnung des Kurators: ${n.angle ?? '-'}\nZitierfaehigkeit: ${n.citable ?? 'ungeprueft'}`,
    )
  db.prepare("UPDATE news_items SET state = 'gemerkt', saved_as_source_id = ? WHERE id = ?").run(info.lastInsertRowid, n.id)
  res.json(db.prepare('SELECT * FROM sources WHERE id = ?').get(info.lastInsertRowid))
})
