import { useCallback, useEffect, useState } from 'react'
import { api, type ReadingState, type Source } from '../lib/api'
import { AgentError, Bar, Empty, Panel, Tag, Working } from '../components/ui'
import { minutes, scoreClass } from '../lib/format'

export function ReadingRoom({
  sourceId, setSourceId, reload,
}: { sourceId: number | null; setSourceId: (id: number | null) => void; reload: () => void }) {
  const [sources, setSources] = useState<Source[]>([])
  useEffect(() => { api.get<Source[]>('/sources').then(setSources) }, [])

  if (!sourceId) {
    const queue = sources.filter((s) => s.status !== 'verworfen')
    return (
      <div className="stack">
        <div className="notice">
          Der Lesesaal fuehrt in sechs Stufen durch eine Quelle: Triage, Kartierung, Tiefenlesen,
          Rekonstruktion aus dem Gedaechtnis, kritische Wuerdigung, Verankerung. Der Tutor stellt Fragen
          und bewertet deine Antworten am Volltext — er fasst nichts vorweg zusammen.
        </div>
        <Panel title="Quelle waehlen" tight>
          {queue.length === 0 ? (
            <Empty>Noch keine Quelle erfasst. Lege im Bereich Quellen eine PDF ab.</Empty>
          ) : (
            queue.map((s) => (
              <div className="list-row clickable" key={s.id} onClick={() => setSourceId(s.id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'var(--text-hi)' }}>{s.title}</div>
                  <div className="xsmall dim">
                    {s.authors ?? '?'} {s.year ? `(${s.year})` : ''}
                    {!s.hasFullText && ' · ohne Volltext'}
                  </div>
                </div>
                <div style={{ width: 120 }}>
                  <div className="mono xsmall dim center">{s.internalization}%</div>
                  <Bar value={s.internalization} tone="teal" />
                </div>
                <button className="sm">oeffnen</button>
              </div>
            ))
          )}
        </Panel>
      </div>
    )
  }

  return <Session sourceId={sourceId} back={() => setSourceId(null)} reload={reload} />
}

