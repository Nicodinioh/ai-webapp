import { useCallback, useEffect, useState } from 'react'
import { api, type Dashboard } from './lib/api'
import { Cockpit } from './views/Cockpit'
import { Chapters } from './views/Chapters'
import { Sources } from './views/Sources'
import { ReadingRoom } from './views/ReadingRoom'
import { Feed } from './views/Feed'
import { AgentsView } from './views/Agents'
import { Ledger } from './views/Ledger'

export type View = 'cockpit' | 'chapters' | 'sources' | 'reading' | 'feed' | 'agents' | 'ledger'

const NAV: { group: string; items: { id: View; glyph: string; label: string }[] }[] = [
  {
    group: 'Lage',
    items: [
      { id: 'cockpit', glyph: '◈', label: 'Cockpit' },
      { id: 'chapters', glyph: '❯', label: 'Kapitel' },
    ],
  },
  {
    group: 'Quellenarbeit',
    items: [
      { id: 'sources', glyph: '▤', label: 'Quellen' },
      { id: 'reading', glyph: '◉', label: 'Lesesaal' },
      { id: 'feed', glyph: '◇', label: 'Feed' },
    ],
  },
  {
    group: 'Kontrolle',
    items: [
      { id: 'agents', glyph: '⬡', label: 'Agenten' },
      { id: 'ledger', glyph: '⎔', label: 'HCAI-Nachweis' },
    ],
  },
]

export default function App() {
  const [view, setView] = useState<View>('cockpit')
  const [focusSource, setFocusSource] = useState<number | null>(null)
  const [dash, setDash] = useState<Dashboard | null>(null)
  const [online, setOnline] = useState<{ online: boolean; model: string | null } | null>(null)

  const reload = useCallback(() => {
    api.get<Dashboard>('/dashboard').then(setDash).catch(() => setDash(null))
  }, [])

  useEffect(() => {
    reload()
    api.get<{ online: boolean; model: string | null }>('/status').then(setOnline).catch(() => {})
  }, [reload])

  const openReading = (sourceId: number) => {
    setFocusSource(sourceId)
    setView('reading')
  }

  const counts: Partial<Record<View, number>> = {
    chapters: dash?.uncovered.length || undefined,
    ledger: dash?.runs?.offen || undefined,
    feed: dash?.newsHot || undefined,
  }

  const titles: Record<View, [string, string]> = {
    cockpit: ['Lage', 'Cockpit'],
    chapters: ['Lage', 'Kapitel und Aufgaben'],
    sources: ['Quellenarbeit', 'Quellen'],
    reading: ['Quellenarbeit', 'Lesesaal'],
    feed: ['Quellenarbeit', 'Fachfeed'],
    agents: ['Kontrolle', 'Spezialisierte Agenten'],
    ledger: ['Kontrolle', 'Nachweis der KI-Nutzung'],
  }

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <div className="brand-mark">KOM<span>PASS</span></div>
          <div className="brand-sub">Forschungs-Betriebssystem<br />fuer HCAI-gestuetzte Thesisarbeit</div>
        </div>
        <nav className="nav">
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="nav-group">{g.group}</div>
              {g.items.map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${view === item.id ? 'active' : ''}`}
                  onClick={() => setView(item.id)}
                >
                  <span className="glyph">{item.glyph}</span>
                  {item.label}
                  {counts[item.id] ? <span className="count">{counts[item.id]}</span> : null}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="rail-foot">
          {online ? (
            online.online ? (
              <div className="row tight">
                <span className="tag green">aktiv</span>
                <span className="mono xsmall dim">{online.model}</span>
              </div>
            ) : (
              <div className="row tight">
                <span className="tag">offline</span>
                <span className="xsmall dim">Agenten stumm</span>
              </div>
            )
          ) : (
            <span className="xsmall dim">verbinde…</span>
          )}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="title">
            <div className="eyebrow">{titles[view][0]}</div>
            <h1>{titles[view][1]}</h1>
          </div>
          {dash?.project && (
            <div className="xsmall dim nowrap" style={{ textAlign: 'right' }}>
              {dash.project.title}
              {dash.daysLeft != null && (
                <div className="mono" style={{ color: dash.daysLeft < 21 ? 'var(--rose)' : undefined }}>
                  noch {dash.daysLeft} Tage
                </div>
              )}
            </div>
          )}
        </header>

        <div className="page">
          {view === 'cockpit' && <Cockpit dash={dash} reload={reload} go={setView} openReading={openReading} />}
          {view === 'chapters' && <Chapters reload={reload} />}
          {view === 'sources' && <Sources reload={reload} openReading={openReading} />}
          {view === 'reading' && <ReadingRoom sourceId={focusSource} setSourceId={setFocusSource} reload={reload} />}
          {view === 'feed' && <Feed reload={reload} />}
          {view === 'agents' && <AgentsView />}
          {view === 'ledger' && <Ledger reload={reload} />}
        </div>
      </main>
    </div>
  )
}
