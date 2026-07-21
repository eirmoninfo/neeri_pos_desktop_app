# Neeri Salon Desktop (Electron)

Production-ready Electron desktop app for your Laravel salon backend.

## Stack

- Electron + React + TypeScript + Vite
- React Router + Zustand + Axios
- Tailwind CSS

## Setup

1. Install dependencies:
   - `npm install`
2. Create env:
   - `cp .env.example .env`
3. Set your backend URL in `.env`:
   - `VITE_API_BASE_URL=https://your-api-host`

## Run

- Dev (renderer + electron): `npm run dev`
- Dev with fresh Vite cache (if HMR feels stuck): `npm run dev:renderer:clean`
- Type check: `npm run typecheck`
- Build production: `npm run build`
- Package macOS: `npm run package:mac`
- Package Windows: `npm run package:win`

## Dev troubleshooting (build / HMR stuck)

If `npm run dev` hangs after editing routes or pages:

1. Stop all terminals (`Ctrl+C`), then run `npm run dev:renderer:clean` in one terminal, or delete `node_modules/.vite` manually.
2. Restart with `npm run dev`.
3. Routes use **lazy loading** — only the changed page chunk reloads, not the whole app.
4. Avoid editing files inside `dist/`, `dist-electron/`, or `release/` while dev is running.

## Folder structure

- `electron/` main and preload process (secure bridge/token persistence)
- `src/api/` centralized API client + endpoint service modules
- `src/store/` Zustand auth/session store
- `src/components/` layout, guards, reusable table
- `src/pages/` feature pages

## Auth/session flow

- Login calls `/api/login`
- Token saved via Electron main process (encrypted with `safeStorage` when available)
- Session restored on restart from secure local token store
- Current user fetched from `/api/user`
- Global 401 handler clears session and redirects to login

## Branch and role rules

- `branch_manager` data is branch-filtered in pages using `user.branch_id`
- Admin-only actions (e.g. create/delete demo actions) are hidden for non-admin users
- Route guard system supports role checks

## Seed/demo login

- Login page prefills:
  - Email: `manager@example.com`
  - Password: `password`

## Auto updates (GitHub Releases)

The packaged app checks `eirmoninfo/neeri_pos_desktop_app` releases via `electron-updater`.

If Dashboard shows a **404 / authentication token** error:

1. Confirm the GitHub repo exists and you can open Releases.
2. Publish at least one release (with installer assets) using:
   - `GH_TOKEN=... npm run release:mac` or `GH_TOKEN=... npm run release:win`
3. If the repo is **private**, set a valid `GH_TOKEN` / `GITHUB_TOKEN` with `repo` (or Contents: Read) access before packaging/running the installed app.
4. **Recommended for salon PCs:** use a **public** releases repo (or public releases) so client machines do not need a GitHub token.

Dev mode never auto-updates (`Auto-updater is disabled in development mode`).

## Endpoint wiring checklist

- [x] `POST /api/login`
- [x] `POST /api/logout`
- [x] `GET /api/user`
- [x] `GET /api/pos/overview`
- [x] `GET /api/services`
- [x] `GET /api/services/search`
- [x] `POST /api/services`
- [x] `GET /api/services/{id}`
- [x] `PUT /api/services/{id}`
- [x] `DELETE /api/services/{id}`
- [x] `GET /api/localdata/booking-view`
- [x] `POST /api/bookings/admin`
- [x] `PUT /api/bookings/admin/{id}` (see `backend/laravel/`)
- [x] `PUT /api/localdata/bookings/{id}` (see `backend/laravel/`)
- [x] `POST /api/bookings/check-availability`
- [x] `GET /api/localdata/dashboard`
- [x] `GET /api/localdata/analytics`
- [x] `GET /api/customers`
- [x] `GET /api/customers/search`
- [x] `GET /api/customers/{id}`
- [x] `POST /api/customers`
- [x] `PUT /api/customers/{id}`
- [x] `DELETE /api/customers/{id}`
- [x] `GET /api/localdata/coussearch` (fallback if `/api/customers` missing)
- [x] `POST /api/localdata/customers` (fallback)
- [x] `PUT /api/localdata/customers/{id}` (fallback)
- [x] `DELETE /api/localdata/customers/{id}` (fallback)
