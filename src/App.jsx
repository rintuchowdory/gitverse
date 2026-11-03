import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  fetchUser, fetchRepos, fetchEvents, fetchCommits, fetchIssues,
  fetchPullRequests, fetchReleases, searchRepos, setToken, hasToken, rate, GitHubError,
} from './api.js'
import { DeploymentsView, CIView, BriefView, WatchlistView } from './Views.jsx'

const DEFAULT_LOGIN = 'rintuchowdory'

const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', HTML: '#e34c26',
  CSS: '#563d7c', Dart: '#00B4AB', Kotlin: '#A97BFF', Java: '#b07219',
  Shell: '#89e051', 'C++': '#f34b7d', C: '#555555', Rust: '#dea584', Go: '#00ADD8',
  Vue: '#41b883', Svelte: '#ff3e00', 'Jupyter Notebook': '#DA5B0B', Dockerfile: '#384d54',
}

function relTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'gerade eben'
  const m = Math.floor(s / 60); if (m < 60) return `vor ${m} Min.`
  const h = Math.floor(m / 60); if (h < 24) return `vor ${h} Std.`
  const days = Math.floor(h / 24); if (days < 30) return `vor ${days} Tg.`
  const mo = Math.floor(days / 30); if (mo < 12) return `vor ${mo} Mon.`
  return `vor ${Math.floor(mo / 12)} J.`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}

function num(n) {
  if (n === null || n === undefined) return '0'
  return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',') + 'k' : String(n)
}

function difficulty(repo) {
  const s = (repo.size || 0) + (repo.stargazers_count || 0) * 2
  if (s > 8000) return { label: 'Advanced', cls: 'advanced' }
  if (s > 1500) return { label: 'Intermediate', cls: 'intermediate' }
  return { label: 'Beginner', cls: 'beginner' }
}

/* ---------------------------------- Icons --------------------------------- */
const I = {
  dash: '▦', repo: '◈', activity: '⟳', issue: '◉', pr: '⇄', release: '⬆',
  star: '★', fork: '⑂', eye: '◌', search: '⌕', refresh: '⟳', settings: '⚙',
  commit: '◍', flame: '▲', bolt: '⚡',
}

/* --------------------------------- Shell ---------------------------------- */
export default function App() {
  const [login] = useState(() => {
    try { return localStorage.getItem('gitverse_login') || DEFAULT_LOGIN } catch { return DEFAULT_LOGIN }
  })
  const [user, setUser] = useState(null)
  const [repos, setRepos] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState('dashboard')
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)

  const load = useCallback(async (force = false) => {
    setLoading(true); setError('')
    try {
      const [u, r, e] = await Promise.all([
        fetchUser(login, force),
        fetchRepos(login, force),
        fetchEvents(login, force).catch(() => []),
      ])
      setUser(u); setRepos(r); setEvents(e)
      try { localStorage.setItem('gitverse_login', login) } catch {}
    } catch (err) {
      setError(err instanceof GitHubError ? err.message : 'Daten konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [login])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => {
    const stars = repos.reduce((a, r) => a + (r.stargazers_count || 0), 0)
    const forks = repos.reduce((a, r) => a + (r.forks_count || 0), 0)
    const open = repos.reduce((a, r) => a + (r.open_issues_count || 0), 0)
    const langs = {}
    repos.forEach((r) => { if (r.language) langs[r.language] = (langs[r.language] || 0) + 1 })
    const topLang = Object.entries(langs).sort((a, b) => b[1] - a[1])[0]
    return { stars, forks, open, topLang, langs }
  }, [repos])

  const recentRepos = useMemo(
    () => [...repos].sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at)),
    [repos]
  )

  const filtered = useMemo(() => {
    if (!query.trim()) return repos
    const q = query.toLowerCase()
    return repos.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q) ||
      (r.language || '').toLowerCase().includes(q)
    )
  }, [repos, query])

  const openRepo = (repo) => { setSelected(repo); setView('repo') }

  const nav = (v) => { setView(v); if (v !== 'repo') setSelected(null) }

  return (
    <div className="app">
      <Sidebar
        user={user} stats={stats} repos={repos} view={view} nav={nav}
        onSettings={() => setSettingsOpen(true)}
      />
      <div className="main">
        <TopBar
          query={query} setQuery={setQuery}
          onRefresh={() => load(true)} loading={loading}
        />
        <div className="content">
          {error && (
            <div className="notice error">
              <div>
                <b>Hoppla.</b> {error}
                {rate.remaining !== null && <div style={{ marginTop: 6, fontSize: 11 }}>
                  GitHub API: {rate.remaining}/{rate.limit} Anfragen übrig.
                </div>}
              </div>
              <button className="btn ghost" onClick={() => setSettingsOpen(true)}>Token hinzufügen</button>
            </div>
          )}

          {view === 'dashboard' && (
            <Dashboard
              user={user} repos={recentRepos} stats={stats} events={events}
              loading={loading} openRepo={openRepo} nav={nav}
            />
          )}
          {view === 'repos' && (
            <Repositories repos={filtered} loading={loading} openRepo={openRepo} query={query} />
          )}
          {view === 'activity' && <Activity events={events} loading={loading} />}
          {view === 'issues' && <RepoPicker repos={repos} action="issues" onPick={openRepo} />}
          {view === 'pulls' && <RepoPicker repos={repos} action="pulls" onPick={openRepo} />}
          {view === 'releases' && <RepoPicker repos={repos} action="releases" onPick={openRepo} />}
          {view === 'search' && <SearchView />}
          {view === 'deployments' && <DeploymentsView />}
          {view === 'ci' && <CIView />}
          {view === 'brief' && <BriefView />}
          {view === 'watchlist' && <WatchlistView />}
          {view === 'repo' && selected && (
            <RepoDetail repo={selected} back={() => nav('repos')} />
          )}
        </div>
      </div>
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} onSaved={() => load(true)} />}
    </div>
  )
}

