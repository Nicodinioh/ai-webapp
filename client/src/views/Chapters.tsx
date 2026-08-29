import { useCallback, useEffect, useState } from 'react'
import { api, type ChapterFull, type Suggestion } from '../lib/api'
import { AgentError, Empty, Panel, Sheet, Tag, Verdict, Working } from '../components/ui'
import { KIND_LABEL, minutes, ROLE_LABEL, STATUS_TONE } from '../lib/format'

interface PlanResult {
  runId: number
  offline?: boolean
  error?: string
  plan: {
    lagebild: string
    gesamtaufwand_minuten: number
    vorher_entscheiden: string[]
    aufgaben: { titel: string; ergebnis: string; art: string; minuten: number; prioritaet: number; voraussetzung: string }[]
  } | null
}

export function Chapters({ reload }: { reload: () => void }) {
  const [chapters, setChapters] = useState<ChapterFull[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState<number | null>(null)
  const [planFor, setPlanFor] = useState<ChapterFull | null>(null)
  const [scoutFor, setScoutFor] = useState<ChapterFull | null>(null)

  const load = useCallback(() => {
    api.get<ChapterFull[]>('/chapters').then(setChapters)
    api.get<Suggestion[]>('/suggestions').then(setSuggestions)
  }, [])

  useEffect(load, [load])

  const refresh = () => {
    load()
    reload()
  }

  return (
    <div className="stack">
      {chapters.length === 0 && (
        <div className="notice">
          Noch keine Kapitelstruktur. Lege sie unten an - oder starte mit der Beispielarbeit
          ueber <span className="mono">npm run seed</span>.
        </div>
      )}

      {chapters.map((c) => {
        const openTasks = c.tasks.filter((t) => t.status === 'offen' || t.status === 'laeuft')
        const doneTasks = c.tasks.filter((t) => t.status === 'erledigt')
        const chapterSuggestions = suggestions.filter((s) => s.chapter_id === c.id && s.status === 'offen')
        const isOpen = open === c.id
        const indent = c.number.includes('.') ? 22 : 0

        return (
          <section className="panel" key={c.id} style={{ marginLeft: indent }}>
            <div className="panel-head">
              <Tag tone={c.sources.length ? 'amber' : 'rose'}>{c.number}</Tag>
              <h2 style={{ flex: 1 }}>{c.title}</h2>
              <Tag tone={STATUS_TONE[c.status]}>{c.status}</Tag>
              <span className="mono xsmall dim nowrap">
                {c.written_pages}/{c.target_pages} S.
              </span>
              <span className="mono xsmall dim nowrap">{minutes(c.openMinutes)} offen</span>
              <button className="sm" onClick={() => setOpen(isOpen ? null : c.id)}>
                {isOpen ? 'zuklappen' : 'oeffnen'}
              </button>
            </div>

            <div className="panel-body">
              {c.goal ? (
                <div className="small">
                  <span className="mono xsmall dim">BEWEISLAST </span>
                  {c.goal}
                </div>
              ) : (
                <div className="small dim">
                  Keine Beweislast hinterlegt. Ohne sie kann weder geplant noch gezielt recherchiert werden.
                </div>
              )}

              <div className="row tight" style={{ marginTop: 12 }}>
                <button className="sm" onClick={() => setPlanFor(c)}>Aufgaben planen</button>
                <button className="sm" onClick={() => setScoutFor(c)}>Quellen suchen</button>
                <span className="xsmall dim">
                  {c.sources.length} Quellen · {openTasks.length} offen · {doneTasks.length} erledigt
                  {chapterSuggestions.length > 0 && ` · ${chapterSuggestions.length} Vorschlaege`}
                </span>
              </div>

              {isOpen && (
                <div className="stack" style={{ marginTop: 16 }}>
                  <ChapterEditor chapter={c} onSaved={refresh} />

                  <div className="grid g2">
                    <div className="panel" style={{ background: 'var(--ink-000)' }}>
                      <div className="panel-head"><h3>Zugeordnete Quellen</h3></div>
                      {c.sources.length === 0 ? (
                        <Empty>Keine Quelle deckt diese Beweislast.</Empty>
                      ) : (
                        c.sources.map((s) => (
                          <div className="list-row" key={s.id}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="small" style={{ color: 'var(--text-hi)' }}>{s.title}</div>
                              <div className="xsmall dim">
                                {s.authors ?? '?'} {s.year ? `(${s.year})` : ''}
                              </div>
                            </div>
                            <Tag>{ROLE_LABEL[s.role] ?? s.role}</Tag>
                            <span className="mono xsmall dim nowrap">{s.internalization}%</span>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="panel" style={{ background: 'var(--ink-000)' }}>
                      <div className="panel-head"><h3>Aufgaben</h3></div>
                      {c.tasks.length === 0 ? (
                        <Empty>Noch nicht geplant.</Empty>
                      ) : (
                        c.tasks.map((t) => (
                          <div className="list-row" key={t.id}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="row tight" style={{ marginBottom: 3 }}>
                                <Tag>{KIND_LABEL[t.kind] ?? t.kind}</Tag>
                                <span className="mono xsmall dim">{minutes(t.estimate_min)}</span>
                                {t.status !== 'offen' && <Tag tone={STATUS_TONE[t.status]}>{t.status}</Tag>}
                              </div>
                              <div className="small" style={{
                                color: t.status === 'erledigt' ? 'var(--text-xlo)' : 'var(--text-hi)',
                                textDecoration: t.status === 'erledigt' ? 'line-through' : undefined,
                              }}>
                                {t.title}
                              </div>
                              {t.detail && <div className="xsmall dim" style={{ marginTop: 2 }}>{t.detail}</div>}
                            </div>
                            {t.status !== 'erledigt' && (
                              <button
                                className="sm ghost"
                                onClick={async () => {
                                  await api.patch(`/tasks/${t.id}`, {
                                    status: t.status === 'offen' ? 'laeuft' : 'erledigt',
                                  })
                                  refresh()
                                }}
                              >
                                {t.status === 'offen' ? '▷' : '✓'}
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {chapterSuggestions.length > 0 && (
                    <div className="panel" style={{ background: 'var(--ink-000)' }}>
                      <div className="panel-head"><h3>Quellenvorschlaege</h3></div>
                      {chapterSuggestions.map((s) => (
                        <SuggestionRow key={s.id} s={s} onChange={refresh} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )
      })}

      <NewChapter onCreated={refresh} />

      {planFor && <PlanSheet chapter={planFor} onClose={() => { setPlanFor(null); refresh() }} />}
      {scoutFor && <ScoutSheet chapter={scoutFor} onClose={() => { setScoutFor(null); refresh() }} />}
    </div>
  )
}

function ChapterEditor({ chapter, onSaved }: { chapter: ChapterFull; onSaved: () => void }) {
  const [goal, setGoal] = useState(chapter.goal ?? '')
  const [target, setTarget] = useState(String(chapter.target_pages ?? 0))
  const [written, setWritten] = useState(String(chapter.written_pages ?? 0))
  const [status, setStatus] = useState(chapter.status)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await api.patch(`/chapters/${chapter.id}`, {
      goal,
      target_pages: Number(target) || 0,
      written_pages: Number(written) || 0,
      status,
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="panel" style={{ background: 'var(--ink-000)' }}>
      <div className="panel-body">
        <label className="field">
          <span>Beweislast dieses Kapitels</span>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Was muss dieses Kapitel zeigen? Ein Satz, der eine Behauptung enthaelt."
            style={{ minHeight: 60 }}
          />
        </label>
        <div className="row">
          <label className="field" style={{ flex: 1, marginBottom: 0 }}>
            <span>Zielseiten</span>
            <input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" />
          </label>
          <label className="field" style={{ flex: 1, marginBottom: 0 }}>
            <span>Geschrieben</span>
            <input value={written} onChange={(e) => setWritten(e.target.value)} inputMode="decimal" />
          </label>
          <label className="field" style={{ flex: 1, marginBottom: 0 }}>
            <span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="offen">offen</option>
              <option value="entwurf">entwurf</option>
              <option value="ueberarbeitung">ueberarbeitung</option>
              <option value="fertig">fertig</option>
            </select>
          </label>
          <button className="primary" onClick={save} disabled={saving} style={{ alignSelf: 'flex-end' }}>
            {saving ? 'speichert…' : 'speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PlanSheet({ chapter, onClose }: { chapter: ChapterFull; onClose: () => void }) {
  const [state, setState] = useState<PlanResult | null>(null)
  const [busy, setBusy] = useState(true)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    api
      .post<PlanResult>(`/chapters/${chapter.id}/plan`)
      .then((r) => {
        setState(r)
        setPicked(new Set((r.plan?.aufgaben ?? []).map((_, i) => i)))
      })
      .catch((e) => setState({ runId: 0, error: e.message, plan: null }))
      .finally(() => setBusy(false))
  }, [chapter.id])

  const accept = async () => {
    if (!state?.plan) return
    const aufgaben = state.plan.aufgaben.filter((_, i) => picked.has(i))
    await api.post(`/chapters/${chapter.id}/plan/accept`, { aufgaben, runId: state.runId })
    setAccepted(true)
  }

  return (
    <Sheet
      title={`Arbeitsplaner · Kapitel ${chapter.number}`}
      subtitle="Der Agent schlaegt vor. Uebernommen wird, was du auswaehlst."
      onClose={onClose}
      wide
      footer={
        state?.plan && !accepted ? (
          <>
            <span className="xsmall dim" style={{ marginRight: 'auto', alignSelf: 'center' }}>
              {picked.size} von {state.plan.aufgaben.length} ausgewaehlt ·{' '}
              {minutes(state.plan.aufgaben.filter((_, i) => picked.has(i)).reduce((n, a) => n + a.minuten, 0))}
            </span>
            <button onClick={onClose}>abbrechen</button>
            <button className="primary" onClick={accept} disabled={picked.size === 0}>
              in den Plan uebernehmen
            </button>
          </>
        ) : (
          <button onClick={onClose}>schliessen</button>
        )
      }
    >
      {busy && <Working>Der Arbeitsplaner liest den Kapitelstand, die zugeordneten Quellen und die bereits geplanten Aufgaben…</Working>}
      <AgentError error={state?.error} offline={state?.offline} />

      {accepted && <div className="notice good">Aufgaben uebernommen. Sie stehen jetzt im Kapitel und im Cockpit.</div>}

      {state?.plan && !accepted && (
        <div className="stack">
          <div className="notice">{state.plan.lagebild}</div>

          {state.plan.vorher_entscheiden.length > 0 && (
            <div>
              <h3 style={{ marginBottom: 8 }}>Vorher zu entscheiden</h3>
              <ul style={{ margin: 0, paddingLeft: 18 }} className="small">
                {state.plan.vorher_entscheiden.map((v, i) => <li key={i}>{v}</li>)}
              </ul>
            </div>
          )}

          <div>
            <h3 style={{ marginBottom: 8 }}>
              Vorgeschlagene Aufgaben · Gesamtaufwand {minutes(state.plan.gesamtaufwand_minuten)}
            </h3>
            <div className="stack sm">
              {state.plan.aufgaben.map((a, i) => (
                <label
                  key={i}
                  className="panel"
                  style={{
                    padding: 12,
                    display: 'flex',
                    gap: 12,
                    cursor: 'pointer',
                    borderColor: picked.has(i) ? 'var(--amber-dim)' : undefined,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={picked.has(i)}
                    onChange={() => {
                      const next = new Set(picked)
                      next.has(i) ? next.delete(i) : next.add(i)
                      setPicked(next)
                    }}
                    style={{ width: 16, marginTop: 3 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row tight" style={{ marginBottom: 4 }}>
                      <Tag tone={a.prioritaet === 1 ? 'amber' : undefined}>{KIND_LABEL[a.art] ?? a.art}</Tag>
                      <span className="mono xsmall dim">{minutes(a.minuten)}</span>
                      {a.voraussetzung && a.voraussetzung !== 'keine' && (
                        <span className="xsmall" style={{ color: 'var(--rose)' }}>braucht: {a.voraussetzung}</span>
                      )}
                    </div>
                    <div style={{ color: 'var(--text-hi)' }}>{a.titel}</div>
                    <div className="xsmall dim" style={{ marginTop: 3 }}>Fertig, wenn: {a.ergebnis}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </Sheet>
  )
}

interface ScoutResult {
  runId: number
  offline?: boolean
  error?: string
  queries?: string[]
  notFound?: string
  suggestions: Suggestion[]
  citations: { title: string; url: string }[]
}

function ScoutSheet({ chapter, onClose }: { chapter: ChapterFull; onClose: () => void }) {
  const [gap, setGap] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<ScoutResult | null>(null)

  const search = async () => {
    setBusy(true)
    setRes(null)
    try {
      setRes(await api.post<ScoutResult>(`/chapters/${chapter.id}/scout`, { gap }))
    } catch (e) {
      setRes({ runId: 0, error: (e as Error).message, suggestions: [], citations: [] })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      title={`Quellen-Scout · Kapitel ${chapter.number}`}
      subtitle="Sucht zu einer benannten Beweislast, nicht zum Thema. Jeder Vorschlag stammt aus einem echten Suchtreffer."
      onClose={onClose}
      wide
    >
      <div className="stack">
        <div className="notice">
          <span className="mono xsmall dim">BEWEISLAST </span>
          {chapter.goal || 'nicht hinterlegt - der Scout leitet sie aus Titel und Projektbriefing ab'}
        </div>

        <label className="field">
          <span>Welche Luecke soll geschlossen werden?</span>
          <textarea
            value={gap}
            onChange={(e) => setGap(e.target.value)}
            placeholder="Zum Beispiel: Es fehlt ein Beleg dafuer, dass die Betreiberpflichten nach Art. 26 AI Act auch bei bezogener Software beim Institut liegen."
          />
        </label>
        <button className="primary" onClick={search} disabled={busy}>
          {busy ? 'sucht…' : 'Websuche starten'}
        </button>

        {busy && <Working>Der Scout formuliert Suchanfragen, prueft Treffer gegen die Beweislast und verwirft, was nur thematisch passt.</Working>}
        <AgentError error={res?.error} offline={res?.offline} />

        {res?.queries && res.queries.length > 0 && (
          <div className="small dim">
            <span className="mono xsmall">SUCHANFRAGEN </span>
            {res.queries.join(' · ')}
          </div>
        )}

        {res?.suggestions.map((s) => <SuggestionRow key={s.id} s={s} onChange={() => {}} />)}

        {res?.notFound && (
          <div className="notice warn">
            <strong>Nicht gefunden:</strong> {res.notFound}
          </div>
        )}
        {res && res.suggestions.length > 0 && <Verdict runId={res.runId} />}
      </div>
    </Sheet>
  )
}

function SuggestionRow({ s, onChange }: { s: Suggestion; onChange: () => void }) {
  const [state, setState] = useState(s.status)

  const act = async (status: string) => {
    if (status === 'uebernommen') await api.post(`/suggestions/${s.id}/adopt`)
    else await api.patch(`/suggestions/${s.id}`, { status })
    setState(status)
    onChange()
  }

  return (
    <div className="list-row" style={{ opacity: state === 'verworfen' ? 0.45 : 1 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row tight" style={{ marginBottom: 4 }}>
          <Tag tone={s.verified ? 'green' : 'rose'}>{s.verified ? 'suchtreffer belegt' : 'ungeprueft'}</Tag>
          {s.evidence && <Tag>{s.evidence}</Tag>}
          <span className="mono xsmall dim">Vertrauen {s.confidence}%</span>
        </div>
        <div style={{ color: 'var(--text-hi)' }}>{s.title}</div>
        <div className="xsmall dim">
          {s.authors ?? '?'} {s.year ? `(${s.year})` : ''} {s.venue ? `· ${s.venue}` : ''}
        </div>
        {s.gap && <div className="xsmall" style={{ marginTop: 5 }}>Schliesst: {s.gap}</div>}
        {s.url && (
          <a className="xsmall mono" href={s.url} target="_blank" rel="noreferrer">
            {s.url.slice(0, 90)}
          </a>
        )}
      </div>
      {state === 'offen' ? (
        <div className="row tight">
          <button className="sm" onClick={() => act('uebernommen')}>uebernehmen</button>
          <button className="sm ghost danger" onClick={() => act('verworfen')}>verwerfen</button>
        </div>
      ) : (
        <Tag tone={state === 'uebernommen' ? 'green' : 'rose'}>{state}</Tag>
      )}
    </div>
  )
}

function NewChapter({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [number, setNumber] = useState('')
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  const [pages, setPages] = useState('2')

  if (!open) {
    return (
      <div>
        <button onClick={() => setOpen(true)}>+ Kapitel anlegen</button>
      </div>
    )
  }

  return (
    <Panel title="Neues Kapitel">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <label className="field" style={{ width: 110 }}>
          <span>Nummer</span>
          <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="2.4" />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span>Titel</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field" style={{ width: 110 }}>
          <span>Zielseiten</span>
          <input value={pages} onChange={(e) => setPages(e.target.value)} inputMode="decimal" />
        </label>
      </div>
      <label className="field">
        <span>Beweislast</span>
        <textarea value={goal} onChange={(e) => setGoal(e.target.value)} style={{ minHeight: 56 }} />
      </label>
      <div className="row">
        <button
          className="primary"
          disabled={!number || !title}
          onClick={async () => {
            await api.post('/chapters', { number, title, goal, target_pages: Number(pages) || 0 })
            setOpen(false)
            setNumber('')
            setTitle('')
            setGoal('')
            onCreated()
          }}
        >
          anlegen
        </button>
        <button className="ghost" onClick={() => setOpen(false)}>abbrechen</button>
      </div>
    </Panel>
  )
}
