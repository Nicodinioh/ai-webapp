export class ApiError extends Error {
  constructor(message: string, public status: number, public payload?: any) {
    super(message)
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body instanceof FormData ? undefined : { 'content-type': 'application/json' },
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  })
  const type = res.headers.get('content-type') ?? ''
  const data = type.includes('json') ? await res.json() : await res.text()
  if (!res.ok) throw new ApiError((data as any)?.error ?? `Fehler ${res.status}`, res.status, data)
  return data as T
}

export const api = {
  get: <T,>(p: string) => request<T>('GET', p),
  post: <T,>(p: string, b?: unknown) => request<T>('POST', p, b),
  patch: <T,>(p: string, b?: unknown) => request<T>('PATCH', p, b),
  del: <T,>(p: string) => request<T>('DELETE', p),
}

/* ------------------------------------------------------------------ Typen */

export interface Project {
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

export interface Chapter {
  id: number
  parent_id: number | null
  number: string
  title: string
  goal: string | null
  target_pages: number
  written_pages: number
  status: string
  sort: number
}

export interface ChapterFull extends Chapter {
  sources: {
    id: number; title: string; authors: string | null; year: number | null
    status: string; internalization: number; role: string; relevance: number
  }[]
  tasks: Task[]
  openMinutes: number
}

export interface Source {
  id: number
  citekey: string | null
  title: string
  authors: string | null
  year: number | null
  venue: string | null
  url: string | null
  doi: string | null
  kind: string
  evidence: string
  status: string
  internalization: number
  core_claim: string | null
  abstract: string | null
  notes: string | null
  page_count: number | null
  char_count: number | null
  added_at: string
  hasFullText: boolean
  tags: { id: number; name: string; kind: string }[]
  chapters: { id: number; number: string; title: string; role: string; relevance: number; rationale: string | null }[]
  excerpts: Excerpt[]
}

export interface Excerpt {
  id: number
  source_id: number
  chapter_id: number | null
  page: string | null
  quote: string | null
  paraphrase: string | null
  kind: string
  verified: number
}

export interface Task {
  id: number
  chapter_id: number | null
  source_id: number | null
  title: string
  detail: string | null
  kind: string
  estimate_min: number
  actual_min: number
  status: string
  priority: number
  blocked_by: string | null
  origin: string
  chapter_number?: string | null
  chapter_title?: string | null
  source_title?: string | null
}

export interface AgentInfo {
  id: string
  name: string
  mandate: string
  boundary: string
  knowledge: string[]
  effort: string
  automation: number
  webSearch: boolean
  stats: { runs: number; accepted: number; changed: number; rejected: number; pending: number; tin: number; tout: number; cached: number }
}

export interface AgentRun {
  id: number
  agent_id: string
  purpose: string
  entity_type: string | null
  entity_id: number | null
  model: string | null
  automation: number
  output: string | null
  tokens_in: number | null
  tokens_out: number | null
  cache_read: number | null
  latency_ms: number | null
  offline: number
  verdict: string
  verdict_note: string | null
  created_at: string
}

export interface NewsItem {
  id: number
  feed_name: string
  title: string
  url: string
  published_at: string | null
  summary: string | null
  relevance: number | null
  angle: string | null
  chapter_hint: string | null
  citable: string | null
  state: string
}

export interface Suggestion {
  id: number
  chapter_id: number
  chapter_number: string
  chapter_title: string
  title: string
  authors: string | null
  year: string | null
  venue: string | null
  url: string | null
  evidence: string | null
  rationale: string | null
  gap: string | null
  confidence: number
  verified: number
  status: string
}

export interface ReadingStep {
  id: number
  session_id: number
  stage: number
  prompt: string
  hint: string | null
  answer: string | null
  feedback: string | null
  score: number | null
  gaps: string[]
}

export interface ReadingState {
  source: { id: number; title: string; authors: string | null; year: number | null; hasFullText: boolean; internalization: number }
  session: { id: number; stage: number; status: string }
  steps: ReadingStep[]
  perStage: { stage: number; name: string; minutes: number; aim: string; asked: number; answered: number; score: number | null; complete: boolean }[]
}

export interface Dashboard {
  project: Project
  pages: { target: number; written: number }
  sources: { status: string; n: number; avg_int: number }[]
  tasks: { status: string; n: number; minutes: number }[]
  nextTasks: (Task & { chapter_number: string | null })[]
  runs: Record<string, number>
  uncovered: (Chapter & { sourceCount: number })[]
  newsHot: number
  daysLeft: number | null
}
