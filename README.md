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
