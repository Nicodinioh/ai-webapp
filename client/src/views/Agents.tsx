import { useEffect, useState } from 'react'
import { api, type AgentInfo } from '../lib/api'
import { Empty, Panel, Tag } from '../components/ui'

const AUTOMATION: Record<number, string> = {
  1: 'Werkzeug — du fuehrst, das System rechnet zu',
  2: 'Vorschlag — das System schlaegt vor, du entscheidest',
  3: 'Entwurf — das System formuliert, du ueberarbeitest',
  4: 'Delegation — das System handelt, du pruefst nachgelagert',
}

const KNOWLEDGE_LABEL: Record<string, string> = {
  quellenkritik: 'Quellenkritik: Evidenzhierarchie, sieben Pruefachsen, typische Fehlschluesse',
  hcai: 'HCAI: Shneidermans zwei Achsen, RST-Trias, substanzielle Aufsicht vs. Aufsichtstheater',
  lesedidaktik: 'Lesedidaktik: Retrieval Practice, Elaborative Interrogation, sechs Lesestufen, Bewertungsskala',
  zitierpraxis: 'Zitierpraxis: Zitat/Paraphrase/Eigenleistung, Belegdehnung, KI-Ausweisungspflicht',
  arbeitsarchitektur: 'Arbeitsarchitektur: Kapitelfunktionen, Schreibreihenfolge, Zeitschaetzwerte',
  'regulatorik-finanzsektor': 'Regulatorik: EU AI Act, DORA, MaRisk, BAIT, Aufsichtspraxis',
}

export function AgentsView() {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  useEffect(() => { api.get<AgentInfo[]>('/agents').then(setAgents) }, [])

  if (agents.length === 0) return <Empty>Lade Agenten…</Empty>

  return (
    <div className="stack">
      <div className="notice">
        Jeder Agent ist auf genau eine Aufgabe zugeschnitten und bekommt bei jedem Lauf dieselben
        Wissensbasen als festen Systemkontext — daher stammt seine Fachlichkeit, nicht aus einer
        allgemeinen Anweisung. Die Grenze eines Agenten ist Teil seiner Spezialisierung: was er nicht tut,
        macht ein anderer.
      </div>

      <div className="grid g2">
        {agents.map((a) => {
          const reviewed = a.stats.runs - a.stats.pending
          const override = reviewed ? Math.round(((a.stats.changed + a.stats.rejected) / reviewed) * 100) : null
          return (
            <Panel
              key={a.id}
              title={a.name}
              actions={
                <span className="row tight">
                  {a.webSearch && <Tag tone="teal">Websuche</Tag>}
                  <Tag>Aufwand {a.effort}</Tag>
                </span>
              }
            >
              <p className="small">{a.mandate}</p>
              <p className="small dim" style={{ marginBottom: 14 }}>
                <strong>Grenze:</strong> {a.boundary}
              </p>

              <div className="stat-label">Wissensbasen</div>
              <ul className="small" style={{ margin: '6px 0 14px', paddingLeft: 18 }}>
                {a.knowledge.map((k) => <li key={k}>{KNOWLEDGE_LABEL[k] ?? k}</li>)}
              </ul>

              <div className="stat-label">Automatisierungsgrad</div>
              <div className="small" style={{ marginBottom: 12 }}>
                <span className="mono">{a.automation}</span> — {AUTOMATION[a.automation]}
              </div>

              <div className="row tight xsmall dim" style={{ borderTop: '1px solid var(--ink-200)', paddingTop: 10 }}>
                <span className="mono">{a.stats.runs} Laeufe</span>
                {a.stats.pending > 0 && <Tag tone="rose">{a.stats.pending} unbeurteilt</Tag>}
                {override != null && <span className="mono">Uebersteuerung {override} %</span>}
                {a.stats.cached > 0 && (
                  <span className="mono" title="aus dem Prompt-Cache bediente Eingabetoken">
                    Cache {Math.round((a.stats.cached / Math.max(1, a.stats.tin + a.stats.cached)) * 100)} %
                  </span>
                )}
              </div>
            </Panel>
          )
        })}
      </div>
    </div>
  )
}
