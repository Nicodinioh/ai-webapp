import { XMLParser } from 'fast-xml-parser'
import { db } from '../db.js'
import { curateNews } from '../agents/tasks.js'

export const DEFAULT_FEEDS = [
  { name: 'BaFin - Meldungen', url: 'https://www.bafin.de/SiteGlobals/Functions/RSSFeed/DE/RSSNewsfeed/RSSNewsfeed_Meldungen.xml' },
  { name: 'EBA - News & Press', url: 'https://www.eba.europa.eu/rss.xml' },
  { name: 'Bundesbank', url: 'https://www.bundesbank.de/service/rss/de/633290/feed.xml' },
  { name: 'arXiv cs.CY - Computers & Society', url: 'https://rss.arxiv.org/rss/cs.CY' },
  { name: 'arXiv econ.GN - General Economics', url: 'https://rss.arxiv.org/rss/econ.GN' },
  { name: 'NBER - New Working Papers', url: 'https://back.nber.org/rss/new.xml' },
]

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })

export interface FetchReport {
  feed: string
  ok: boolean
  found: number
  added: number
  error?: string
}

function text(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object' && '#text' in (v as any)) return String((v as any)['#text'])
  return String(v)
}

function strip(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchFeed(name: string, url: string, id: number | null): Promise<FetchReport> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'KOMPASS Research OS (feed reader)', accept: 'application/rss+xml, application/xml, text/xml, */*' },
    })
    clearTimeout(timer)
    if (!res.ok) return { feed: name, ok: false, found: 0, added: 0, error: `HTTP ${res.status}` }

    const xml = await res.text()
    const doc = parser.parse(xml)
    const rss = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? []
    const items = Array.isArray(rss) ? rss : [rss]

    const insert = db.prepare(
      `INSERT OR IGNORE INTO news_items (feed_id, feed_name, title, url, published_at, summary)
       VALUES (?,?,?,?,?,?)`,
    )
    let added = 0
    for (const item of items.slice(0, 30)) {
      const link =
        text(item.link) ||
        (Array.isArray(item.link) ? item.link[0]?.['@_href'] : item.link?.['@_href']) ||
        text(item.id)
      if (!link) continue
      const title = strip(text(item.title))
      const summary = strip(text(item.description) || text(item.summary) || text(item.content))
      const published = text(item.pubDate) || text(item.published) || text(item.updated) || ''
      const info = insert.run(id, name, title || '(ohne Titel)', link, published, summary.slice(0, 3000))
      if (info.changes > 0) added++
    }
    return { feed: name, ok: true, found: items.length, added }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { feed: name, ok: false, found: 0, added: 0, error: msg.includes('abort') ? 'Zeitueberschreitung' : msg }
  }
}

export function ensureFeeds() {
  const insert = db.prepare('INSERT OR IGNORE INTO feeds (name, url) VALUES (?,?)')
  for (const f of DEFAULT_FEEDS) insert.run(f.name, f.url)
}

export async function refreshFeeds(): Promise<FetchReport[]> {
  ensureFeeds()
  const feeds = db.prepare('SELECT * FROM feeds WHERE enabled = 1').all() as {
    id: number
    name: string
    url: string
  }[]
  return Promise.all(feeds.map((f) => fetchFeed(f.name, f.url, f.id)))
}

/** Bewertet alle noch unbewerteten Meldungen in Portionen. */
export async function curatePending(limit = 20): Promise<{ scored: number; runId: number | null; error?: string }> {
  const pending = db
    .prepare(
      `SELECT url, title, summary, feed_name AS feed, published_at AS date
       FROM news_items WHERE relevance IS NULL ORDER BY fetched_at DESC LIMIT ?`,
    )
    .all(limit) as { url: string; title: string; summary: string; feed: string; date: string }[]
  if (!pending.length) return { scored: 0, runId: null }

  const res = await curateNews(pending)
  if (!res.data) return { scored: 0, runId: res.runId, error: res.error ?? 'Keine verwertbare Antwort' }

  const upd = db.prepare(
    `UPDATE news_items SET relevance = ?, angle = ?, chapter_hint = ?, citable = ? WHERE url = ?`,
  )
  let scored = 0
  for (const b of res.data.bewertungen) {
    const info = upd.run(
      Math.round(b.relevanz),
      `${b.anschlusspunkt}${b.primaerdokument ? ` | Primaerdokument: ${b.primaerdokument}` : ''}`,
      b.kapitel.join(', '),
      b.zitierfaehig,
      b.url,
    )
    if (info.changes > 0) scored++
  }
  return { scored, runId: res.runId }
}
