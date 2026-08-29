/**
 * Legt eine Beispielarbeit an: die Projektstudienarbeit zu generativer KI in der
 * Bankenbranche, mit Kapitelstruktur, Beweislasten und Quellengeruest.
 * Aufruf: npm run seed   (bestehende Daten bleiben unberuehrt, wenn schon Kapitel existieren)
 */
import 'dotenv/config'
import { db, projectId } from '../db.js'
import { ensureFeeds } from '../services/news.js'

const pid = projectId()
const existing = db.prepare('SELECT COUNT(*) AS n FROM chapters WHERE project_id = ?').get(pid) as { n: number }
if (existing.n > 0 && !process.argv.includes('--force')) {
  console.log('Es gibt bereits Kapitel. Mit --force wird zusaetzlich eingefuegt.')
  process.exit(0)
}

db.prepare(
  `UPDATE projects SET title = ?, subtitle = ?, institution = ?, degree = ?, examiner = ?,
   page_budget = ?, research_question = ? WHERE id = ?`,
).run(
  'Generative KI in der Bankenbranche',
  'Regulatorik als Gestaltungsrahmen der Transformation',
  'ADG Business School',
  'Projektstudienarbeit',
  'Prof. Meyer',
  20,
  'Wie praegt der regulatorische Rahmen die Form, in der generative KI in einer genossenschaftlichen Primaerbank eingesetzt werden kann - und welcher Gestaltungsraum bleibt der Bank?',
  pid,
)

const chapters: [string, string, string, number][] = [
  ['1', 'Einleitung', 'Problem, Fragestellung und Abgrenzung setzen; vier Argumentationsstraenge als Vorwaertsverweis anlegen.', 2],
  ['2', 'Regulatorischer Gestaltungsrahmen', 'Den Rechtsrahmen deskriptiv sauber einfuehren, auf den der analytische Teil zugreift.', 6],
  ['2.1', 'EU AI Act', 'Zeigen, welche Anwendungen als Hochrisiko gelten und welche Pflichten die Bank als Betreiberin treffen.', 1.5],
  ['2.2', 'Sektorspezifische Regulierung', 'Zeigen, wie MaRisk, BAIT und DORA Entscheidungsverantwortung und Auslagerung regeln.', 1.5],
  ['2.3', 'HCAI als Uebersetzungsschicht', 'Zeigen, dass die regulatorischen Anforderungen sich als HCAI-Prinzipien lesen lassen.', 1.5],
  ['3', 'Anwendung: Wissenstyp und Aufgabenstruktur', 'Die Matrix auf den Einsatzkontext anwenden und den Gestaltungsraum bestimmen.', 6],
  ['3.1', 'Quadranten und Zuordnung', 'Zeigen, welche Aufgaben in welchen Quadranten fallen und was daraus folgt.', 3],
  ['3.2', 'Gestaltungsraum der Primaerbank', 'Zeigen, wo die Bank ueberhaupt gestalten kann und wo nicht.', 3],
  ['4', 'Governance und Ausblick', 'Zeigen, welche organisationalen Voraussetzungen die regulatorische Erwartung erfuellen.', 3],
  ['5', 'Synthese', 'Die Forschungsfrage explizit beantworten und die Bruecke zur Masterthesis schlagen.', 2],
]

const insertChapter = db.prepare(
  'INSERT INTO chapters (project_id, parent_id, number, title, goal, target_pages, sort) VALUES (?,?,?,?,?,?,?)',
)
const ids = new Map<string, number>()
chapters.forEach(([number, title, goal, pages], i) => {
  const parentNumber = number.includes('.') ? number.split('.')[0] : null
  const info = insertChapter.run(
    pid,
    parentNumber ? (ids.get(parentNumber) ?? null) : null,
    number,
    title,
    goal,
    pages,
    i * 10,
  )
  ids.set(number, Number(info.lastInsertRowid))
})

const tags: [string, string][] = [
  ['EU AI Act', 'regulatorik'],
  ['DORA', 'regulatorik'],
  ['MaRisk', 'regulatorik'],
  ['Menschliche Aufsicht', 'konzept'],
  ['HCAI', 'konzept'],
  ['Augmentation', 'konzept'],
  ['Deskilling', 'konzept'],
  ['Feldexperiment', 'methode'],
  ['Rechtsakt', 'methode'],
  ['BaFin', 'akteur'],
  ['Genossenschaftsbank', 'akteur'],
]
const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name, kind) VALUES (?,?)')
for (const [name, kind] of tags) insertTag.run(name, kind)

const tasks: [string, string, string, string, number][] = [
  ['3.1', 'Quadrantenzuordnung als Tabelle festlegen', 'Tabelle mit vier Quadranten und je zwei belegten Beispielaufgaben', 'schreiben', 90],
  ['3.1', 'Absatz zur Instabilitaet des Analysequadranten schreiben', '180 Woerter, belegt, mit Uebergang zum naechsten Abschnitt', 'schreiben', 60],
  ['2.1', 'Art. 26 AI Act auswerten und Betreiberpflichten sichern', 'Belegstellen mit Artikelverweis im System erfasst', 'lesen', 45],
  ['2.2', 'DORA Art. 28 auf die Auslagerungskette anwenden', 'Absatz zur Verantwortungsasymmetrie, belegt am Verordnungstext', 'schreiben', 70],
  ['2.3', 'RST-Trias auf die regulatorischen Anforderungen mappen', 'Zuordnungstabelle Reliable/Safe/Trustworthy zu Normen', 'schreiben', 75],
]
const insertTask = db.prepare(
  'INSERT INTO tasks (project_id, chapter_id, title, detail, kind, estimate_min, priority, sort) VALUES (?,?,?,?,?,?,?,?)',
)
tasks.forEach(([ch, title, detail, kind, minutes], i) => {
  insertTask.run(pid, ids.get(ch) ?? null, title, detail, kind, minutes, i < 2 ? 1 : 2, i * 10)
})

ensureFeeds()

console.log(`Beispielarbeit angelegt: ${chapters.length} Kapitel, ${tags.length} Schlagworte, ${tasks.length} Aufgaben.`)
