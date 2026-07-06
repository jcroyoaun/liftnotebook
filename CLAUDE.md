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
- `microservices/exerciselib/` + `frontend/` (libconsole) — exercise catalog
  admin. Shares liftnotebook-db with workouttracker (single catalog database —
  its own Postgres was retired 2026-07): console writes are live in the app
  immediately. Writes need an admin JWT or `X-Admin-Key` (break-glass).
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
- Mobile-first: bottom tab bar (Today / History / Programs / Progress), FocusLayout for
  active workouts, safe-area padding. An in-progress workout is minimizable
  (chevron in the logger header) — `ActiveWorkoutBar` docks a persistent
  mini-bar above the tab bar until Finish.
- ONE VIEW PER WORKOUT (owner's law, 2026-07-06): the logger (`/workout/:id`)
  is the ONLY view of a workout — History rows, done day cards, Progress rows
  and recent-workout lists all open it directly (edit mode for finished
  sessions, live for the active one). `/sessions/:id` survives only as a
  redirect. The logger supports the full range: log/edit sets, swap/add/remove
  exercises (session-local in localStorage via `features/workout/swaps.js`),
  session + per-exercise notes. Plan drift (swap/add/remove/extra recorded
  sets) is reconciled ONCE, at save time, via the scope prompt: "This workout
  only" / "All future workouts" (the latter rewrites the day template).
  Never reintroduce a separate view-vs-edit representation of a workout.
  Dashboard days always render in program order (badge moves, cards don't);
  done/in-progress day cards hide "Edit plan" (the workout is the surface).
- E2E locators are copy-based — keep visible copy stable or update
  `e2e/*.spec.js` in the same commit.

## Commands

- Backend: `cd microservices/workouttracker && go test ./...`
- Webapp: `cd microservices/webapp && npm run test:unit && npm run lint && npm run build`
- E2E (needs local stack): `npx playwright test` — 23 tests incl. offline logging.
- Local stack: docker postgres:16 → `go run ./cmd/api -db-dsn ... -migrate-only` →
  seed `dumps/seed.sql` → API on :4001 → `npm run dev -- --port 3000` (proxies
  /v1; vite defaults to 5173 without the flag and e2e expects 3000).
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
  at deploy). The JWT carries `role`; workouttracker's `requireAdmin`
  middleware gates `/v1/admin/*` and template writes; exerciselib validates
  the same JWT (shared jwt-secret, mirrored into `exerciselib-app-secrets`)
  for catalog writes — libconsole signs in with a LiftNotebook admin account;
  X-Admin-Key remains as break-glass.
- Single catalog DB: exerciselib pods connect to
  `liftnotebook-db.liftnotebook.svc.cluster.local` using the
  `liftnotebook-db-credentials` secret (mirrored cross-namespace by the
  deploy script). Catalog/schema changes ship as workouttracker migrations —
  there is no second database to sync anymore. The old `exerciselib-db`
  Postgres cluster was decommissioned 2026-07-04 (CR + pod + 1Gi PVC deleted;
  catalogs verified byte-identical first).
- Password reset is admin-assisted (no email infra by design): admins mint
  one-time codes in Settings → Members (`POST /v1/admin/users/:id/reset-token`,
  2h expiry, sha256-hashed in the `tokens` table); users redeem at
  `/reset-password` (`PUT /v1/users/password`). Self-service change lives in
  Settings (`POST /v1/me/password`).

## Roadmap (approved plan: ~/.claude/plans/cryptic-wobbling-starfish.md)

- ✅ P0 hardening + P1 training core (progression engine, offline logger, charts)
- ✅ Cobalt redesign + liftnotebook.app domain move
- ✅ Training UX batch: fixed dashboard day order, minimizable workout +
  ActiveWorkoutBar, read-only /sessions/:id + history, planned weekly volume,
  admin role (users.role + ADMIN_EMAILS), +16 catalog exercises + adductors
  body part + mapping repairs
- ✅ Accounts + templates batch (2026-07): admin-assisted password reset +
  change-password, program templates (admin-authored, one-tap "Start this
  block" via `POST /v1/templates/:id/start`), Coach's corner admin UI
  (template builder + members/reset codes), catalog DB unification
  (exerciselib → liftnotebook-db, live cutover verified, old cluster
  decommissioned), character pass (AuthShell aurora + barbell mark, dashboard
  greeting, workout-finish summary sheet, house-voice microcopy). Deployed
  2026-07-04, images sha-b051054e84fc.

- ✅ Training-flow batch (2026-07): mid-workout exercise swap (session-local
  via localStorage `sessionSwaps:*` + optional persist to the day template),
  rest-timer web push (VAPID keypair in `liftnotebook-app-secrets`
  vapid-public/private-key, `push_subscriptions` table, in-memory per-user
  alarm scheduler — single replica by design; Settings toggle), edit-past-workout
  escape hatch (/sessions/:id → Edit workout → /workout/:id) + session
  notes (PATCH /v1/sessions/:id). Playwright: e2e/edit-and-swap.spec.js;
  role-name locators must use exact: true (swap buttons share exercise-name
  substrings).

- ✅ Benchmark batch (2026-07-04, persona UX benchmark → fixes): migration
  000009. (1) Data integrity: RIR chips select-only (tap-on-selected is a
  no-op; new sets never inherit RIR), sync no longer clobbers in-flight edits
  (onSuccess merges only id/version), NumberStepper select-race fixed +
  sanity clamps (500 kg / 100 reps). (2) History first-class: History tab
  (/history, GET /v1/me/sessions paginated cross-block), per-set "Last:"
  ghosts + dated full-set "Last time" line in the logger (suggestions carry
  last_sets/last_performed_at/last_notes), planned set rows pre-created as
  LOCAL drafts (nothing hits the server until touched; + Add Set = extras
  only), /sessions/:id in logged order + time-of-day, finish-sheet View
  workout + notes box, done day cards link to the workout ("Start again").
  (3) Unilateral: exercises.laterality ('bilateral'|'unilateral', catalog
  column, libconsole select), workout_sets.weight_left/right — one row = one
  L+R pair = ONE set, canonical weight = min(L,R) (weak side drives double
  progression); set counts everywhere stay pair-based; CSV/JSON exports carry
  L/R + session_id + local dates. (4) Per-exercise notes:
  workout_exercise_notes (PK session+exercise, dated), PUT
  /v1/sessions/:id/exercises/:exid/note, editable in the logger, last 2 shown
  dated under "Last time" (equipment-substitution memory). (5) iOS push
  repair: sw.js ALWAYS shows the notification (silent-skip = 3-strike
  subscription revocation on iOS), permission prompt before any await,
  pushsubscriptionchange + startup health check, Declarative Web Push payload
  (web_push 8030), rest alarm rides POST /v1/sets rest_ends_at (offline-safe),
  server logs schedule/fire/send status, POST /v1/me/push-test + Settings
  "Send test notification", /v1/push/public-key returns subscribed. (6) Rest
  timer: Settings duration control (Off/1:30/2:00/3:00, localStorage
  restTimerSeconds), un-record cancels timer, Go! banner auto-dismisses.
  (7) Dashboard truth: SETS tile counts actual recorded sets, workouts =
  distinct days, Up next = first not-done day. (8) Guards: delete-recorded
  confirm, Discard workout, mid-workout start guard, edit mode ("Done
  editing", no re-celebration), template-builder dirty/preset/empty-publish
  guards, /workout dead-end has Back to Today. Exercise line-art fully
  removed. e2e: 36 tests incl. e2e/bench-features.spec.js. NOTE: seed.sql
  re-applies the laterality backfill for fresh envs (migration runs before
  seed).

- ✅ One-workout-view batch (2026-07-06): killed the read-only /sessions/:id
  page (now a redirect); every workout surface opens the logger (edit mode
  inferred data-side for finished sessions — never trusts router state
  alone); logger gained add/remove exercise + session-notes card; plan
  drift reconciles once at save via the scope prompt (This workout only /
  All future workouts); tonnage fully purged from the backend
  (total_volume_kg dropped from GET /v1/me/sessions). e2e: 38 tests.

### Next up

- Email self-service password reset via Resend (owner creates the account +
  API key; token machinery already exists — only delivery is new; falls back
  to admin codes when unconfigured). Also solves the admin-lockout case.
- MCP server for voice logging: mount streamable-HTTP MCP at /mcp inside
  workouttracker (start_workout/log_set/next_exercise/finish_workout tools,
  JWT auth) — phone clients with remote-connector support attach to it.
- Chart kit, app icon/splash refresh, exercise detail page (P3).
- ✅ Templates seeded: #1 Upper/Lower Maximalist — Injury Edition (owner),
  #2 Upper/Lower Maximalist (regular).
- Optional add-on: chart kit — src/components/charts/ (shared ChartTooltip +
  TrendChart/HBarChart wrappers baking in theme/grid/axis defaults). The
  chartTheme.js token layer is solid; the gap is hand-rolled Recharts markup
  duplicated per page (3 tooltip components across 2 pages). Do it right
  before building the PR/metrics dashboards.

### Later phases

- P3: exercise library enrichment (video/instructions — console needs a video
  URL field once the catalog is unified), body metrics/photos/PRs. The
  exercise detail modal is the last old-style UI — becomes a full page here.
- P4: nutrition (TDEE, intake log, recipes)
