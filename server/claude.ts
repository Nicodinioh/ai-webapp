import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type * as z from 'zod/v4'
import { db } from './db.js'

export const MODEL = process.env.KOMPASS_MODEL || 'claude-opus-5'

/**
 * Ohne Key laeuft die Plattform im Offline-Modus: alles ausser den Agenten
 * funktioniert, und die Agenten liefern einen klar markierten Platzhalter
 * statt erfundener Inhalte.
 */
export const hasApiKey = (): boolean =>
  Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) client = new Anthropic()
  return client
}

export type SystemBlock = { text: string; cache?: boolean }

export interface RunOptions<T extends z.ZodType> {
  agentId: string
  purpose: string
  /** Stabile Bloecke zuerst: Rollenprompt, Wissensbasen, Projektbriefing. */
  system: SystemBlock[]
  /** Volatiler Teil: die konkrete Anfrage inklusive Materialien. */
  user: string
  schema?: T
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  maxTokens?: number
  webSearch?: number
  automation?: 1 | 2 | 3 | 4
  entityType?: string
  entityId?: number
}

export interface RunResult<T> {
  ok: boolean
  offline: boolean
  runId: number
  data: T | null
  text: string
  usage: { input: number; output: number; cacheRead: number }
  latencyMs: number
  error?: string
  citations: { title: string; url: string }[]
}

export class OfflineError extends Error {
  constructor() {
    super('Kein ANTHROPIC_API_KEY gesetzt - Agenten sind deaktiviert.')
  }
}

