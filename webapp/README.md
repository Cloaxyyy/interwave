# @interwave/webapp

The browser version of Interwave — a thin React app that ships at
[interwave.cc/app/](https://interwave.cc/app/).

This package is part of the pnpm workspace at the repo root. The desktop Tauri
app (root `package.json`) and this webapp share types via `@interwave/shared`.

## Develop

```bash
pnpm install              # from repo root, installs all workspaces
pnpm --filter @interwave/webapp dev
# open http://localhost:5173/app/
```

## Required env vars

Create `webapp/.env.local` (gitignored):

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

The same secrets the desktop build uses — both apps share one Supabase project.

## Build

```bash
pnpm --filter @interwave/webapp build
# outputs to webapp/dist/
```

## Deploy

CI (`.github/workflows/pages.yml`) runs the build on every push to `main`,
copies `webapp/dist/` into `web/app/`, and uploads the combined `web/` tree to
GitHub Pages. The result is served at `interwave.cc/app/` alongside the
marketing site at `interwave.cc/`.
