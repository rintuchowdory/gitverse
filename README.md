# GitVerse

Read-only GitHub repository dashboard. Repos, commits, issues, pull requests and
releases at a glance, in a dark developer UI.

**Live:** https://rintuchowdory.github.io/gitverse/

## Features

- Dashboard with repo totals, stars, forks, open issues and top language
- Repository grid with language, stars, forks and last push
- Activity feed built from public GitHub events (pushes, PRs, issues, releases)
- Commit streak over the last 7 days
- Repository detail view with tabs for commits, issues, PRs and releases
- Global GitHub repository search
- Optional personal access token (browser-only, read-only) to raise the API rate limit

## Data and privacy

Everything runs in the browser against the public GitHub API. There is no backend,
no database and no write access. The default account is `rintuchowdory`; the
optional token is stored only in your browser's local storage and is never
committed or sent anywhere except `api.github.com`.

Unauthenticated requests are limited to 60 per hour; responses are cached per
session for 5 minutes.

## Development

```bash
npm install
npm run dev      # http://localhost:5173/gitverse/
npm run build    # production build into dist/
```

Deployment runs on GitHub Actions: every push to `main` builds the site and
publishes it to GitHub Pages.

## Services (v2)

GitVerse now covers more than GitHub. A Cloudflare Worker (`gitverse-worker/`) sits in
front of the provider APIs so no token ever reaches the browser.

| View | What it does | Source |
| --- | --- | --- |
| Deployments | live / failed / building for Render, Cloudflare Pages and Vercel | Render API, Cloudflare API, Vercel API |
| CI Detective | failed GitHub Actions runs, the exact broken step, log excerpt, German fix suggestion | GitHub Actions API + Groq |
| AI Briefing | short German situation report across deployments and CI | Groq (`openai/gpt-oss-120b`) |
| Watchlist | repos checked by the detective and the daily digest | Cloudflare KV |

Worker endpoints: `/health`, `/deployments`, `/ci?repo=`, `/ci/analyze`,
`/brief`, `/digest`, `/watchlist`, `/ask`.

### Worker deployment

```bash
cd gitverse-worker
npx wrangler deploy
npx wrangler secret put RENDER_API_KEY      # and the others listed below
```

Secrets: `RENDER_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
`VERCEL_TOKEN`, `GROQ_API_KEY`, `GITHUB_TOKEN`, optional `GROQ_MODEL`.

CORS is limited to `https://rintuchowdory.github.io` and local dev origins.
