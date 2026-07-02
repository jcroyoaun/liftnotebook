# LiftNotebook

Workout tracker (goal: rival TrainWise). Users: owner + wife + friends, invite-gated.
The house training style is FIRST-CLASS: **2 working sets per exercise, taken to
failure (RIR 0), 8–12 reps, double progression** — defaults everywhere; other styles
are just different per-exercise target values.

## Architecture

- `microservices/workouttracker/` — Go API (httprouter, database/sql, JWT). The
  single user-facing API; all new backend features go here. Alex Edwards-style
  layout: handlers in `cmd/api/`, models in `internal/data/` (sqlstub tests),
  embedded migrations in `migrations/` (golang-migrate, run at startup — see
  migrations/README.md; NEVER edit a deployed migration).
- `microservices/webapp/` — React 19 + Vite + Tailwind 4 + Recharts + TanStack
  Query PWA. Offline set logging via IndexedDB-persisted mutations; sets are
  idempotent per client-generated UUID (`client_id`).
- `microservices/exerciselib/` + `frontend/` (libconsole) — exercise catalog admin,
  slated for retirement in Phase 3 (absorb into workouttracker). Writes need
  `X-Admin-Key`.
- Deploys to a tiny 2-node Linode k8s cluster (1 vCPU/2GB each) — **no new
  microservices or Postgres clusters**; extend workouttracker instead.

## Webapp conventions

- Design system = "Cobalt" (cool slate light / deep blue-black dark, electric
  cobalt accent, Inter body + Space Grotesk display; `.text-grad` gradient is
  wordmark-only). ALL tokens live in `src/index.css`:
  semantic classes only — `bg-page/card/raised/sunken`, `text-ink/-2/-3/-4`,
  `border-line/-2`, `text-accent`, `bg-accent-solid/-press`, `text-on-accent`,
  `bg-wash`, `text-ok/danger/warn` (+`-wash`), `rounded-card/btn/field/sheet`,
  `shadow-card/raised/sheet`, `font-display`. Stock Tailwind color scales are
  PURGED — `blue-600` etc. will not compile. Never hardcode hex outside
  `index.css`/`chartTheme.js`. Text contrast must stay ≥4.5:1 in both themes.
- Dark mode: `.dark` class on `<html>` via `ThemeProvider` (`src/lib/theme.jsx`,
  light/dark/system, persisted in localStorage). Tokens flip automatically —
  never write `dark:` variants for color. Charts must use `useChartTheme()`.
- UI primitives in `src/components/ui/` (Button, Card, Input, NumberStepper,
  StatTile, BottomSheet, ConfirmSheet, PageHeader, Skeleton, Toast). Use them.
  All overlays are BottomSheets. Touch targets ≥44px.
- NEVER use browser `alert()`/`confirm()` — use `useToast()` from
  `src/lib/toastContext` and `ConfirmSheet`.
- Loading states use `Skeleton`/`PageSkeleton`, never "Loading..." text.
- Charts follow `src/lib/chartTheme.js` (validated palette: #2563eb primary,
  dark-surface steps included — re-run the dataviz validator before adding
  slots): solid 1px hairline grids, 2px lines, dots with surface ring, ≤24px
  bars with 4px rounded data-end, no legend for single series, endpoint direct
  labels, text in ink tokens never series colors.
- Micro-interactions: pressed/active states on everything (`active:scale`),
  `animate-stamp/rise/pop/fade-in` keyframes from `index.css`, count-up stat
  tiles via `useAnimatedNumber` (respects prefers-reduced-motion).
- User-facing copy says "training block", not "mesocycle" (code keeps mesocycle).
- Weights are stored/displayed in kg ONLY (canonical); lb exists solely as an
  input-side toggle in the logger (`src/lib/units.js` converts at commit).
- House philosophy in UI copy: sets + "to failure" — never surface rep-range
  prescriptions (the target_rep_range columns are inert defaults).
- Mobile-first: bottom tab bar (Today / Programs / Progress), FocusLayout for
  active workouts, safe-area padding. An in-progress workout is minimizable
  (chevron in the logger header) — `ActiveWorkoutBar` docks a persistent
  mini-bar above the tab bar until Finish. `/sessions/:id` is the read-only
  view of a logged workout; `/workout/:id` is the only editable surface.
  Dashboard days always render in program order (badge moves, cards don't).
- E2E locators are copy-based — keep visible copy stable or update
  `e2e/*.spec.js` in the same commit.

## Commands

- Backend: `cd microservices/workouttracker && go test ./...`
- Webapp: `cd microservices/webapp && npm run test:unit && npm run lint && npm run build`
- E2E (needs local stack): `npx playwright test` — 23 tests incl. offline logging.
- Local stack: docker postgres:16 → `go run ./cmd/api -db-dsn ... -migrate-only` →
  seed `dumps/seed.sql` → API on :4001 → `npm run dev` on :3000 (proxies /v1).
- Deploy: push to master → GitHub Actions builds images + commits pinned tags →
  `git pull` → `KUBECONFIG_PATH=$PWD/kubeconfig BUILD_IMAGES=false ./scripts/deploy-linode.sh`
  (kubeconfig is gitignored, lives at repo root). Fresh envs only: `RUN_DB_BOOTSTRAP=true`.
- Domains: liftnotebook.app = webapp, exerciselib.liftnotebook.app = library
  console (old *.totalcomp.mx hosts stay as gateway aliases for installed
  PWAs). Cloudflare proxies both zones (Flexible SSL — origin is HTTP:80
  behind Istio) and honors origin cache
  headers. webapp nginx.conf: immutable caching is for hashed `/assets/`
  ONLY — `sw.js`/`index.html`/manifest must stay `no-cache` or installed
  PWAs pin to old builds. After changing stable-named files (icons), bump
  their `?v=` query or purge Cloudflare.
- Invite code / admin key live in k8s secrets (`liftnotebook-app-secrets`,
  `exerciselib-app-secrets`) — deploy script prints retrieval commands.
- User hierarchy: `users.role` (user/admin); admins come ONLY from
  `ADMIN_EMAILS` (secret key `admin-emails`, set via `LIFTNOTEBOOK_ADMIN_EMAILS`
  at deploy). The JWT carries `role`; exerciselib validates it (shared
  jwt-secret, mirrored into `exerciselib-app-secrets`) for catalog writes —
  libconsole signs in with a LiftNotebook admin account; X-Admin-Key remains
  as break-glass. exerciselib's DB has no migration runner: catalog/schema
  changes must be applied to it manually (workouttracker migrations 000003+
  are written by-name/idempotent so they can be replayed there via psql).

## Roadmap (approved plan: ~/.claude/plans/cryptic-wobbling-starfish.md)

- ✅ P0 hardening + P1 training core (progression engine, offline logger, charts)
- P2: program templates + seeded "Tremendous" programs (2-sets-to-failure splits)
- P3: exercise library enrichment (video/instructions), body metrics/photos/PRs,
  retire exerciselib. The exercise detail modal is the last old-style UI — becomes
  a full page here.
- P4: nutrition (TDEE, intake log, recipes)
- Deferred from P1: mid-workout exercise swap, session notes editing (needs a
  PATCH /v1/sessions/:id endpoint).
