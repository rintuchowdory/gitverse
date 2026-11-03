import { useEffect, useState, useCallback } from 'react'
import * as api from './workerClient.js'

function relTime(iso) {
  if (!iso) return '—'
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'gerade eben'
  const m = Math.floor(s / 60); if (m < 60) return `vor ${m} Min.`
  const h = Math.floor(m / 60); if (h < 24) return `vor ${h} Std.`
  const d = Math.floor(h / 24); if (d < 30) return `vor ${d} Tg.`
  return `vor ${Math.floor(d / 30)} Mon.`
}

const PROVIDER = {
  render: { label: 'Render', color: '#46e3b7' },
  cloudflare: { label: 'Cloudflare', color: '#f6821f' },
  vercel: { label: 'Vercel', color: '#ffffff' },
}

export function StateBadge({ state }) {
  const map = {
    live: ['green', 'live'],
    failed: ['', 'failed'],
    building: ['indigo', 'building'],
    canceled: ['', 'abgebrochen'],
    unknown: ['', 'unbekannt'],
  }
  const [cls, label] = map[state] || ['', state || 'unbekannt']
  return <span className={`tag ${cls}`} style={state === 'failed' ? { color: 'var(--red)', borderColor: 'rgba(239,68,68,.4)' } : undefined}>{label}</span>
}

