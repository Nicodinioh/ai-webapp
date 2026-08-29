import { api, type Dashboard, type Task } from '../lib/api'
import { Bar, Empty, Panel, Stat, Tag } from '../components/ui'
import { KIND_LABEL, minutes } from '../lib/format'
import type { View } from '../App'

export function Cockpit({
  dash, reload, go, openReading,
}: { dash: Dashboard | null; reload: () => void; go: (v: View) => void; openReading: (id: number) => void }) {
  if (!dash) return <Empty>Lade Lagebild…</Empty>

  const openTasks = dash.tasks.find((t) => t.status === 'offen')
  const running = dash.tasks.find((t) => t.status === 'laeuft')
  const doneTasks = dash.tasks.find((t) => t.status === 'erledigt')
  const openMin = (openTasks?.minutes ?? 0) + (running?.minutes ?? 0)

  const sourceTotal = dash.sources.reduce((n, s) => n + s.n, 0)
  const internalized = dash.sources
    .filter((s) => s.status === 'verinnerlicht' || s.status === 'zitiert')
    .reduce((n, s) => n + s.n, 0)
  const inbox = dash.sources.find((s) => s.status === 'eingang')?.n ?? 0

  const reviewed = (dash.runs.total ?? 0) - (dash.runs.offen ?? 0)
  const overrideRate = reviewed
    ? Math.round((((dash.runs.geaendert ?? 0) + (dash.runs.verworfen ?? 0)) / reviewed) * 100)
    : null

  const pagePct = dash.pages.target ? (dash.pages.written / dash.pages.target) * 100 : 0

  const advance = async (t: Task) => {
    await api.patch(`/tasks/${t.id}`, { status: t.status === 'offen' ? 'laeuft' : 'erledigt' })
    reload()
  }

  return (
    <div className="stack">
      <div className="grid g4">
        <Stat
          label="Manuskript"
          value={dash.pages.written.toFixed(1)}
          unit={`/ ${dash.pages.target || '?'} S.`}
          bar={{ value: pagePct }}
          note={
            dash.project.page_budget && dash.pages.target > dash.project.page_budget
              ? `Kapitelziele liegen ${(dash.pages.target - dash.project.page_budget).toFixed(1)} Seiten ueber dem Budget`
              : 'Summe der Kapitelziele'
          }
        />
        <Stat
          label="Quellen durchdrungen"
          value={internalized}
          unit={`/ ${sourceTotal}`}
          bar={{ value: sourceTotal ? (internalized / sourceTotal) * 100 : 0, tone: 'teal' }}
          note={inbox ? `${inbox} im Eingang, noch nicht triagiert` : 'Eingang leer'}
        />
        <Stat
          label="Offener Aufwand"
          value={minutes(openMin)}
          bar={{
            value: doneTasks && openTasks ? (doneTasks.n / (doneTasks.n + openTasks.n)) * 100 : 0,
            tone: 'green',
          }}
          note={`${(openTasks?.n ?? 0) + (running?.n ?? 0)} offene Aufgaben, ${doneTasks?.n ?? 0} erledigt`}
        />
        <Stat
          label="Uebersteuerungsquote"
          value={overrideRate == null ? '–' : `${overrideRate}`}
          unit={overrideRate == null ? '' : '%'}
          bar={{ value: overrideRate ?? 0, tone: 'rose' }}
          note={
            dash.runs.offen
              ? `${dash.runs.offen} Agentenlaeufe ohne dein Urteil`
              : 'Jeder Agentenlauf ist beurteilt'
          }
        />
      </div>

      {dash.runs.offen > 0 && (
        <div className="notice warn">
          <strong>{dash.runs.offen} Agentenergebnisse warten auf dein Urteil.</strong> Ein Vorschlag ohne
          menschliche Entscheidung zaehlt im Nachweis als ungeprueft.{' '}
          <button className="sm" onClick={() => go('ledger')} style={{ marginLeft: 8 }}>zum Nachweis</button>
        </div>
      )}

      <div className="split">
        <Panel
          title="Als naechstes"
          note={`${dash.nextTasks.length} von ${(openTasks?.n ?? 0) + (running?.n ?? 0)}`}
          actions={<button className="sm" onClick={() => go('chapters')}>alle Aufgaben</button>}
          tight
        >
          {dash.nextTasks.length === 0 ? (
            <Empty>
              Keine offenen Aufgaben. Lass den Arbeitsplaner ein Kapitel zerlegen.
              <div style={{ marginTop: 12 }}>
                <button className="primary" onClick={() => go('chapters')}>Kapitel oeffnen</button>
              </div>
            </Empty>
          ) : (
            dash.nextTasks.map((t) => (
              <div className="list-row" key={t.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row tight" style={{ marginBottom: 4 }}>
                    {t.chapter_number && <Tag tone="amber">{t.chapter_number}</Tag>}
                    <Tag>{KIND_LABEL[t.kind] ?? t.kind}</Tag>
                    <span className="mono xsmall dim">{minutes(t.estimate_min)}</span>
                    {t.status === 'laeuft' && <Tag tone="amber">laeuft</Tag>}
                    {t.origin.startsWith('agent:') && <Tag tone="violet">geplant</Tag>}
                  </div>
                  <div style={{ color: 'var(--text-hi)' }}>{t.title}</div>
                  {t.detail && <div className="xsmall dim" style={{ marginTop: 3 }}>Ergebnis: {t.detail}</div>}
                  {t.blocked_by && <div className="xsmall" style={{ color: 'var(--rose)', marginTop: 3 }}>Voraussetzung: {t.blocked_by}</div>}
                </div>
                <button className="sm" onClick={() => advance(t)}>
                  {t.status === 'offen' ? 'starten' : 'erledigt'}
                </button>
              </div>
            ))
          )}
        </Panel>

        <div className="stack">
          <Panel title="Ungedeckte Beweislast" note={`${dash.uncovered.length} Kapitel`} tight>
            {dash.uncovered.length === 0 ? (
              <Empty>Jedes Kapitel mit hinterlegtem Ziel hat mindestens eine Quelle.</Empty>
            ) : (
              dash.uncovered.slice(0, 6).map((c) => (
                <div className="list-row" key={c.id} style={{ display: 'block' }}>
                  <div className="row tight">
                    <Tag tone="rose">{c.number}</Tag>
                    <span style={{ color: 'var(--text-hi)' }}>{c.title}</span>
                  </div>
                  <div className="xsmall dim" style={{ marginTop: 4 }}>{c.goal}</div>
                </div>
              ))
            )}
            <div style={{ padding: 12 }}>
              <button className="sm" onClick={() => go('chapters')}>Quellen-Scout einsetzen</button>
            </div>
          </Panel>

          <Panel title="Quellenbestand" tight>
            {sourceTotal === 0 ? (
              <Empty>Noch keine Quelle erfasst.</Empty>
            ) : (
              <div style={{ padding: 14 }} className="stack sm">
                {dash.sources.map((s) => (
                  <div key={s.status}>
                    <div className="spread xsmall" style={{ marginBottom: 4 }}>
                      <span className="muted">{s.status}</span>
                      <span className="mono dim">
                        {s.n} · Ø {Math.round(s.avg_int)} %
                      </span>
                    </div>
                    <Bar value={(s.n / sourceTotal) * 100} tone={s.status === 'verinnerlicht' ? 'green' : s.status === 'eingang' ? 'rose' : 'teal'} />
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {dash.newsHot > 0 && (
            <Panel title="Feed" tight>
              <div style={{ padding: 14 }}>
                <div className="small">
                  <strong style={{ color: 'var(--amber)' }}>{dash.newsHot}</strong> neue Meldungen mit
                  Relevanz ab 60 fuer deine Kapitel.
                </div>
                <button className="sm" style={{ marginTop: 10 }} onClick={() => go('feed')}>ansehen</button>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
