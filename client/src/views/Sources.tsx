import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type Chapter, type Source } from '../lib/api'
import { AgentError, Empty, Panel, Sheet, Tag, Verdict, Working } from '../components/ui'
import { EVIDENCE_LABEL, relDate, ROLE_LABEL, STATUS_TONE } from '../lib/format'

export function Sources({ reload, openReading }: { reload: () => void; openReading: (id: number) => void }) {
  const [items, setItems] = useState<Source[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [tags, setTags] = useState<{ id: number; name: string; kind: string; uses: number }[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [tag, setTag] = useState('')
  const [detail, setDetail] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (status) params.set('status', status)
    if (tag) params.set('tag', tag)
    api.get<Source[]>(`/sources?${params}`).then(setItems)
    api.get<{ id: number; name: string; kind: string; uses: number }[]>('/tags').then(setTags)
  }, [query, status, tag])

  useEffect(load, [load])
  useEffect(() => { api.get<{ chapters: Chapter[] }>('/project').then((p) => setChapters(p.chapters)) }, [])

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      try {
        await api.post<Source>('/sources', fd)
      } catch (e) {
        alert(`${file.name}: ${(e as Error).message}`)
      }
    }
    setUploading(false)
    load()
    reload()
  }

  return (
    <div className="stack">
      <Panel
        title="Erfassung"
        note="PDF ablegen - der Volltext wird seitenweise extrahiert, damit Fundstellen belegbar bleiben"
      >
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files) }}
          style={{
            border: '1px dashed var(--ink-300)',
            borderRadius: 'var(--radius)',
            padding: '26px 20px',
            textAlign: 'center',
            cursor: 'pointer',
          }}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Working>Datei wird gelesen und der Volltext extrahiert…</Working>
          ) : (
            <>
              <div style={{ color: 'var(--text-hi)' }}>PDF hierher ziehen oder klicken</div>
              <div className="xsmall dim" style={{ marginTop: 5 }}>
                Mehrfachauswahl moeglich. Scans ohne Textebene werden erkannt und markiert.
              </div>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => upload(e.target.files)}
          />
        </div>
        <ManualSource onCreated={() => { load(); reload() }} />
      </Panel>

      <div className="row">
        <input
          placeholder="Suche in Titel, Urheberschaft, Kernthese…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 170 }}>
          <option value="">alle Status</option>
          {['eingang', 'triage', 'lesen', 'verinnerlicht', 'zitiert', 'verworfen'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={tag} onChange={(e) => setTag(e.target.value)} style={{ width: 200 }}>
          <option value="">alle Schlagworte</option>
          {tags.map((t) => (
            <option key={t.id} value={t.name}>{t.name} ({t.uses})</option>
          ))}
        </select>
      </div>

      <Panel title={`Quellen (${items.length})`} tight>
        {items.length === 0 ? (
          <Empty>Keine Quelle gefunden.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Titel</th>
                  <th>Urheberschaft</th>
                  <th>Kapitel</th>
                  <th>Evidenz</th>
                  <th>Status</th>
                  <th>Durchdrungen</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="clickable" onClick={() => setDetail(s.id)}>
                    <td>
                      <div style={{ color: 'var(--text-hi)' }}>{s.title}</div>
                      {s.core_claim && <div className="xsmall dim" style={{ marginTop: 2 }}>{s.core_claim}</div>}
                      <div className="row tight" style={{ marginTop: 5 }}>
                        {s.tags.slice(0, 4).map((t) => (
                          <span key={t.id} className="tag plain">{t.name}</span>
                        ))}
                        {!s.hasFullText && <Tag tone="rose">kein Volltext</Tag>}
                      </div>
                    </td>
                    <td className="small nowrap">
                      {s.authors ?? '–'}
                      <div className="xsmall dim">{s.year ?? relDate(s.added_at)}</div>
                    </td>
                    <td>
                      <div className="row tight">
                        {s.chapters.length === 0 && <span className="xsmall dim">–</span>}
                        {s.chapters.map((c) => (
                          <Tag key={c.id} tone={c.role === 'kern' ? 'amber' : undefined}>{c.number}</Tag>
                        ))}
                      </div>
                    </td>
                    <td className="xsmall dim nowrap">{EVIDENCE_LABEL[s.evidence] ?? s.evidence}</td>
                    <td><Tag tone={STATUS_TONE[s.status]}>{s.status}</Tag></td>
                    <td style={{ width: 90 }}>
                      <div className="mono xsmall dim">{s.internalization}%</div>
                      <div className="bar teal" style={{ marginTop: 4 }}>
                        <i style={{ width: `${s.internalization}%` }} />
                      </div>
                    </td>
                    <td>
                      <button
                        className="sm"
                        onClick={(e) => { e.stopPropagation(); openReading(s.id) }}
                      >
                        Lesesaal
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {detail != null && (
        <SourceSheet
          id={detail}
          chapters={chapters}
          onClose={() => { setDetail(null); load(); reload() }}
          openReading={openReading}
        />
      )}
    </div>
  )
}

function ManualSource({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', authors: '', year: '', venue: '', url: '', kind: 'artikel', evidence: 'unbekannt' })

  if (!open) {
    return (
      <button className="ghost sm" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>
        oder ohne Datei erfassen (Rechtstext, Buch, Webquelle)
      </button>
    )
  }

  const set = (k: string, v: string) => setForm({ ...form, [k]: v })

  return (
    <div style={{ marginTop: 14 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <label className="field" style={{ flex: 2 }}><span>Titel</span>
          <input value={form.title} onChange={(e) => set('title', e.target.value)} /></label>
        <label className="field" style={{ flex: 1 }}><span>Urheberschaft</span>
          <input value={form.authors} onChange={(e) => set('authors', e.target.value)} /></label>
        <label className="field" style={{ width: 90 }}><span>Jahr</span>
          <input value={form.year} onChange={(e) => set('year', e.target.value)} /></label>
      </div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <label className="field" style={{ flex: 1 }}><span>Erscheinungsort</span>
          <input value={form.venue} onChange={(e) => set('venue', e.target.value)} /></label>
        <label className="field" style={{ flex: 1 }}><span>URL</span>
          <input value={form.url} onChange={(e) => set('url', e.target.value)} /></label>
        <label className="field" style={{ width: 160 }}><span>Typ</span>
          <select value={form.kind} onChange={(e) => set('kind', e.target.value)}>
            {['artikel', 'rechtsakt', 'aufsichtsdokument', 'buch', 'studie', 'bericht', 'web'].map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select></label>
        <label className="field" style={{ width: 160 }}><span>Evidenzstufe</span>
          <select value={form.evidence} onChange={(e) => set('evidence', e.target.value)}>
            {Object.entries(EVIDENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
      </div>
      <div className="row">
        <button className="primary" disabled={!form.title} onClick={async () => {
          const fd = new FormData()
          Object.entries(form).forEach(([k, v]) => v && fd.append(k, v))
          await api.post('/sources', fd)
          setOpen(false)
          setForm({ title: '', authors: '', year: '', venue: '', url: '', kind: 'artikel', evidence: 'unbekannt' })
          onCreated()
        }}>erfassen</button>
        <button className="ghost" onClick={() => setOpen(false)}>abbrechen</button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ Detailansicht */

const AGENT_ACTIONS = [
  { id: 'triage', label: 'Triage', hint: 'Eckdaten, Kernthese, Votum, Kapitelvorschlag' },
  { id: 'analyst', label: 'Analyse', hint: 'Fragestellung, Design, Befunde, Belegstellen' },
  { id: 'critic', label: 'Methodenkritik', hint: 'Evidenzstaerke, Belegdehnung, Zitierempfehlung' },
  { id: 'architect', label: 'Verortung', hint: 'Kapitelzuordnung mit Rolle und Begruendung' },
]

function SourceSheet({
  id, chapters, onClose, openReading,
}: { id: number; chapters: Chapter[]; onClose: () => void; openReading: (id: number) => void }) {
  const [source, setSource] = useState<Source | null>(null)
  const [tab, setTab] = useState<'stamm' | 'agenten' | 'belege'>('stamm')
  const load = useCallback(() => { api.get<Source>(`/sources/${id}`).then(setSource) }, [id])
  useEffect(load, [load])

  if (!source) return null

  return (
    <Sheet
      title={source.title}
      subtitle={`${source.authors ?? 'ohne Urheberangabe'}${source.year ? ` · ${source.year}` : ''}${source.venue ? ` · ${source.venue}` : ''}${source.page_count ? ` · ${source.page_count} Seiten` : ''}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="danger ghost" style={{ marginRight: 'auto' }} onClick={async () => {
            if (confirm('Quelle mitsamt Belegstellen und Lesefortschritt loeschen?')) {
              await api.del(`/sources/${id}`)
              onClose()
            }
          }}>loeschen</button>
          {source.hasFullText && <a className="btn" href={`/api/sources/${id}/pdf`} target="_blank" rel="noreferrer">PDF oeffnen</a>}
          <button className="primary" onClick={() => { onClose(); openReading(id) }}>in den Lesesaal</button>
        </>
      }
    >
      <div className="row tight" style={{ marginBottom: 16 }}>
        {(['stamm', 'agenten', 'belege'] as const).map((t) => (
          <button key={t} className={tab === t ? 'primary sm' : 'sm'} onClick={() => setTab(t)}>
            {t === 'stamm' ? 'Stammdaten' : t === 'agenten' ? 'Agenten' : `Belegstellen (${source.excerpts.length})`}
          </button>
        ))}
        <span style={{ marginLeft: 'auto' }} className="row tight">
          <Tag tone={STATUS_TONE[source.status]}>{source.status}</Tag>
          <span className="mono xsmall dim">{source.internalization}% durchdrungen</span>
        </span>
      </div>

      {tab === 'stamm' && <StammTab source={source} chapters={chapters} reload={load} />}
      {tab === 'agenten' && <AgentTab source={source} reload={load} />}
      {tab === 'belege' && <BelegTab source={source} chapters={chapters} reload={load} />}
    </Sheet>
  )
}

function StammTab({ source, chapters, reload }: { source: Source; chapters: Chapter[]; reload: () => void }) {
  const [form, setForm] = useState({
    title: source.title, authors: source.authors ?? '', year: String(source.year ?? ''),
    venue: source.venue ?? '', url: source.url ?? '', kind: source.kind, evidence: source.evidence,
    status: source.status, core_claim: source.core_claim ?? '', notes: source.notes ?? '',
  })
  const [newTag, setNewTag] = useState('')
  const set = (k: string, v: string) => setForm({ ...form, [k]: v })

  return (
    <div className="stack">
      {!source.hasFullText && (
        <div className="notice warn">
          Kein extrahierter Volltext. Die Agenten koennen ueber den Inhalt nichts sagen - sie arbeiten
          dann nur mit den Stammdaten und weisen darauf hin.
        </div>
      )}

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <label className="field" style={{ flex: 2 }}><span>Titel</span>
          <input value={form.title} onChange={(e) => set('title', e.target.value)} /></label>
        <label className="field" style={{ flex: 1 }}><span>Urheberschaft</span>
          <input value={form.authors} onChange={(e) => set('authors', e.target.value)} /></label>
        <label className="field" style={{ width: 90 }}><span>Jahr</span>
          <input value={form.year} onChange={(e) => set('year', e.target.value)} /></label>
      </div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <label className="field" style={{ flex: 1 }}><span>Erscheinungsort</span>
          <input value={form.venue} onChange={(e) => set('venue', e.target.value)} /></label>
        <label className="field" style={{ width: 150 }}><span>Evidenzstufe</span>
          <select value={form.evidence} onChange={(e) => set('evidence', e.target.value)}>
            {Object.entries(EVIDENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
        <label className="field" style={{ width: 150 }}><span>Status</span>
          <select value={form.status} onChange={(e) => set('status', e.target.value)}>
            {['eingang', 'triage', 'lesen', 'verinnerlicht', 'zitiert', 'verworfen'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select></label>
      </div>
      <label className="field"><span>Kernthese in einem Satz</span>
        <input value={form.core_claim} onChange={(e) => set('core_claim', e.target.value)} /></label>
      <label className="field"><span>Notizen</span>
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} /></label>
      <button className="primary" onClick={async () => {
        await api.patch(`/sources/${source.id}`, { ...form, year: form.year ? Number(form.year) : null })
        reload()
      }}>speichern</button>

      <div className="grid g2">
        <Panel title="Schlagworte">
          <div className="row tight" style={{ marginBottom: 10 }}>
            {source.tags.length === 0 && <span className="xsmall dim">noch keine</span>}
            {source.tags.map((t) => (
              <span key={t.id} className="tag plain">
                {t.name}
                <button className="ghost sm" style={{ padding: 0, marginLeft: 2 }} onClick={async () => {
                  await api.del(`/sources/${source.id}/tags/${t.id}`)
                  reload()
                }}>×</button>
              </span>
            ))}
          </div>
          <div className="row tight">
            <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="neues Schlagwort" style={{ flex: 1 }} />
            <button className="sm" disabled={!newTag.trim()} onClick={async () => {
              await api.post(`/sources/${source.id}/tags`, { tags: [{ name: newTag.trim() }] })
              setNewTag('')
              reload()
            }}>+</button>
          </div>
        </Panel>

        <Panel title="Kapitelzuordnung">
          <div className="stack sm">
            {source.chapters.map((c) => (
              <div key={c.id} className="row tight">
                <Tag tone="amber">{c.number}</Tag>
                <span className="small" style={{ flex: 1, minWidth: 0 }}>{c.title}</span>
                <Tag>{ROLE_LABEL[c.role] ?? c.role}</Tag>
                <button className="ghost sm danger" onClick={async () => {
                  await api.del(`/sources/${source.id}/chapters/${c.id}`)
                  reload()
                }}>×</button>
              </div>
            ))}
            {source.chapters.length === 0 && <span className="xsmall dim">noch keinem Kapitel zugeordnet</span>}
            <select defaultValue="" onChange={async (e) => {
              if (!e.target.value) return
              await api.post(`/sources/${source.id}/chapters`, {
                chapters: [{ chapter_id: Number(e.target.value), role: 'beleg', relevance: 3 }],
              })
              e.target.value = ''
              reload()
            }}>
              <option value="">Kapitel hinzufuegen…</option>
              {chapters.map((c) => <option key={c.id} value={c.id}>{c.number} {c.title}</option>)}
            </select>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function AgentTab({ source, reload }: { source: Source; reload: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<{ agent: string; runId: number; error?: string; offline?: boolean; data: any } | null>(null)

  const runAgent = async (agentId: string) => {
    setBusy(agentId)
    setResult(null)
    try {
      const r = await api.post<any>(`/sources/${source.id}/agent/${agentId}`)
      setResult({ agent: agentId, runId: r.runId, error: r.error, offline: r.offline, data: r.result })
    } catch (e) {
      setResult({ agent: agentId, runId: 0, error: (e as Error).message, data: null })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="stack">
      <div className="grid g2">
        {AGENT_ACTIONS.map((a) => (
          <button key={a.id} onClick={() => runAgent(a.id)} disabled={busy !== null}
            style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 12, textAlign: 'left' }}>
            <span style={{ color: 'var(--text-hi)', fontWeight: 600 }}>
              {busy === a.id ? <span className="spinner" style={{ marginRight: 6 }} /> : null}
              {a.label}
            </span>
            <span className="xsmall dim">{a.hint}</span>
          </button>
        ))}
      </div>

      {busy && <Working>Der Agent liest den Volltext. Bei langen Dokumenten dauert das eine Weile.</Working>}
      <AgentError error={result?.error} offline={result?.offline} />

      {result?.data && (
        <div className="panel">
          <div className="panel-head">
            <h3>{AGENT_ACTIONS.find((a) => a.id === result.agent)?.label}</h3>
            {(result.agent === 'triage' || result.agent === 'architect') && (
              <button className="primary sm" onClick={async () => {
                await api.post(`/sources/${source.id}/agent/${result.agent}/accept`,
                  result.agent === 'triage'
                    ? { result: result.data, runId: result.runId }
                    : { zuordnungen: result.data.zuordnungen, runId: result.runId })
                setResult(null)
                reload()
              }}>uebernehmen</button>
            )}
          </div>
          <div className="panel-body">
            <AgentOutput agent={result.agent} data={result.data} />
            <Verdict runId={result.runId} onDone={reload} />
          </div>
        </div>
      )}
    </div>
  )
}

function AgentOutput({ agent, data }: { agent: string; data: any }) {
  if (agent === 'triage') {
    return (
      <div className="stack sm">
        <div className="row tight">
          <Tag tone={data.votum === 'bearbeiten' ? 'green' : data.votum === 'verwerfen' ? 'rose' : 'amber'}>
            {data.votum}
          </Tag>
          <Tag>{data.typ}</Tag>
          <Tag>{EVIDENCE_LABEL[data.evidenzstufe] ?? data.evidenzstufe}</Tag>
          <span className="mono xsmall dim">Lesezeit ca. {data.lesezeit_minuten} min</span>
        </div>
        <dl className="kv">
          <dt>Kernthese</dt><dd>{data.kernthese}</dd>
          <dt>Methode</dt><dd>{data.methode}</dd>
          <dt>Begruendung</dt><dd>{data.begruendung}</dd>
          <dt>Kapitel</dt>
          <dd>
            {(data.kapitel ?? []).map((k: any, i: number) => (
              <div key={i} style={{ marginBottom: 4 }}>
                <Tag tone="amber">{k.nummer}</Tag> <Tag>{ROLE_LABEL[k.rolle] ?? k.rolle}</Tag>{' '}
                <span className="xsmall dim">{k.begruendung}</span>
              </div>
            ))}
          </dd>
          <dt>Schlagworte</dt>
          <dd className="row tight">
            {(data.schlagworte ?? []).map((t: any, i: number) => <span key={i} className="tag plain">{t.name}</span>)}
          </dd>
        </dl>
        {data.offene_pruefpunkte?.length > 0 && (
          <div className="notice warn">
            <strong>Am Original zu pruefen:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {data.offene_pruefpunkte.map((p: string, i: number) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        )}
      </div>
    )
  }

  if (agent === 'analyst') {
    return (
      <div className="stack sm">
        <dl className="kv">
          <dt>Fragestellung</dt><dd>{data.fragestellung}</dd>
          <dt>Design</dt><dd>{data.design}</dd>
          <dt>Datengrundlage</dt><dd>{data.datengrundlage}</dd>
          <dt>Hauptbefund</dt><dd>{data.hauptbefund}</dd>
          <dt>Gilt fuer</dt><dd>{data.reichweite?.gilt_fuer}</dd>
          <dt>Gilt nicht fuer</dt><dd style={{ color: 'var(--rose)' }}>{data.reichweite?.gilt_nicht_fuer}</dd>
        </dl>
        {data.belegstellen?.length > 0 && (
          <>
            <h3 style={{ marginTop: 8 }}>Belegstellen</h3>
            {data.belegstellen.map((b: any, i: number) => (
              <div key={i} className="panel" style={{ padding: 12, background: 'var(--ink-000)' }}>
                <div className="mono xsmall dim">{b.fundstelle}</div>
                <div className="small" style={{ margin: '5px 0', color: 'var(--text-hi)' }}>„{b.zitat}“</div>
                <div className="xsmall dim">Traegt fuer: {b.traegt_fuer}</div>
              </div>
            ))}
          </>
        )}
        <div className="xsmall dim">Materiallage: {data.materiallage}</div>
      </div>
    )
  }

  if (agent === 'critic') {
    return (
      <div className="stack sm">
        <div className="row tight">
          <span className="mono small">Evidenzstaerke</span>
          <div className="bar" style={{ flex: 1, maxWidth: 200 }}>
            <i style={{ width: `${data.evidenzstaerke}%` }} />
          </div>
          <span className="mono small">{data.evidenzstaerke}/100</span>
        </div>
        <div>
          {(data.achsen ?? []).map((a: any, i: number) => (
            <div className="axis-row" key={i}>
              <span className="axis-name">{a.achse}</span>
              <Tag tone={a.urteil === 'stark' ? 'green' : a.urteil === 'schwach' ? 'rose' : a.urteil === 'tragfaehig' ? 'teal' : undefined}>
                {a.urteil}
              </Tag>
              <span className="small" style={{ flex: 1 }}>{a.begruendung}</span>
            </div>
          ))}
        </div>
        {data.belegdehnung?.length > 0 && (
          <div className="notice bad">
            <strong>Belegdehnung</strong>
            {data.belegdehnung.map((b: any, i: number) => (
              <div key={i} style={{ marginTop: 8 }}>
                <div className="xsmall mono dim">{b.stelle}</div>
                <div className="small">behauptet: {b.behauptung_im_text}</div>
                <div className="small" style={{ color: 'var(--green)' }}>gedeckt: {b.gedeckte_fassung}</div>
              </div>
            ))}
          </div>
        )}
        <dl className="kv">
          <dt>Traegt fuer</dt><dd style={{ color: 'var(--green)' }}>{data.traegt_fuer}</dd>
          <dt>Traegt nicht fuer</dt><dd style={{ color: 'var(--rose)' }}>{data.traegt_nicht_fuer}</dd>
          <dt>Mit Einschraenkung</dt><dd>{data.nur_mit_einschraenkung}</dd>
        </dl>
        {data.offene_gegenrecherche?.length > 0 && (
          <div className="notice">
            <strong>Gegenrecherche:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {data.offene_gegenrecherche.map((g: string, i: number) => <li key={i}>{g}</li>)}
            </ul>
          </div>
        )}
      </div>
    )
  }

  if (agent === 'architect') {
    return (
      <div className="stack sm">
        {(data.zuordnungen ?? []).map((z: any, i: number) => (
          <div key={i} className="row tight" style={{ alignItems: 'flex-start' }}>
            <Tag tone="amber">{z.kapitel_nummer}</Tag>
            <Tag>{ROLE_LABEL[z.rolle] ?? z.rolle}</Tag>
            <span className="mono xsmall dim">Rel. {z.relevanz}</span>
            <span className="small" style={{ flex: 1 }}>{z.begruendung}</span>
          </div>
        ))}
        <dl className="kv">
          <dt>Redundanz</dt><dd>{data.redundanz}</dd>
          <dt>Nicht verwenden</dt><dd>{data.gehoert_nicht_hinein}</dd>
        </dl>
        {data.offene_beweislast?.length > 0 && (
          <div className="notice warn">
            <strong>Ungedeckte Beweislast:</strong>
            {data.offene_beweislast.map((o: any, i: number) => (
              <div key={i} className="small">{o.kapitel_nummer}: {o.luecke}</div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return <pre className="pre small">{JSON.stringify(data, null, 2)}</pre>
}

function BelegTab({ source, chapters, reload }: { source: Source; chapters: Chapter[]; reload: () => void }) {
  const [form, setForm] = useState({ page: '', quote: '', paraphrase: '', kind: 'paraphrase', chapter_id: '' })
  const [check, setCheck] = useState<{ id: number; runId: number; data: any; error?: string; offline?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <div className="stack">
      {source.excerpts.map((e) => (
        <div className="panel" key={e.id} style={{ padding: 14 }}>
          <div className="row tight" style={{ marginBottom: 6 }}>
            <Tag tone={e.kind === 'zitat' ? 'amber' : e.kind === 'eigenleistung' ? 'violet' : 'teal'}>{e.kind}</Tag>
            <span className="mono xsmall dim">{e.page ? `S. ${e.page}` : 'ohne Seitenangabe'}</span>
            {e.chapter_id && <Tag>{chapters.find((c) => c.id === e.chapter_id)?.number}</Tag>}
            {e.verified ? <Tag tone="green">geprueft</Tag> : null}
            <span style={{ marginLeft: 'auto' }} className="row tight">
              <button className="sm" disabled={busy} onClick={async () => {
                setBusy(true)
                try {
                  const r = await api.post<any>(`/excerpts/${e.id}/check`)
                  setCheck({ id: e.id, runId: r.runId, data: r.check, error: r.error, offline: r.offline })
                } finally { setBusy(false) }
              }}>Waechter pruefen lassen</button>
              <button className="sm ghost danger" onClick={async () => {
                await api.del(`/excerpts/${e.id}`)
                reload()
              }}>×</button>
            </span>
          </div>
          {e.quote && <div className="small" style={{ color: 'var(--text-hi)' }}>„{e.quote}“</div>}
          {e.paraphrase && <div className="small dim" style={{ marginTop: 6 }}>{e.paraphrase}</div>}

          {check?.id === e.id && (
            <div style={{ marginTop: 12 }}>
              <AgentError error={check.error} offline={check.offline} />
              {check.data && (
                <div className="panel" style={{ padding: 12, background: 'var(--ink-000)' }}>
                  <div className="row tight" style={{ marginBottom: 8 }}>
                    <Tag tone={check.data.deckung === 'gedeckt' ? 'green' : check.data.deckung === 'nicht_pruefbar' ? undefined : 'rose'}>
                      Deckung: {check.data.deckung}
                    </Tag>
                    <Tag tone={check.data.paraphrase_urteil === 'eigenstaendig' ? 'green' : 'rose'}>
                      {check.data.paraphrase_urteil}
                    </Tag>
                  </div>
                  <dl className="kv">
                    <dt>Gedeckte Fassung</dt><dd>{check.data.gedeckte_fassung}</dd>
                    <dt>Paraphrase</dt><dd>{check.data.paraphrase_hinweis}</dd>
                    <dt>Kennzeichnung</dt><dd>{check.data.kennzeichnung}</dd>
                    <dt>Belegform</dt><dd className="mono xsmall">{check.data.formvorschlag}</dd>
                  </dl>
                  {check.data.am_original_pruefen?.length > 0 && (
                    <div className="notice warn" style={{ marginTop: 10 }}>
                      <strong>Am Original pruefen:</strong>
                      <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                        {check.data.am_original_pruefen.map((p: string, i: number) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                  )}
                  <div className="row tight" style={{ marginTop: 10 }}>
                    <button className="sm" onClick={async () => {
                      await api.patch(`/excerpts/${e.id}`, { verified: 1 })
                      await api.patch(`/runs/${check.runId}`, { verdict: 'uebernommen', verdict_note: 'Am Original geprueft' })
                      setCheck(null)
                      reload()
                    }}>am Original geprueft</button>
                    <Verdict runId={check.runId} onDone={() => setCheck(null)} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      <Panel title="Belegstelle erfassen">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <label className="field" style={{ width: 110 }}><span>Seite</span>
            <input value={form.page} onChange={(e) => setForm({ ...form, page: e.target.value })} placeholder="14" /></label>
          <label className="field" style={{ width: 150 }}><span>Art</span>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="zitat">Zitat</option>
              <option value="paraphrase">Paraphrase</option>
              <option value="eigenleistung">Eigenleistung</option>
            </select></label>
          <label className="field" style={{ flex: 1 }}><span>Kapitel</span>
            <select value={form.chapter_id} onChange={(e) => setForm({ ...form, chapter_id: e.target.value })}>
              <option value="">–</option>
              {chapters.map((c) => <option key={c.id} value={c.id}>{c.number} {c.title}</option>)}
            </select></label>
        </div>
        <label className="field"><span>Woertliche Stelle aus der Quelle</span>
          <textarea value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} style={{ minHeight: 60 }} /></label>
        <label className="field"><span>Dein Satz in der Arbeit</span>
          <textarea value={form.paraphrase} onChange={(e) => setForm({ ...form, paraphrase: e.target.value })} style={{ minHeight: 60 }} /></label>
        <button className="primary" disabled={!form.quote && !form.paraphrase} onClick={async () => {
          await api.post(`/sources/${source.id}/excerpts`, {
            ...form,
            chapter_id: form.chapter_id ? Number(form.chapter_id) : null,
          })
          setForm({ page: '', quote: '', paraphrase: '', kind: 'paraphrase', chapter_id: '' })
          reload()
        }}>erfassen</button>
      </Panel>
    </div>
  )
}
