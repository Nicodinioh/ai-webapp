import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

export const DATA_DIR = path.resolve(process.cwd(), 'data')
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')
export const EXTRACT_DIR = path.join(DATA_DIR, 'extracted')

for (const dir of [DATA_DIR, UPLOAD_DIR, EXTRACT_DIR]) fs.mkdirSync(dir, { recursive: true })

export const db = new Database(path.join(DATA_DIR, 'kompass.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS projects (
  id            INTEGER PRIMARY KEY,
  title         TEXT NOT NULL,
  subtitle      TEXT,
  institution   TEXT,
  degree        TEXT,
  examiner      TEXT,
  page_budget   INTEGER,
  deadline      TEXT,
  research_question TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Kapitelbaum. parent_id erlaubt 2 -> 2.1 -> 2.1.1.
CREATE TABLE IF NOT EXISTS chapters (
  id            INTEGER PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id     INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
  number        TEXT NOT NULL,
  title         TEXT NOT NULL,
  goal          TEXT,              -- Leitfrage: was muss dieses Kapitel beweisen?
  target_pages  REAL DEFAULT 0,
  written_pages REAL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'offen',   -- offen|entwurf|ueberarbeitung|fertig
  sort          INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sources (
  id            INTEGER PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  citekey       TEXT UNIQUE,
  title         TEXT NOT NULL,
  authors       TEXT,
  year          INTEGER,
  venue         TEXT,              -- Journal, Verlag, Behoerde
  url           TEXT,
  doi           TEXT,
  kind          TEXT DEFAULT 'artikel',   -- artikel|rechtsakt|aufsichtsdokument|buch|studie|bericht|web
  evidence      TEXT DEFAULT 'unbekannt', -- peer_review|institutionell|praxis|presse|unbekannt
  status        TEXT NOT NULL DEFAULT 'eingang', -- eingang|triage|lesen|verinnerlicht|zitiert|verworfen
  internalization INTEGER NOT NULL DEFAULT 0,    -- 0..100, aus dem Lesesaal berechnet
  core_claim    TEXT,              -- Kernthese in einem Satz
  abstract      TEXT,
  notes         TEXT,
  file_path     TEXT,              -- relativer Pfad unter data/uploads
  text_path     TEXT,              -- extrahierter Volltext unter data/extracted
  page_count    INTEGER,
  char_count    INTEGER,
  added_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL UNIQUE,
  kind    TEXT NOT NULL DEFAULT 'thema',  -- thema|konzept|regulatorik|methode|akteur
  color   TEXT
);

CREATE TABLE IF NOT EXISTS source_tags (
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  tag_id    INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (source_id, tag_id)
);

-- Die zentrale Verbindung: Quelle <-> Kapitel, mit Rolle und Begruendung.
CREATE TABLE IF NOT EXISTS source_chapters (
  source_id  INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'beleg',  -- kern|beleg|kontrast|kontext|methode
  relevance  INTEGER NOT NULL DEFAULT 3,     -- 1..5
  rationale  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (source_id, chapter_id)
);

-- Belegstellen: Zitat / Paraphrase / Eigenleistung, immer mit Seitenanker.
CREATE TABLE IF NOT EXISTS excerpts (
  id         INTEGER PRIMARY KEY,
  source_id  INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  page       TEXT,
  quote      TEXT,
  paraphrase TEXT,
  kind       TEXT NOT NULL DEFAULT 'paraphrase', -- zitat|paraphrase|eigenleistung
  verified   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Gefuehrte Lektuere: eine Session pro Quelle, sechs Stufen.
CREATE TABLE IF NOT EXISTS reading_sessions (
  id          INTEGER PRIMARY KEY,
  source_id   INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  stage       INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'laufend', -- laufend|abgeschlossen
  minutes     INTEGER NOT NULL DEFAULT 0,
  started_at  TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS reading_steps (
  id          INTEGER PRIMARY KEY,
  session_id  INTEGER NOT NULL REFERENCES reading_sessions(id) ON DELETE CASCADE,
  stage       INTEGER NOT NULL,
  prompt      TEXT NOT NULL,       -- Leitfrage des Tutors
  hint        TEXT,
  answer      TEXT,                -- Antwort des Menschen
  feedback    TEXT,                -- Rueckmeldung des Tutors
  score       INTEGER,             -- 0..100 Verstaendnisgrad dieses Schritts
  gaps        TEXT,                -- JSON: erkannte Luecken
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  answered_at TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id           INTEGER PRIMARY KEY,
  project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chapter_id   INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
  source_id    INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  detail       TEXT,
  kind         TEXT NOT NULL DEFAULT 'schreiben', -- lesen|schreiben|recherche|pruefung|formatierung
  estimate_min INTEGER NOT NULL DEFAULT 30,
  actual_min   INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'offen',  -- offen|laeuft|erledigt|verworfen
  priority     INTEGER NOT NULL DEFAULT 2,     -- 1 hoch .. 3 niedrig
  blocked_by   TEXT,
  origin       TEXT NOT NULL DEFAULT 'mensch', -- mensch|agent:<id>
  sort         INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  done_at      TEXT
);

-- Quellenvorschlaege pro Kapitel (Scout-Agent).
CREATE TABLE IF NOT EXISTS suggestions (
  id         INTEGER PRIMARY KEY,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  authors    TEXT,
  year       TEXT,
  venue      TEXT,
  url        TEXT,
  evidence   TEXT,
  rationale  TEXT,          -- warum genau dieses Kapitel
  gap        TEXT,          -- welche Luecke sie schliesst
  confidence INTEGER DEFAULT 50,
  verified   INTEGER NOT NULL DEFAULT 0,  -- 1 = per Websuche belegt
  status     TEXT NOT NULL DEFAULT 'offen', -- offen|uebernommen|verworfen
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS feeds (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL,
  url     TEXT NOT NULL UNIQUE,
  kind    TEXT NOT NULL DEFAULT 'rss',
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS news_items (
  id           INTEGER PRIMARY KEY,
  feed_id      INTEGER REFERENCES feeds(id) ON DELETE SET NULL,
  feed_name    TEXT,
  title        TEXT NOT NULL,
  url          TEXT NOT NULL UNIQUE,
  published_at TEXT,
  summary      TEXT,
  relevance    INTEGER,       -- 0..100, vom Kurator
  angle        TEXT,          -- warum relevant fuer DIESE Arbeit
  chapter_hint TEXT,          -- Kapitelnummern, kommasepariert
  citable      TEXT,          -- ja|nein|als Sekundaerhinweis
  state        TEXT NOT NULL DEFAULT 'neu', -- neu|gelesen|gemerkt|verworfen
  fetched_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- HCAI-Nachweis: jede Agenteninteraktion wird protokolliert und braucht ein
-- menschliches Urteil. Das ist der Kern des ADG-Cases.
CREATE TABLE IF NOT EXISTS agent_runs (
  id            INTEGER PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  purpose       TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     INTEGER,
  model         TEXT,
  automation    INTEGER NOT NULL DEFAULT 2, -- 1 Werkzeug .. 4 Delegation (Shneiderman-Achse)
  input_digest  TEXT,
  output        TEXT,
  tokens_in     INTEGER,
  tokens_out    INTEGER,
  cache_read    INTEGER,
  latency_ms    INTEGER,
  offline       INTEGER NOT NULL DEFAULT 0,
  verdict       TEXT NOT NULL DEFAULT 'offen', -- offen|uebernommen|geaendert|verworfen
  verdict_note  TEXT,
  verdict_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_runs_created ON agent_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_chapter ON tasks(chapter_id, status);
CREATE INDEX IF NOT EXISTS idx_steps_session ON reading_steps(session_id, stage);
CREATE INDEX IF NOT EXISTS idx_news_rel ON news_items(relevance DESC);
`)

export function projectId(): number {
  const row = db.prepare('SELECT id FROM projects ORDER BY id LIMIT 1').get() as { id: number } | undefined
  if (row) return row.id
  const info = db
    .prepare('INSERT INTO projects (title, institution, page_budget) VALUES (?, ?, ?)')
    .run('Unbenannte Forschungsarbeit', 'ADG Business School', 20)
  return Number(info.lastInsertRowid)
}
