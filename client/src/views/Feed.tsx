import { useCallback, useEffect, useState } from 'react'
import { api, type NewsItem } from '../lib/api'
import { AgentError, Empty, Panel, Tag, Working } from '../components/ui'
import { relDate } from '../lib/format'

export function Feed({ reload }: { reload: () => void }) {
  const [items, setItems] = useState<NewsItem[]>([])
  const [feeds, setFeeds] = useState<{ id: number; name: string; url: string }[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [report, setReport] = useState<{ feed: string; ok: boolean; added: number; error?: string }[] | null>(null)
  const [error, setError] = useState<{ error?: string; offline?: boolean } | null>(null)
  const [showFeeds, setShowFeeds] = useState(false)
  const [minRel, setMinRel] = useState(0)

  const load = useCallback(() => {
    api.get<NewsItem[]>('/news').then(setItems)
    api.get<{ id: number; name: string; url: string }[]>('/feeds').then(setFeeds)
  }, [])
  useEffect(load, [load])

  const refresh = async () => {
    setBusy('refresh')
    setReport(null)
    try {
      const r = await api.post<{ reports: any[] }>('/news/refresh')
      setReport(r.reports)
      load()
    } finally { setBusy(null) }
  }

  const curate = async () => {
    setBusy('curate')
    setError(null)
    try {
      const r = await api.post<{ scored: number; error?: string }>('/news/curate', { limit: 20 })
      if (r.error) setError({ error: r.error })
      load()
      reload()
    } catch (e: any) {
      setError({ error: e.message, offline: e.payload?.offline })
    } finally { setBusy(null) }
  }

  const unscored = items.filter((i) => i.relevance == null).length
  const shown = items.filter((i) => (i.relevance ?? -1) >= minRel || (minRel === 0 && i.relevance == null))

  return (
    <div className="stack">
      <div className="notice">
        Der Feed bewertet nicht nach Thema, sondern nach Wirkung auf deinen Beweisgang. Der Kurator sagt
        zu jeder Meldung, welches Argument in welchem Kapitel betroffen ist — und ob die Meldung selbst
        zitierfaehig ist oder nur auf ein Primaerdokument verweist.
      </div>

      <div className="row">
        <button className="primary" onClick={refresh} disabled={busy !== null}>
          {busy === 'refresh' ? 'holt…' : 'Quellen abrufen'}
        </button>
        <button onClick={curate} disabled={busy !== null || unscored === 0}>
          {busy === 'curate' ? 'bewertet…' : `Kurator bewerten lassen (${unscored})`}
        </button>
        <select value={minRel} onChange={(e) => setMinRel(Number(e.target.value))} style={{ width: 190 }}>
          <option value={0}>alle Meldungen</option>
          <option value={40}>ab Relevanz 40</option>
          <option value={60}>ab Relevanz 60</option>
          <option value={80}>ab Relevanz 80</option>
        </select>
        <button className="ghost sm" style={{ marginLeft: 'auto' }} onClick={() => setShowFeeds(!showFeeds)}>
          {feeds.length} Feeds verwalten
        </button>
      </div>

      {busy === 'curate' && <Working>Der Kurator prueft jede Meldung gegen die Kapitelstruktur deiner Arbeit…</Working>}
      <AgentError error={error?.error} offline={error?.offline} />

      {report && (
        <div className="notice">
          {report.map((r) => (
            <div key={r.feed} className="small">
              <span className={r.ok ? '' : 'dim'} style={{ color: r.ok ? undefined : 'var(--rose)' }}>
                {r.ok ? `${r.feed}: ${r.added} neu` : `${r.feed}: ${r.error}`}
              </span>
            </div>
          ))}
          {report.every((r) => !r.ok) && (
            <div className="small" style={{ marginTop: 8 }}>
              Kein Feed erreichbar. In abgeschotteten Netzen ist das erwartbar — die Feed-Adressen lassen
              sich unten anpassen.
            </div>
          )}
        </div>
      )}

      {showFeeds && <FeedManager feeds={feeds} onChange={load} />}

      <Panel title={`Meldungen (${shown.length})`} tight>
        {shown.length === 0 ? (
          <Empty>Noch nichts abgerufen. Starte mit „Quellen abrufen“.</Empty>
        ) : (
          shown.map((n) => (
            <div className="feed-item" key={n.id} style={{ opacity: n.state === 'verworfen' ? 0.4 : 1 }}>
              <div className={`rel ${(n.relevance ?? 0) >= 70 ? 'hi' : (n.relevance ?? 0) >= 40 ? 'mid' : ''}`}>
                {n.relevance ?? '–'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row tight" style={{ marginBottom: 4 }}>
                  <span className="tag plain">{n.feed_name}</span>
                  <span className="xsmall dim">{relDate(n.published_at)}</span>
                  {n.chapter_hint && n.chapter_hint.split(',').filter(Boolean).map((c) => (
                    <Tag key={c} tone="amber">{c.trim()}</Tag>
                  ))}
                  {n.citable === 'nein' && <Tag tone="rose">nicht zitierfaehig</Tag>}
                  {n.citable === 'nur_als_hinweis' && <Tag>nur Hinweis</Tag>}
                </div>
                <a href={n.url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-hi)' }}>{n.title}</a>
                {n.angle && <div className="small" style={{ marginTop: 5 }}>{n.angle}</div>}
                {!n.angle && n.summary && <div className="xsmall dim" style={{ marginTop: 5 }}>{n.summary.slice(0, 260)}</div>}
              </div>
              <div className="row tight" style={{ alignItems: 'flex-start' }}>
                {n.state === 'neu' && (
                  <>
                    <button className="sm" onClick={async () => {
                      await api.post(`/news/${n.id}/adopt`)
                      load()
                      reload()
                    }}>als Quelle</button>
                    <button className="sm ghost" onClick={async () => {
                      await api.patch(`/news/${n.id}`, { state: 'verworfen' })
                      load()
                    }}>×</button>
                  </>
                )}
                {n.state !== 'neu' && <Tag>{n.state}</Tag>}
              </div>
            </div>
          ))
        )}
      </Panel>
    </div>
  )
}

function FeedManager({ feeds, onChange }: { feeds: { id: number; name: string; url: string }[]; onChange: () => void }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')

  return (
    <Panel title="Feeds">
      <div className="stack sm" style={{ marginBottom: 14 }}>
        {feeds.map((f) => (
          <div className="row tight" key={f.id}>
            <span className="small" style={{ width: 220 }}>{f.name}</span>
            <span className="mono xsmall dim" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.url}</span>
            <button className="sm ghost danger" onClick={async () => {
              await api.del(`/feeds/${f.id}`)
              onChange()
            }}>×</button>
          </div>
        ))}
      </div>
      <div className="row">
        <input placeholder="Bezeichnung" value={name} onChange={(e) => setName(e.target.value)} style={{ width: 220 }} />
        <input placeholder="RSS- oder Atom-Adresse" value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 1 }} />
        <button disabled={!name || !url} onClick={async () => {
          await api.post('/feeds', { name, url })
          setName('')
          setUrl('')
          onChange()
        }}>hinzufuegen</button>
      </div>
    </Panel>
  )
}
