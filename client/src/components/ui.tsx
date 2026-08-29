import { useEffect, type ReactNode } from 'react'

export function Panel({
  title, note, actions, children, tight,
}: { title?: ReactNode; note?: ReactNode; actions?: ReactNode; children: ReactNode; tight?: boolean }) {
  return (
    <section className="panel">
      {(title || actions) && (
        <div className="panel-head">
          <h2>{title}</h2>
          {note && <span className="xsmall dim">{note}</span>}
          {actions}
        </div>
      )}
      <div className={tight ? 'panel-body tight' : 'panel-body'}>{children}</div>
    </section>
  )
}

export function Stat({ label, value, unit, note, bar }: {
  label: string; value: ReactNode; unit?: string; note?: ReactNode
  bar?: { value: number; tone?: string }
}) {
  return (
    <div className="panel stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      {bar && (
        <div className={`bar ${bar.tone ?? ''}`} style={{ marginTop: 9 }}>
          <i style={{ width: `${Math.min(100, Math.max(0, bar.value))}%` }} />
        </div>
      )}
      {note && <div className="stat-note">{note}</div>}
    </div>
  )
}

export function Tag({ tone, children }: { tone?: string; children: ReactNode }) {
  return <span className={`tag ${tone ?? ''}`}>{children}</span>
}

export function Bar({ value, tone }: { value: number; tone?: string }) {
  return (
    <div className={`bar ${tone ?? ''}`}>
      <i style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function Working({ children }: { children: ReactNode }) {
  return (
    <div className="working">
      <span className="spinner" />
      {children}
    </div>
  )
}

export function Sheet({
  title, subtitle, onClose, children, footer, wide,
}: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={wide ? 'sheet wide' : 'sheet'}>
        <div className="sheet-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{title}</h2>
            {subtitle && <div className="xsmall dim" style={{ marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button className="ghost" onClick={onClose}>schliessen</button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  )
}

/**
 * Jede Agentenausgabe traegt ihr Urteil bei sich. Ohne menschliche Entscheidung
 * bleibt sie ein Vorschlag - so steht sie auch im Nachweis.
 */
export function Verdict({ runId, onDone }: { runId: number | null; onDone?: () => void }) {
  if (!runId) return null
  const set = async (verdict: string) => {
    await fetch(`/api/runs/${runId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ verdict }),
    })
    onDone?.()
  }
  return (
    <div className="row tight xsmall dim" style={{ marginTop: 12 }}>
      <span className="mono">Urteil zu Lauf #{runId}:</span>
      <button className="sm" onClick={() => set('uebernommen')}>uebernommen</button>
      <button className="sm" onClick={() => set('geaendert')}>geaendert</button>
      <button className="sm danger" onClick={() => set('verworfen')}>verworfen</button>
    </div>
  )
}

export function AgentError({ error, offline }: { error?: string; offline?: boolean }) {
  if (!error) return null
  return (
    <div className={offline ? 'notice warn' : 'notice bad'}>
      {offline
        ? 'Offline-Modus: Es ist kein ANTHROPIC_API_KEY gesetzt. Die Agenten sind stumm - alles andere funktioniert. Trage den Schluessel in die .env-Datei ein und starte den Server neu.'
        : error}
    </div>
  )
}