function Session({ sourceId, back, reload }: { sourceId: number; back: () => void; reload: () => void }) {
  const [state, setState] = useState<ReadingState | null>(null)
  const [stage, setStage] = useState(0)
  const [intro, setIntro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ error?: string; offline?: boolean } | null>(null)

  const load = useCallback(async () => {
    const s = await api.get<ReadingState>(`/reading/${sourceId}`)
    setState(s)
    const firstOpen = s.perStage.find((p) => !p.complete)
    setStage(firstOpen ? firstOpen.stage : 5)
  }, [sourceId])

  useEffect(() => { load() }, [load])

  if (!state) return <Empty>Lade Lektuere…</Empty>

  const stageInfo = state.perStage[stage]
  const steps = state.steps.filter((s) => s.stage === stage)

  const askQuestions = async (regenerate = false) => {
    setBusy(true)
    setError(null)
    try {
      const r = await api.post<any>(`/reading/${sourceId}/stage/${stage}/questions`, { regenerate })
      if (r.intro) setIntro(r.intro)
      await load()
    } catch (e: any) {
      setError({ error: e.message, offline: e.payload?.offline })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <div className="row">
        <button className="ghost sm" onClick={back}>← andere Quelle</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>{state.source.title}</h2>
          <div className="xsmall dim">
            {state.source.authors ?? '?'} {state.source.year ? `(${state.source.year})` : ''}
            {!state.source.hasFullText && ' · kein Volltext hinterlegt'}
          </div>
        </div>
        <div style={{ width: 160 }}>
          <div className="spread xsmall">
            <span className="dim">durchdrungen</span>
            <span className="mono" style={{ color: 'var(--text-hi)' }}>{state.source.internalization}%</span>
          </div>
          <Bar value={state.source.internalization} tone={state.source.internalization >= 75 ? 'green' : 'teal'} />
        </div>
      </div>

      {!state.source.hasFullText && (
        <div className="notice warn">
          Zu dieser Quelle liegt kein extrahierter Volltext vor. Der Tutor kann deine Antworten nicht am
          Text pruefen und wird das in seiner Bewertung sagen. Lade die PDF nach, damit die Bewertung traegt.
        </div>
      )}

      <div className="stage-track">
        {state.perStage.map((p) => (
          <button
            key={p.stage}
            className={`stage-chip ${p.stage === stage ? 'current' : ''} ${p.complete ? 'done' : ''}`}
            onClick={() => { setStage(p.stage); setIntro(null) }}
          >
            <div className="n">STUFE {p.stage} · {minutes(p.minutes)}</div>
            <div className="nm">{p.name}</div>
            <div className="sc">{p.score != null ? `${p.score}%` : p.asked ? `${p.answered}/${p.asked}` : '–'}</div>
          </button>
        ))}
      </div>

      <Panel
        title={`Stufe ${stage} · ${stageInfo.name}`}
        note={stageInfo.aim}
        actions={
          steps.length > 0 ? (
            <button className="sm ghost" disabled={busy} onClick={() => askQuestions(true)}>neue Fragen</button>
          ) : null
        }
      >
        {stage === 3 && (
          <div className="notice warn" style={{ marginBottom: 14 }}>
            Leg den Text jetzt weg. Diese Stufe misst, was ohne Vorlage abrufbar ist — sie zaehlt am
            staerksten in den Verinnerlichungsgrad.
          </div>
        )}
        {stage === 4 && (
          <div className="notice" style={{ marginBottom: 14 }}>
            Der Tutor vertritt in dieser Stufe die Gegenposition. Verteidige die Quelle nur so weit,
            wie ihr Design es hergibt.
          </div>
        )}

        {intro && <div className="notice" style={{ marginBottom: 14 }}>{intro}</div>}
        {busy && <Working>Der Lesetutor arbeitet am Volltext…</Working>}
        <AgentError error={error?.error} offline={error?.offline} />

        {steps.length === 0 && !busy ? (
          <div className="center" style={{ padding: '24px 0' }}>
            <div className="dim small" style={{ marginBottom: 14 }}>
              Noch keine Leitfragen fuer diese Stufe.
            </div>
            <button className="primary" onClick={() => askQuestions(false)}>Leitfragen anfordern</button>
          </div>
        ) : (
          steps.map((s) => <Step key={s.id} step={s} onAnswered={() => { load(); reload() }} />)
        )}
      </Panel>

      {stage === 5 && state.source.internalization >= 75 && (
        <div className="notice good">
          Diese Quelle gilt als durchdrungen. Sie ist damit zitierfaehig — halte die Belegstellen im
          Quellen-Detail fest, dann kann der Integritaets-Waechter sie pruefen.
        </div>
      )}
    </div>
  )
}

function Step({ step, onAnswered }: { step: ReadingState['steps'][number]; onAnswered: () => void }) {
  const [answer, setAnswer] = useState(step.answer ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ error?: string; offline?: boolean } | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.post(`/reading/step/${step.id}/answer`, { answer })
      onAnswered()
    } catch (e: any) {
      setError({ error: e.message, offline: e.payload?.offline })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="qa">
      <div className="qa-q">
        <div className="q">{step.prompt}</div>
        {step.hint && <div className="hint">Nachsehen bei: {step.hint}</div>}
      </div>

      {step.score == null ? (
        <div className="qa-a">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Deine Antwort. In eigenen Worten — der Tutor prueft gegen den Volltext."
            style={{ minHeight: 110 }}
          />
          {error && <div style={{ marginTop: 10 }}><AgentError error={error.error} offline={error.offline} /></div>}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="primary" onClick={submit} disabled={busy || answer.trim().length < 10}>
              {busy ? 'wird bewertet…' : 'antworten'}
            </button>
            <span className="xsmall dim">{answer.trim().split(/\s+/).filter(Boolean).length} Woerter</span>
          </div>
        </div>
      ) : (
        <>
          <div className="qa-a">
            <div className="small pre" style={{ color: 'var(--text-hi)' }}>{step.answer}</div>
          </div>
          <div className="qa-f">
            <div className="row tight" style={{ marginBottom: 8 }}>
              <span className={`score-pill ${scoreClass(step.score)}`}>{step.score} / 100</span>
              {step.gaps.map((g, i) => <Tag key={i} tone="rose">{g}</Tag>)}
            </div>
            <div className="small pre">{step.feedback}</div>
          </div>
        </>
      )}
    </div>
  )
}
