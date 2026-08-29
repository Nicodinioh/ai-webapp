import { Fragment, useCallback, useEffect, useState } from 'react'
import { api, type AgentInfo, type AgentRun } from '../lib/api'
import { Empty, Panel, Stat, Tag } from '../components/ui'

const VERDICT_TONE: Record<string, string> = {
  offen: 'rose', uebernommen: 'green', geaendert: 'amber', verworfen: '',
}

export function Ledger({ reload }: { reload: () => void }) {
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)

  const load = useCallback(() => {
    api.get<AgentRun[]>(`/runs?limit=200${filter ? `&verdict=${filter}` : ''}`).then(setRuns)
    api.get<AgentInfo[]>('/agents').then(setAgents)
  }, [filter])
  useEffect(load, [load])

  const name = (id: string) => agents.find((a) => a.id === id)?.name ?? id

  const total = runs.length
  const open = runs.filter((r) => r.verdict === 'offen').length
  const changed = runs.filter((r) => r.verdict === 'geaendert').length
  const rejected = runs.filter((r) => r.verdict === 'verworfen').length
  const reviewed = total - open
  const override = reviewed ? Math.round(((changed + rejected) / reviewed) * 100) : 0
  const tokens = runs.reduce((n, r) => n + (r.tokens_in ?? 0) + (r.tokens_out ?? 0), 0)
  const cached = runs.reduce((n, r) => n + (r.cache_read ?? 0), 0)

  const setVerdict = async (id: number, verdict: string) => {
    await api.patch(`/runs/${id}`, { verdict })
    load()
    reload()
  }

  return (
    <div className="stack">
      <div className="notice">
        Dieser Nachweis ist der Kern des Hochschul-Cases: Er dokumentiert nicht nur, <em>dass</em> KI
        eingesetzt wurde, sondern <em>wo</em>, <em>wofuer</em>, mit welchem Automatisierungsgrad und mit
        welchem menschlichen Urteil. Ein Vorschlag ohne Urteil zaehlt als ungeprueft.
      </div>

      <div className="grid g4">
        <Stat label="Agentenlaeufe" value={total} note="im geladenen Ausschnitt" />
        <Stat label="Ohne Urteil" value={open} bar={{ value: total ? (open / total) * 100 : 0, tone: 'rose' }}
          note={open ? 'diese Laeufe fehlen im Nachweis' : 'vollstaendig beurteilt'} />
        <Stat label="Uebersteuerungsquote" value={override} unit="%"
          bar={{ value: override, tone: 'teal' }}
          note="Anteil geaenderter oder verworfener Ergebnisse — das Mass echter Kontrolle" />
        <Stat label="Token" value={tokens.toLocaleString('de-DE')}
          note={cached ? `${Math.round((cached / Math.max(1, cached + tokens)) * 100)} % der Eingabe aus dem Cache` : 'ohne Cachetreffer'} />
      </div>

      <div className="row">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 220 }}>
          <option value="">alle Urteile</option>
          <option value="offen">ohne Urteil</option>
          <option value="uebernommen">uebernommen</option>
          <option value="geaendert">geaendert</option>
          <option value="verworfen">verworfen</option>
        </select>
        <a className="btn" href="/api/hcai/export" style={{ marginLeft: 'auto' }}>
          Nachweis als Markdown exportieren
        </a>
      </div>

      <Panel title="Protokoll" tight>
        {runs.length === 0 ? (
          <Empty>Noch kein Agentenlauf protokolliert.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Zeitpunkt</th>
                  <th>Agent</th>
                  <th>Zweck</th>
                  <th>Stufe</th>
                  <th>Aufwand</th>
                  <th>Urteil</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="clickable" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                      <td className="mono xsmall nowrap dim">{r.created_at}</td>
                      <td className="small nowrap">{name(r.agent_id)}</td>
                      <td className="small">{r.purpose}</td>
                      <td className="mono xsmall center">{r.automation}</td>
                      <td className="mono xsmall nowrap dim">
                        {r.offline ? '–' : `${((r.tokens_in ?? 0) + (r.tokens_out ?? 0)).toLocaleString('de-DE')} tk`}
                        {r.latency_ms ? <div>{Math.round(r.latency_ms / 1000)} s</div> : null}
                      </td>
                      <td><Tag tone={VERDICT_TONE[r.verdict]}>{r.verdict}</Tag></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {r.verdict === 'offen' && (
                          <div className="row tight nowrap">
                            <button className="sm" onClick={() => setVerdict(r.id, 'uebernommen')}>✓</button>
                            <button className="sm" onClick={() => setVerdict(r.id, 'geaendert')}>~</button>
                            <button className="sm danger" onClick={() => setVerdict(r.id, 'verworfen')}>×</button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {expanded === r.id && (
                      <tr>
                        <td colSpan={7} style={{ background: 'var(--ink-000)' }}>
                          <div className="xsmall dim mono" style={{ marginBottom: 6 }}>
                            {r.model ?? 'offline'} · Bezug: {r.entity_type ?? '–'} {r.entity_id ?? ''}
                            {r.verdict_note ? ` · ${r.verdict_note}` : ''}
                          </div>
                          <pre className="pre xsmall" style={{ margin: 0, maxHeight: 320, overflow: 'auto' }}>
                            {r.output}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
