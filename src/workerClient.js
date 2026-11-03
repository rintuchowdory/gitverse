// Client for the GitVerse Worker (Cloudflare). Provider tokens live there,
// never in the browser bundle.
export const WORKER_URL =
  (import.meta.env.VITE_WORKER_URL || 'https://gitverse-api.chowdoryrintu.workers.dev').replace(/\/+$/, '')

async function call(path, options = {}) {
  const res = await fetch(WORKER_URL + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = { ok: false, error: 'bad_response' } }
  if (!res.ok && data.ok === undefined) data.ok = false
  return data
}

export const health = () => call('/health')

export const deployments = () => call('/deployments')

export const ciRuns = (repo) => call('/ci?repo=' + encodeURIComponent(repo))

export const analyzeRun = (repo, runId) =>
  call('/ci/analyze', { method: 'POST', body: JSON.stringify({ repo, runId }) })

export const brief = () => call('/brief')

export const digest = () => call('/digest')

export const getWatchlist = () => call('/watchlist')

export const saveWatchlist = (data) =>
  call('/watchlist', { method: 'PUT', body: JSON.stringify(data) })