/* -------------------------------- Sidebar --------------------------------- */
function Sidebar({ user, stats, repos, view, nav, onSettings }) {
  const items = [
    { section: null, items: [{ id: 'dashboard', icon: I.dash, label: 'Dashboard' }] },
    {
      section: 'MONITORING',
      items: [
        { id: 'repos', icon: I.repo, label: 'Repositories', count: repos.length },
        { id: 'releases', icon: I.release, label: 'Releases' },
        { id: 'issues', icon: I.issue, label: 'Issues', count: stats.open || null },
        { id: 'pulls', icon: I.pr, label: 'Pull Requests' },
      ],
    },
    {
      section: 'ACTIVITY',
      items: [
        { id: 'activity', icon: I.activity, label: 'Commits Feed' },
        { id: 'search', icon: I.search, label: 'GitHub Search' },
      ],
    },
    {
      section: 'SERVICES',
      items: [
        { id: 'deployments', icon: '⬢', label: 'Deployments' },
        { id: 'ci', icon: '✕', label: 'CI Detective' },
        { id: 'brief', icon: '✦', label: 'AI Briefing' },
        { id: 'watchlist', icon: '☰', label: 'Watchlist' },
      ],
    },
  ]

  const xp = Math.min(1500, (stats.stars || 0) * 12 + repos.length * 18)
  const level = Math.max(1, Math.floor(xp / 160))

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">⚡</div>
        <div>
          <div className="brand-name">GitVerse</div>
          <div className="brand-sub">Track • Build • Ship</div>
        </div>
      </div>

      <div className="user-card">
        <div className="user-top">
          {user?.avatar_url
            ? <img className="avatar" src={user.avatar_url} alt="" />
            : <div className="avatar" style={{ background: '#222834' }} />}
          <div style={{ minWidth: 0 }}>
            <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name || user?.login || '—'}
            </div>
            <div className="user-login">@{user?.login || '—'}</div>
          </div>
        </div>
        <div className="level-row"><span>Level <b>{level}</b></span><span>{xp} / 1500 XP</span></div>
        <div className="bar"><span style={{ width: `${(xp / 1500) * 100}%` }} /></div>
      </div>

      {items.map((group, gi) => (
        <div className="nav-section" key={gi}>
          {group.section && <div className="nav-label">{group.section}</div>}
          {group.items.map((it) => (
            <button
              key={it.id}
              className={`nav-item ${view === it.id ? 'active' : ''}`}
              onClick={() => nav(it.id)}
            >
              <span className="ico">{it.icon}</span>
              <span>{it.label}</span>
              {it.count ? <span className="nav-count">{it.count}</span> : null}
            </button>
          ))}
        </div>
      ))}

      <div className="nav-section">
        <button className="nav-item" onClick={onSettings}>
          <span className="ico">{I.settings}</span><span>Settings</span>
        </button>
      </div>

      <div className="sidebar-footer">
        Read-only GitHub API.<br />Keine Schreibzugriffe, keine Tokens im Repo.
      </div>
    </aside>
  )
}