/* ------------------------------ Deployments ------------------------------- */
export function DeploymentsView() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const d = await api.deployments()
      if (!d.ok && d.error) throw new Error(d.error)
      setData(d)
    } catch (e) { setError(e.message || 'Worker nicht erreichbar.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const providers = data?.providers || {}
  const brokenProviders = Object.entries(providers).filter(([, v]) => !v.ok)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h1 className="page-title">Deployments</h1>
          <p className="page-sub">
            Vercel, Render und Cloudflare Pages in einer Ansicht
            {data?.fetched ? ` · aktualisiert ${relTime(data.fetched)}` : ''}
          </p>
        </div>
        <button className="pill" style={{ marginLeft: 'auto' }} onClick={load} disabled={loading}>
          {loading ? '…' : '⟳'} Aktualisieren
        </button>
      </div>

      {error && <div className="notice error"><div><b>Fehler.</b> {error}</div></div>}

      {brokenProviders.map(([name, v]) => (
        <div className="notice" key={name}>
          <div>
            <b>{PROVIDER[name]?.label || name}:</b>{' '}
            {v.error === 'token_invalid'
              ? 'Der hinterlegte Token wird abgelehnt. Neuen Token hinterlegen, dann erscheinen die Projekte.'
              : v.error === 'no_token'
                ? 'Kein Token hinterlegt.'
                : `Abruf fehlgeschlagen (${v.error}).`}
            {v.detail ? <div style={{ marginTop: 4, fontSize: 11 }}>{v.detail}</div> : null}
          </div>
        </div>
      ))}

      {data?.summary && (
        <section className="stats">
          <div className="stat">
            <div className="stat-top"><span className="stat-label">Dienste</span><span className="stat-icon">◈</span></div>
            <div className="stat-value">{data.summary.total}</div>
            <div className="stat-hint">über alle Provider</div>
          </div>
          <div className="stat">
            <div className="stat-top"><span className="stat-label">Live</span><span className="stat-icon">◉</span></div>
            <div className="stat-value">{data.summary.live}</div>
            <div className="stat-hint">letzter Deploy erfolgreich</div>
          </div>
          <div className="stat">
            <div className="stat-top"><span className="stat-label">Fehlgeschlagen</span><span className="stat-icon">✕</span></div>
            <div className="stat-value" style={{ color: data.summary.failed ? 'var(--red)' : undefined }}>{data.summary.failed}</div>
            <div className="stat-hint">braucht Aufmerksamkeit</div>
          </div>
          <div className="stat">
            <div className="stat-top"><span className="stat-label">Im Build</span><span className="stat-icon">⟳</span></div>
            <div className="stat-value">{data.summary.building}</div>
            <div className="stat-hint">läuft gerade</div>
          </div>
        </section>
      )}

      {loading && !data && <div className="grid-repos">{[0, 1, 2, 3].map((i) => <div className="skeleton" key={i} />)}</div>}

      {data?.items?.length > 0 && (
        <div>
          <div className="section-head"><h2>Alle Dienste</h2></div>
          <div className="grid-repos">
            {data.items.map((it) => (
              <div className="card" key={it.provider + it.id}>
                <div className="repo-head">
                  <span className="lang-dot" style={{ background: PROVIDER[it.provider]?.color || '#888' }} />
                  <span className="repo-name">{it.name}</span>
                  <span style={{ marginLeft: 'auto' }}><StateBadge state={it.state} /></span>
                </div>
                <p className="repo-desc" style={{ minHeight: 20 }}>
                  {it.commit || it.framework || it.type || ' '}
                </p>
                <div className="repo-meta">
                  <span>{PROVIDER[it.provider]?.label || it.provider}</span>
                  <span>{relTime(it.created)}</span>
                  {it.url && (
                    <a href={it.url} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto', color: 'var(--accent)' }}>
                      öffnen ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

/* ------------------------------- CI Detective ------------------------------ */
export function CIView() {
  const [repos, setRepos] = useState([])
  const [runs, setRuns] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [newRepo, setNewRepo] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const wl = await api.getWatchlist()
      const list = wl.repos || []
      setRepos(list)
      const results = await Promise.all(list.map(async (r) => [r, await api.ciRuns(r)]))
      setRuns(Object.fromEntries(results))
    } catch (e) { setError(e.message || 'Worker nicht erreichbar.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const analyze = async (repo, run) => {
    setSelected({ repo, run }); setAnalysis(null); setAnalyzing(true)
    try {
      const a = await api.analyzeRun(repo, run.id)
      setAnalysis(a)
    } catch (e) { setAnalysis({ ok: false, error: e.message }) }
    finally { setAnalyzing(false) }
  }

  const addRepo = async (e) => {
    e.preventDefault()
    const value = newRepo.trim()
    if (!/^[\w.-]+\/[\w.-]+$/.test(value)) { setError('Format: owner/repo'); return }
    setNewRepo(''); setError('')
    await api.saveWatchlist({ repos: [...new Set([...repos, value])] })
    load()
  }

  const totalFailed = Object.values(runs).reduce((a, r) => a + (r?.runs?.length || 0), 0)

  return (
    <>
      <div>
        <h1 className="page-title">CI Detective</h1>
        <p className="page-sub">Fehlgeschlagene GitHub-Actions-Läufe, kaputter Schritt und ein Fix-Vorschlag</p>
      </div>

      {error && <div className="notice error"><div>{error}</div></div>}

      <form onSubmit={addRepo} style={{ display: 'flex', gap: 10, maxWidth: 520 }}>
        <div className="search" style={{ flex: 1 }}>
          <input value={newRepo} onChange={(e) => setNewRepo(e.target.value)} placeholder="owner/repo überwachen…" />
        </div>
        <button className="btn" type="submit">Hinzufügen</button>
      </form>

      {loading && <div className="skeleton" style={{ height: 160 }} />}

      {!loading && totalFailed === 0 && (
        <div className="card"><div className="empty">Keine fehlgeschlagenen Läufe in der Watchlist. Sauber.</div></div>
      )}

      {repos.map((repo) => {
        const r = runs[repo]
        if (!r?.runs?.length) return null
        return (
          <div key={repo}>
            <div className="section-head"><h2>{repo}</h2><span className="badge">{r.runs.length} fehlgeschlagen</span></div>
            <div className="card">
              <div className="list">
                {r.runs.map((run) => (
                  <div className="row" key={run.id} style={{ cursor: 'pointer' }} onClick={() => analyze(repo, run)}>
                    <div className="row-ico" style={{ color: 'var(--red)' }}>✕</div>
                    <div className="row-main">
                      <p className="row-title">{run.name} · {run.branch}</p>
                      <div className="row-sub">
                        <code>{run.sha}</code>
                        <span>{run.event}</span>
                        <span>{relTime(run.created)}</span>
                      </div>
                    </div>
                    <span className="link-btn" style={{ marginLeft: 8 }}>analysieren →</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })}

      {selected && (
        <div className="card">
          <div className="section-head">
            <h2>{selected.repo} · {selected.run.name}</h2>
            <a className="link-btn" href={selected.run.url} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto' }}>
              Lauf auf GitHub ↗
            </a>
          </div>

          {analyzing && <div className="skeleton" style={{ height: 120 }} />}

          {analysis && !analysis.ok && (
            <div className="notice error"><div>Analyse fehlgeschlagen: {analysis.error}</div></div>
          )}

          {analysis?.ok && (
            <>
              <div className="chips" style={{ marginBottom: 14 }}>
                <span className="badge">Job: {analysis.job.name}</span>
                {analysis.job.failedStep && <span className="badge gold">Schritt {analysis.job.failedStepNumber}: {analysis.job.failedStep}</span>}
                <span className="badge">{analysis.job.totalSteps} Schritte</span>
              </div>

              {analysis.ai && (
                <div className="card" style={{ background: 'var(--card-2)', marginBottom: 14 }}>
                  <div className="stat-label" style={{ marginBottom: 8 }}>Vorschlag</div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.65 }}>{analysis.ai}</div>
                </div>
              )}

              {analysis.excerpt && (
                <>
                  <div className="stat-label" style={{ marginBottom: 6 }}>Log-Auszug</div>
                  <pre className="codeblock">{analysis.excerpt}</pre>
                </>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}

/* -------------------------------- Briefing -------------------------------- */
export function BriefView() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const run = async () => {
    setLoading(true); setError(''); setCopied(false)
    try {
      const d = await api.brief()
      if (!d.ok) throw new Error(d.error || 'Briefing fehlgeschlagen')
      setData(d)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const copy = async () => {
    const text = [data.ai, '', ...data.facts].filter(Boolean).join('\n')
    try { await navigator.clipboard.writeText(text); setCopied(true) } catch {}
  }

  return (
    <>
      <div>
        <h1 className="page-title">AI Briefing</h1>
        <p className="page-sub">Groq fasst den Stand deiner Repos und Deployments auf Deutsch zusammen</p>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn" onClick={run} disabled={loading}>
          {loading ? 'Briefing wird erstellt…' : data ? 'Neu erstellen' : 'Briefing erstellen'}
        </button>
        {data?.ai && <button className="btn ghost" onClick={copy}>{copied ? 'Kopiert ✓' : 'Kopieren'}</button>}
      </div>

      {error && <div className="notice error"><div>{error}</div></div>}

      {loading && <div className="skeleton" style={{ height: 200 }} />}

      {data?.ai && !loading && (
        <div className="card">
          <div className="stat-label" style={{ marginBottom: 10 }}>Stand {relTime(data.generated)}</div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.7 }}>{data.ai}</div>
        </div>
      )}

      {data?.facts && !loading && (
        <div className="card">
          <div className="stat-label" style={{ marginBottom: 10 }}>Rohdaten</div>
          <div className="list">
            {data.facts.map((f, i) => (
              <div className="row" key={i}>
                <div className="row-ico">·</div>
                <div className="row-main"><p className="row-title" style={{ whiteSpace: 'normal' }}>{f}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!data && !loading && !error && (
        <div className="card">
          <div className="empty">
            Noch kein Briefing. Der Knopf oben holt Deployments und CI-Stände und lässt Groq
            daraus eine kurze Lagebeurteilung schreiben.
          </div>
        </div>
      )}
    </>
  )
}

/* -------------------------------- Watchlist -------------------------------- */
export function WatchlistView({ onChanged }) {
  const [repos, setRepos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const d = await api.getWatchlist()
      setRepos(d.repos || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const persist = async (next) => {
    setSaving(true)
    try {
      const d = await api.saveWatchlist({ repos: next })
      setRepos(d.repos || next)
      onChanged?.()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const add = (e) => {
    e.preventDefault()
    const v = draft.trim()
    if (!/^[\w.-]+\/[\w.-]+$/.test(v)) { setError('Format: owner/repo'); return }
    setDraft(''); setError('')
    persist([...new Set([...repos, v])])
  }

  return (
    <>
      <div>
        <h1 className="page-title">Watchlist</h1>
        <p className="page-sub">Diese Repos prüft der CI Detective und der tägliche Digest</p>
      </div>

      {error && <div className="notice error"><div>{error}</div></div>}

      <form onSubmit={add} style={{ display: 'flex', gap: 10, maxWidth: 520 }}>
        <div className="search" style={{ flex: 1 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="owner/repo" />
        </div>
        <button className="btn" type="submit" disabled={saving}>Hinzufügen</button>
      </form>

      <div className="card">
        {loading ? <div className="skeleton" style={{ height: 100 }} />
          : repos.length === 0 ? <div className="empty">Watchlist ist leer.</div>
          : <div className="list">
              {repos.map((r) => (
                <div className="row" key={r}>
                  <div className="row-ico">◈</div>
                  <div className="row-main">
                    <p className="row-title"><a href={`https://github.com/${r}`} target="_blank" rel="noreferrer">{r}</a></p>
                  </div>
                  <button
                    className="link-btn"
                    style={{ marginLeft: 8 }}
                    onClick={() => persist(repos.filter((x) => x !== r))}
                  >
                    entfernen
                  </button>
                </div>
              ))}
            </div>}
      </div>

      <div className="notice">
        <div>
          Gespeichert wird serverseitig in Cloudflare KV, nicht im Browser. Der tägliche
          Digest prüft genau diese Repos und die Deployments.
        </div>
      </div>
    </>
  )
}
