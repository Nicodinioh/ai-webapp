import { db, projectId } from '../db.js'

export interface ChapterRow {
  id: number
  number: string
  title: string
  goal: string | null
  target_pages: number
  written_pages: number
  status: string
  parent_id: number | null
  sort: number
}

export function chapters(): ChapterRow[] {
  return db
    .prepare(
      `SELECT id, number, title, goal, target_pages, written_pages, status, parent_id, sort
       FROM chapters WHERE project_id = ? ORDER BY sort, number`,
    )
    .all(projectId()) as ChapterRow[]
}

export function project() {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId()) as {
    id: number
    title: string
    subtitle: string | null
    institution: string | null
    degree: string | null
    examiner: string | null
    page_budget: number | null
    deadline: string | null
    research_question: string | null
  }
}

/**
 * Das Projektbriefing. Zweiter stabiler Systemblock jedes Agentenlaufs: es sagt
 * dem Agenten, an welcher Arbeit er mitarbeitet und wie ihr Beweisgang aussieht.
 */
export function briefing(): string {
  const p = project()
  const chs = chapters()
  const lines: string[] = ['===== PROJEKTBRIEFING =====', '']
  lines.push(`Arbeit: ${p.title}`)
  if (p.subtitle) lines.push(`Untertitel: ${p.subtitle}`)
  if (p.degree) lines.push(`Art: ${p.degree}`)
  if (p.institution) lines.push(`Hochschule: ${p.institution}`)
  if (p.examiner) lines.push(`Betreuung: ${p.examiner}`)
  if (p.page_budget) lines.push(`Seitenbudget: ${p.page_budget} Seiten (harte Nebenbedingung)`)
  if (p.deadline) lines.push(`Abgabe: ${p.deadline}`)
  if (p.research_question) lines.push(`\nForschungsfrage: ${p.research_question}`)

  lines.push('', '--- Kapitelstruktur mit Beweislast und Stand ---', '')
  for (const c of chs) {
    const src = db
      .prepare('SELECT COUNT(*) AS n FROM source_chapters WHERE chapter_id = ?')
      .get(c.id) as { n: number }
    const open = db
      .prepare("SELECT COUNT(*) AS n FROM tasks WHERE chapter_id = ? AND status IN ('offen','laeuft')")
      .get(c.id) as { n: number }
    lines.push(
      `${c.number} ${c.title} [${c.status}] - Ziel ${c.target_pages ?? 0} S., geschrieben ${c.written_pages ?? 0} S., ${src.n} Quellen zugeordnet, ${open.n} offene Aufgaben`,
    )
    if (c.goal) lines.push(`    Beweislast: ${c.goal}`)
  }

  const tags = db.prepare('SELECT name, kind FROM tags ORDER BY kind, name').all() as {
    name: string
    kind: string
  }[]
  if (tags.length) {
    lines.push('', '--- Vorhandenes Schlagwortvokabular (bevorzugt wiederverwenden) ---')
    const grouped = new Map<string, string[]>()
    for (const t of tags) {
      if (!grouped.has(t.kind)) grouped.set(t.kind, [])
      grouped.get(t.kind)!.push(t.name)
    }
    for (const [kind, names] of grouped) lines.push(`${kind}: ${names.join(', ')}`)
  }

  const cited = db
    .prepare(
      `SELECT s.citekey, s.title, s.authors, s.year, s.status, s.internalization
       FROM sources s WHERE s.project_id = ? AND s.status IN ('verinnerlicht','zitiert')
       ORDER BY s.year DESC LIMIT 40`,
    )
    .all(p.id) as { citekey: string; title: string; authors: string; year: number }[]
  if (cited.length) {
    lines.push('', '--- Bereits durchgearbeitete Quellen (Redundanz vermeiden) ---')
    for (const s of cited) lines.push(`- ${s.authors ?? '?'} (${s.year ?? '?'}): ${s.title}`)
  }

  return lines.join('\n')
}

export function chapterPath(id: number): string {
  const rows = chapters()
  const map = new Map(rows.map((r) => [r.id, r]))
  const parts: string[] = []
  let cur = map.get(id)
  while (cur) {
    parts.unshift(`${cur.number} ${cur.title}`)
    cur = cur.parent_id ? map.get(cur.parent_id) : undefined
  }
  return parts.join(' > ')
}