function logRun(o: {
  agentId: string
  purpose: string
  entityType?: string
  entityId?: number
  automation: number
  input: string
  output: string
  usage: { input: number; output: number; cacheRead: number }
  latencyMs: number
  offline: boolean
}): number {
  const info = db
    .prepare(
      `INSERT INTO agent_runs
       (agent_id, purpose, entity_type, entity_id, model, automation, input_digest,
        output, tokens_in, tokens_out, cache_read, latency_ms, offline)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      o.agentId,
      o.purpose,
      o.entityType ?? null,
      o.entityId ?? null,
      o.offline ? null : MODEL,
      o.automation,
      o.input.slice(0, 1200),
      o.output.slice(0, 20000),
      o.usage.input,
      o.usage.output,
      o.usage.cacheRead,
      o.latencyMs,
      o.offline ? 1 : 0,
    )
  return Number(info.lastInsertRowid)
}

/**
 * Ein Agentenlauf. Die stabilen Systembloecke tragen einen Cache-Breakpoint auf
 * dem letzten Block - die Wissensbasen aendern sich zwischen Laeufen nicht und
 * werden dadurch aus dem Prompt-Cache bedient.
 */
export async function run<T extends z.ZodType>(
  opts: RunOptions<T>,
): Promise<RunResult<z.infer<T>>> {
  const started = Date.now()
  const userDigest = opts.user.slice(0, 1200)

  if (!hasApiKey()) {
    const runId = logRun({
      agentId: opts.agentId,
      purpose: opts.purpose,
      entityType: opts.entityType,
      entityId: opts.entityId,
      automation: opts.automation ?? 2,
      input: userDigest,
      output: '[Offline-Modus: kein Agentenlauf]',
      usage: { input: 0, output: 0, cacheRead: 0 },
      latencyMs: 0,
      offline: true,
    })
    return {
      ok: false,
      offline: true,
      runId,
      data: null,
      text: '',
      usage: { input: 0, output: 0, cacheRead: 0 },
      latencyMs: 0,
      error: 'Offline-Modus: ANTHROPIC_API_KEY ist nicht gesetzt.',
      citations: [],
    }
  }

  const system: Anthropic.TextBlockParam[] = opts.system.map((b, i) => ({
    type: 'text' as const,
    text: b.text,
    ...(b.cache || i === opts.system.length - 1
      ? { cache_control: { type: 'ephemeral' as const } }
      : {}),
  }))

  const tools: Anthropic.ToolUnion[] = opts.webSearch
    ? [{ type: 'web_search_20260209', name: 'web_search', max_uses: opts.webSearch }]
    : []

  const base = {
    model: MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    system,
    messages: [{ role: 'user' as const, content: opts.user }],
    thinking: { type: 'adaptive' as const },
    output_config: { effort: opts.effort ?? 'high' },
    ...(tools.length ? { tools } : {}),
  }

  try {
    const anthropic = getClient()
    let text = ''
    let data: z.infer<T> | null = null
    let usage = { input: 0, output: 0, cacheRead: 0 }
    const citations: { title: string; url: string }[] = []

    // Strukturierte Ausgabe und Websuche schliessen sich aus: bei aktivierter
    // Suche wird der JSON-Block aus dem Text geparst.
    // Immer streamen - die Volltextlaeufe sind lang genug, dass eine einzelne
    // HTTP-Antwort in ein Timeout laufen wuerde.
    const stream = anthropic.messages.stream(
      opts.schema && !opts.webSearch
        ? {
            ...base,
            output_config: { ...base.output_config, format: zodOutputFormat(opts.schema) },
          }
        : base,
    )
    const res = await stream.finalMessage()

    for (const block of res.content) {
      if (block.type === 'text') text += block.text
      if (block.type === 'web_search_tool_result') {
        const content = block.content
        if (Array.isArray(content)) {
          for (const r of content) {
            if (r.type === 'web_search_result') citations.push({ title: r.title, url: r.url })
          }
        }
      }
    }
    usage = {
      input: res.usage.input_tokens,
      output: res.usage.output_tokens,
      cacheRead: res.usage.cache_read_input_tokens ?? 0,
    }

    if (opts.schema) {
      data = (res.parsed_output ?? null) as z.infer<T> | null
      if (data === null) {
        // Bei aktivierter Websuche kommt das JSON als Textblock zurueck.
        const parsed = extractJson(text)
        if (parsed !== null) {
          const check = opts.schema.safeParse(parsed)
          if (check.success) data = check.data as z.infer<T>
        }
      }
    }

    const latencyMs = Date.now() - started
    const runId = logRun({
      agentId: opts.agentId,
      purpose: opts.purpose,
      entityType: opts.entityType,
      entityId: opts.entityId,
      automation: opts.automation ?? 2,
      input: userDigest,
      output: data ? JSON.stringify(data) : text,
      usage,
      latencyMs,
      offline: false,
    })

    return { ok: true, offline: false, runId, data, text, usage, latencyMs, citations }
  } catch (err) {
    const latencyMs = Date.now() - started
    const message = describeError(err)
    const runId = logRun({
      agentId: opts.agentId,
      purpose: opts.purpose,
      entityType: opts.entityType,
      entityId: opts.entityId,
      automation: opts.automation ?? 2,
      input: userDigest,
      output: `[Fehler] ${message}`,
      usage: { input: 0, output: 0, cacheRead: 0 },
      latencyMs,
      offline: false,
    })
    return {
      ok: false,
      offline: false,
      runId,
      data: null,
      text: '',
      usage: { input: 0, output: 0, cacheRead: 0 },
      latencyMs,
      error: message,
      citations: [],
    }
  }
}

function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'API-Schluessel ungueltig oder abgelaufen.'
  if (err instanceof Anthropic.RateLimitError) return 'Ratenlimit erreicht - in einigen Minuten erneut versuchen.'
  if (err instanceof Anthropic.BadRequestError) return `Ungueltige Anfrage: ${err.message}`
  if (err instanceof Anthropic.APIConnectionError) return 'Keine Verbindung zur Claude-API.'
  if (err instanceof Anthropic.APIError) return `API-Fehler ${err.status}: ${err.message}`
  return err instanceof Error ? err.message : String(err)
}

/** Holt das erste vollstaendige JSON-Objekt oder -Array aus einem Text. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidates = fenced ? [fenced[1], text] : [text]
  for (const candidate of candidates) {
    const start = candidate.search(/[[{]/)
    if (start === -1) continue
    const open = candidate[start]
    const close = open === '{' ? '}' : ']'
    let depth = 0
    let inString = false
    let escaped = false
    for (let i = start; i < candidate.length; i++) {
      const ch = candidate[i]
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === '"') { inString = !inString; continue }
      if (inString) continue
      if (ch === open) depth++
      else if (ch === close) {
        depth--
        if (depth === 0) {
          try {
            return JSON.parse(candidate.slice(start, i + 1))
          } catch {
            break
          }
        }
      }
    }
  }
  return null
}
