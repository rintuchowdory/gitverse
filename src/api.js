// Read-only GitHub API client. Public endpoints only; an optional personal
// access token can be supplied in the UI to lift the rate limit (read-only use).
const BASE = 'https://api.github.com'
const CACHE_TTL = 5 * 60 * 1000

export const rate = { limit: null, remaining: null, reset: null, user: null }

function token() {
  try { return localStorage.getItem('gitverse_token') || '' } catch { return '' }
}
export function setToken(t) {
  try { t ? localStorage.setItem('gitverse_token', t) : localStorage.removeItem('gitverse_token') } catch {}
}
export function hasToken() {
  return Boolean(token())
}

function cacheGet(key) {
  try {
    const raw = sessionStorage.getItem('gv:' + key)
    if (!raw) return null
    const { t, d } = JSON.parse(raw)
    if (Date.now() - t > CACHE_TTL) return null
    return d
  } catch { return null }
}
function cacheSet(key, d) {
  try { sessionStorage.setItem('gv:' + key, JSON.stringify({ t: Date.now(), d })) } catch {}
}

export class GitHubError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function get(path, { key = path, force = false } = {}) {
  if (!force) {
    const hit = cacheGet(key)
    if (hit) return hit
  }
  const headers = { Accept: 'application/vnd.github+json' }
  const tk = token()
  if (tk) headers.Authorization = 'Bearer ' + tk

  const res = await fetch(BASE + path, { headers })
  const lim = res.headers.get('x-ratelimit-limit')
  const rem = res.headers.get('x-ratelimit-remaining')
  if (lim) rate.limit = Number(lim)
  if (rem) rate.remaining = Number(rem)

  if (res.status === 403 || res.status === 429) {
    throw new GitHubError('GitHub API rate limit reached. Add a token in Settings or try again later.', res.status)
  }
  if (res.status === 404) {
    throw new GitHubError('Not found on GitHub.', res.status)
  }
  if (!res.ok) {
    throw new GitHubError('GitHub request failed (' + res.status + ').', res.status)
  }
  const data = await res.json()
  cacheSet(key, data)
  return data
}

export async function fetchUser(login, force) {
  const u = await get('/users/' + login, { key: 'user:' + login, force })
  cacheSet('login', login)
  return u
}

export async function fetchRepos(login, force) {
  const repos = await get('/users/' + login + '/repos?per_page=100&sort=updated', {
    key: 'repos:' + login, force,
  })
  return repos.filter((r) => !r.fork).concat(repos.filter((r) => r.fork))
}

export async function fetchEvents(login, force) {
  return get('/users/' + login + '/events/public?per_page=60', { key: 'events:' + login, force })
}

export async function fetchCommits(fullName, force) {
  return get('/repos/' + fullName + '/commits?per_page=12', { key: 'commits:' + fullName, force })
}

export async function fetchIssues(fullName, force) {
  const list = await get(
    '/repos/' + fullName + '/issues?state=all&per_page=20&sort=updated',
    { key: 'issues:' + fullName, force }
  )
  return list.filter((i) => !i.pull_request)
}

export async function fetchPullRequests(fullName, force) {
  const list = await get(
    '/repos/' + fullName + '/issues?state=all&per_page=20&sort=updated',
    { key: 'issues:' + fullName, force }
  )
  return list.filter((i) => i.pull_request)
}

export async function fetchReleases(fullName, force) {
  return get('/repos/' + fullName + '/releases?per_page=10', { key: 'releases:' + fullName, force })
}

export async function searchRepos(q) {
  if (!q || q.trim().length < 2) return []
  return (await get('/search/repositories?q=' + encodeURIComponent(q) + '&per_page=20', {
    key: 'search:' + q,
  })).items || []
}