/* --------------------------------- Topbar --------------------------------- */
function TopBar({ query, setQuery, onRefresh, loading }) {
  return (
    <header className="topbar">
      <div className="search">
        <span style={{ color: '#6b7280' }}>{I.search}</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Repositories durchsuchen…"
        />
        <span className="kbd">⌘K</span>
      </div>
      <div className="top-actions">
        {rate.remaining !== null && (
          <span className="pill" title="Verbleibende GitHub-API-Anfragen">
            {rate.remaining}/{rate.limit} API
          </span>
        )}
        <button className="pill" onClick={onRefresh} disabled={loading}>
          {loading ? '…' : I.refresh} Aktualisieren
        </button>
        <span className="pill gold">{I.bolt} Read-only</span>
      </div>
    </header>
  )
}

/* -------------------------------- Dashboard -------------------------------- */
function Dashboard({ user, repos, stats, events, loading, openRepo, nav }) {
  const hour = new Date().getHours()
  const greet = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Tag' : 'Guten Abend'
  const parts = (user?.name || '').trim().split(/\s+/).filter(Boolean)
  const name = parts.length ? parts[parts.length - 1] : (user?.login ? user.login : 'zusammen')
  const topRepos = repos.slice(0, 4)
  const commits = eventsToCommits(events).slice(0, 6)

  return (
    <>
      <section className="hero">
        <div>
          <h1>{greet}, {name} 👋</h1>
          <p>
            {loading ? 'Lade deine Repositories…'
              : `${repos.length} Repositories im Blick, ${num(stats.stars)} Sterne gesammelt. Alles read-only, nichts wird verändert.`}
          </p>
          <div className="hero-badges">
            <span className="badge indigo">{I.repo} {repos.length} Repos</span>
            <span className="badge gold">{I.star} {num(stats.stars)} Stars</span>
            <span className="badge green">{I.eye} {num(stats.forks)} Forks</span>
            {stats.topLang && <span className="badge">{stats.topLang[0]}</span>}
          </div>
        </div>
        <div className="hero-ring">◈</div>
      </section>

      <section className="stats">
        <Stat icon={I.repo} label="Repositories" value={loading ? '—' : repos.length} hint="öffentlich & eigene" />
        <Stat icon={I.star} label="Stars gesamt" value={loading ? '—' : num(stats.stars)} hint="über alle Repos" />
        <Stat icon={I.issue} label="Offene Issues" value={loading ? '—' : num(stats.open)} hint="zählt PRs mit" />
        <Stat icon={I.release} label="Sprachen" value={loading ? '—' : Object.keys(stats.langs).length} hint={stats.topLang ? `meist ${stats.topLang[0]}` : '—'} />
      </section>

      <div className="grid-2">
        <div>
          <div className="section-head">
            <h2>Zuletzt aktive Repositories</h2>
            <button className="link-btn" onClick={() => nav('repos')}>Alle ansehen →</button>
          </div>
          {loading
            ? <div className="grid-repos">{[0, 1, 2, 3].map((i) => <div className="skeleton" key={i} />)}</div>
            : <div className="grid-repos">
                {topRepos.map((r) => <RepoCard key={r.id} repo={r} onClick={() => openRepo(r)} />)}
              </div>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card">
            <div className="section-head"><h2>Aktivität</h2>
              <button className="link-btn" onClick={() => nav('activity')}>Feed →</button>
            </div>
            {loading ? <div className="skeleton" style={{ height: 120 }} />
              : commits.length === 0 ? <div className="empty">Keine öffentliche Aktivität gefunden.</div>
              : <div className="list">
                  {commits.map((c, i) => (
                    <div className="row" key={i}>
                      <div className="row-ico">{I.commit}</div>
                      <div className="row-main">
                        <p className="row-title">{c.message}</p>
                        <div className="row-sub">
                          <code>{c.repo}</code><span>{relTime(c.date)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>}
          </div>

          <div className="card">
            <div className="section-head"><h2>Commit-Streak</h2></div>
            <Streak events={events} />
          </div>
        </div>
      </div>
    </>
  )
}

function Stat({ icon, label, value, hint }) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-hint">{hint}</div>
    </div>
  )
}

function RepoCard({ repo, onClick }) {
  const d = difficulty(repo)
  return (
    <div className="card click" onClick={onClick}>
      <div className="repo-head">
        <span style={{ color: 'var(--accent)' }}>{I.repo}</span>
        <span className="repo-name">{repo.name}</span>
        <span className={`tag ${d.cls}`} style={{ marginLeft: 'auto' }}>{d.label}</span>
      </div>
      <p className="repo-desc">{repo.description || 'Keine Beschreibung hinterlegt.'}</p>
      <div className="repo-meta">
        {repo.language && (
          <span>
            <span className="lang-dot" style={{ background: LANG_COLORS[repo.language] || '#8b8f9a' }} />
            {repo.language}
          </span>
        )}
        <span>{I.star} {num(repo.stargazers_count)}</span>
        <span>{I.fork} {num(repo.forks_count)}</span>
        <span style={{ marginLeft: 'auto' }}>{relTime(repo.pushed_at)}</span>
      </div>
    </div>
  )
}

function Streak({ events }) {
  const days = useMemo(() => {
    const counts = {}
    ;(events || []).forEach((e) => {
      const d = new Date(e.created_at)
      const key = d.toISOString().slice(0, 10)
      counts[key] = (counts[key] || 0) + 1
    })
    const out = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      const key = d.toISOString().slice(0, 10)
      out.push({
        label: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()],
        active: Boolean(counts[key]),
      })
    }
    return out
  }, [events])

  return (
    <div className="streak">
      {days.map((d, i) => (
        <div className="streak-day" key={i}>
          <div className={`flame ${d.active ? 'on' : ''}`}>{I.flame}</div>
          <span>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------ Repositories ------------------------------ */
function Repositories({ repos, loading, openRepo, query }) {
  return (
    <>
      <div>
        <h1 className="page-title">Repositories</h1>
        <p className="page-sub">
          {query ? `${repos.length} Treffer für „${query}"` : `${repos.length} Repositories, neueste Aktivität zuerst`}
        </p>
      </div>
      {loading
        ? <div className="grid-repos">{[0, 1, 2, 3, 4, 5].map((i) => <div className="skeleton" key={i} />)}</div>
        : repos.length === 0
          ? <div className="empty">Keine Repositories gefunden.</div>
          : <div className="grid-repos">{repos.map((r) => <RepoCard key={r.id} repo={r} onClick={() => openRepo(r)} />)}</div>}
    </>
  )
}

/* -------------------------------- Activity -------------------------------- */
function eventsToCommits(events) {
  const out = []
  ;(events || []).forEach((e) => {
    const repo = e.repo?.name?.split('/')[1] || e.repo?.name || '—'
    if (e.type === 'PushEvent') {
      ;(e.payload?.commits || []).forEach((c) => {
        out.push({ message: c.message?.split('\n')[0] || '(kein Text)', repo, date: e.created_at })
      })
    } else if (e.type === 'PullRequestEvent') {
      const prTitle = e.payload?.pull_request?.title
      out.push({
        message: prTitle ? `PR #${e.payload?.number}: ${prTitle}` : `PR #${e.payload?.number} aktualisiert`,
        repo, date: e.created_at,
      })
    } else if (e.type === 'IssuesEvent') {
      const issueTitle = e.payload?.issue?.title
      out.push({
        message: issueTitle ? `Issue #${e.payload?.issue?.number}: ${issueTitle}` : `Issue #${e.payload?.issue?.number} aktualisiert`,
        repo, date: e.created_at,
      })
    } else if (e.type === 'ReleaseEvent') {
      out.push({ message: `Release ${e.payload?.release?.tag_name}`, repo, date: e.created_at })
    } else if (e.type === 'CreateEvent') {
      out.push({ message: `${e.payload?.ref_type || 'repo'} ${e.payload?.ref || ''} erstellt`.trim(), repo, date: e.created_at })
    }
  })
  return out.sort((a, b) => new Date(b.date) - new Date(a.date))
}

function Activity({ events, loading }) {
  const commits = eventsToCommits(events)
  return (
    <>
      <div>
        <h1 className="page-title">Activity Feed</h1>
        <p className="page-sub">Commits, PRs, Issues und Releases aus deinen öffentlichen Events</p>
      </div>
      <div className="card">
        {loading ? <div className="skeleton" style={{ height: 200 }} />
          : commits.length === 0 ? <div className="empty">Keine öffentliche Aktivität gefunden.</div>
          : <div className="list">
              {commits.slice(0, 40).map((c, i) => (
                <div className="row" key={i}>
                  <div className="row-ico">{I.commit}</div>
                  <div className="row-main">
                    <p className="row-title">{c.message}</p>
                    <div className="row-sub"><code>{c.repo}</code><span>{relTime(c.date)}</span></div>
                  </div>
                </div>
              ))}
            </div>}
      </div>
    </>
  )
}

/* ------------------------------- Repo picker ------------------------------ */
function RepoPicker({ repos, action, onPick }) {
  const titles = { issues: 'Issues', pulls: 'Pull Requests', releases: 'Releases' }
  return (
    <>
      <div>
        <h1 className="page-title">{titles[action]}</h1>
        <p className="page-sub">Wähle ein Repository, um {titles[action].toLowerCase()} zu sehen</p>
      </div>
      <div className="grid-repos">
        {repos.map((r) => (
          <div className="card click" key={r.id} onClick={() => onPick(r)}>
            <div className="repo-head">
              <span style={{ color: 'var(--accent)' }}>{I.repo}</span>
              <span className="repo-name">{r.name}</span>
            </div>
            <div className="repo-meta">
              <span>{r.open_issues_count || 0} offen</span>
              <span style={{ marginLeft: 'auto' }}>{relTime(r.pushed_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

/* ------------------------------- Repo detail ------------------------------ */
function RepoDetail({ repo, back }) {
  const [tab, setTab] = useState('commits')
  const [data, setData] = useState({ commits: [], issues: [], pulls: [], releases: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true); setError('')
    ;(async () => {
      try {
        const [commits, issues, pulls, releases] = await Promise.all([
          fetchCommits(repo.full_name).catch(() => []),
          fetchIssues(repo.full_name).catch(() => []),
          fetchPullRequests(repo.full_name).catch(() => []),
          fetchReleases(repo.full_name).catch(() => []),
        ])
        if (alive) setData({ commits, issues, pulls, releases })
      } catch (err) {
        if (alive) setError(err.message)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [repo.full_name])

  const d = difficulty(repo)

  return (
    <>
      <button className="link-btn" style={{ marginLeft: 0, marginBottom: 14 }} onClick={back}>
        ← zurück zu Repositories
      </button>
      <section className="hero" style={{ padding: '22px 24px' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 20 }}>{repo.name}</h1>
          <p>{repo.description || 'Keine Beschreibung hinterlegt.'}</p>
          <div className="hero-badges">
            <span className={`badge`}><span className={`tag ${d.cls}`}>{d.label}</span></span>
            {repo.language && (
              <span className="badge">
                <span className="lang-dot" style={{ background: LANG_COLORS[repo.language] || '#8b8f9a' }} />
                {repo.language}
              </span>
            )}
            <span className="badge gold">{I.star} {num(repo.stargazers_count)}</span>
            <span className="badge green">{I.fork} {num(repo.forks_count)}</span>
            <span className="badge">Push {relTime(repo.pushed_at)}</span>
            {repo.html_url && (
              <a className="badge indigo" href={repo.html_url} target="_blank" rel="noreferrer">
                Auf GitHub öffnen ↗
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="tabs">
        {[
          ['commits', `Commits (${data.commits.length})`],
          ['issues', `Issues (${data.issues.length})`],
          ['pulls', `PRs (${data.pulls.length})`],
          ['releases', `Releases (${data.releases.length})`],
        ].map(([id, label]) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {error && <div className="notice error"><div>{error}</div></div>}

      <div className="card">
        {loading ? <div className="skeleton" style={{ height: 180 }} /> : (
          <>
            {tab === 'commits' && (data.commits.length === 0
              ? <div className="empty">Keine Commits gefunden.</div>
              : <div className="list">{data.commits.map((c) => (
                  <div className="row" key={c.sha}>
                    <div className="row-ico">{I.commit}</div>
                    <div className="row-main">
                      <p className="row-title">{c.commit.message.split('\n')[0]}</p>
                      <div className="row-sub">
                        <code>{c.sha.slice(0, 7)}</code>
                        <span>{c.commit.author?.name}</span>
                        <span>{relTime(c.commit.author?.date)}</span>
                      </div>
                    </div>
                  </div>
                ))}</div>)}

            {tab === 'issues' && (data.issues.length === 0
              ? <div className="empty">Keine Issues gefunden.</div>
              : <div className="list">{data.issues.map((i) => (
                  <div className="row" key={i.id}>
                    <div className="row-ico">{I.issue}</div>
                    <div className="row-main">
                      <p className="row-title">#{i.number} {i.title}</p>
                      <div className="row-sub">
                        <span className={`tag ${i.state === 'open' ? 'open' : 'closed'}`}>{i.state}</span>
                        <span>{relTime(i.updated_at)}</span>
                        {i.labels?.slice(0, 3).map((l) => (
                          <span className="tag" key={l.id}>{l.name}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}</div>)}

            {tab === 'pulls' && (data.pulls.length === 0
              ? <div className="empty">Keine Pull Requests gefunden.</div>
              : <div className="list">{data.pulls.map((p) => (
                  <div className="row" key={p.id}>
                    <div className="row-ico">{I.pr}</div>
                    <div className="row-main">
                      <p className="row-title">#{p.number} {p.title}</p>
                      <div className="row-sub">
                        <span className={`tag ${p.state === 'open' ? 'open' : 'merged'}`}>{p.state}</span>
                        <span>{relTime(p.updated_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}</div>)}

            {tab === 'releases' && (data.releases.length === 0
              ? <div className="empty">Keine Releases gefunden.</div>
              : <div className="list">{data.releases.map((r) => (
                  <div className="row" key={r.id}>
                    <div className="row-ico">{I.release}</div>
                    <div className="row-main">
                      <p className="row-title">{r.name || r.tag_name}</p>
                      <div className="row-sub">
                        <code>{r.tag_name}</code>
                        <span>{fmtDate(r.published_at)}</span>
                        {r.prerelease && <span className="tag">pre-release</span>}
                      </div>
                    </div>
                  </div>
                ))}</div>)}
          </>
        )}
      </div>
    </>
  )
}

/* --------------------------------- Search --------------------------------- */
function SearchView() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async (e) => {
    e.preventDefault()
    if (q.trim().length < 2) return
    setLoading(true); setError('')
    try { setResults(await searchRepos(q)) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <>
      <div>
        <h1 className="page-title">GitHub Search</h1>
        <p className="page-sub">Öffentliche Repositories auf GitHub durchsuchen</p>
      </div>
      <form onSubmit={run} style={{ display: 'flex', gap: 10, maxWidth: 560 }}>
        <div className="search" style={{ flex: 1 }}>
          <span style={{ color: '#6b7280' }}>{I.search}</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="z. B. kubernetes security" />
        </div>
        <button className="btn" type="submit" disabled={loading}>{loading ? '…' : 'Suchen'}</button>
      </form>

      {error && <div className="notice error"><div>{error}</div></div>}

      {results.length > 0 && (
        <div className="card">
          <div className="list">
            {results.map((r) => (
              <div className="row" key={r.id}>
                <div className="row-ico">{I.repo}</div>
                <div className="row-main">
                  <p className="row-title">
                    <a href={r.html_url} target="_blank" rel="noreferrer">{r.full_name}</a>
                  </p>
                  <div className="row-sub">
                    {r.language && <span>{r.language}</span>}
                    <span>{I.star} {num(r.stargazers_count)}</span>
                    <span>{relTime(r.pushed_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

/* -------------------------------- Settings -------------------------------- */
function Settings({ onClose, onSaved }) {
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState(false)

  const save = () => {
    setToken(value.trim())
    setSaved(true)
    setTimeout(() => { onClose(); onSaved() }, 400)
  }
  const clear = () => {
    setToken('')
    setSaved(false)
    onSaved()
    onClose()
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>GitHub-Token (optional)</h3>
        <p>
          Ohne Token erlaubt GitHub 60 Anfragen pro Stunde. Mit einem eigenen
          Personal Access Token (nur <b>read</b>-Rechte nötig) sind es 5.000.
          Der Token bleibt ausschließlich in deinem Browser (localStorage) und
          wird nirgends gespeichert oder ins Repo geschrieben.
        </p>
        <input
          type="password"
          placeholder={hasToken() ? 'Token gesetzt — neues eingeben zum Ersetzen' : 'ghp_…'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="modal-actions">
          {hasToken() && <button className="btn ghost" onClick={clear}>Token entfernen</button>}
          <button className="btn ghost" onClick={onClose}>Abbrechen</button>
          <button className="btn" onClick={save} disabled={!value.trim()}>{saved ? 'Gespeichert ✓' : 'Speichern'}</button>
        </div>
      </div>
    </div>
  )
}
