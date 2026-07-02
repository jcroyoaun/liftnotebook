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

- UI primitives in `src/components/ui/` (Button, Card, Input, NumberStepper,
  StatTile, BottomSheet, ConfirmSheet, PageHeader, Skeleton, Toast). Use them.
- NEVER use browser `alert()`/`confirm()` — use `useToast()` from
  `src/lib/toastContext` and `ConfirmSheet`.
- Loading states use `Skeleton`/`PageSkeleton`, never "Loading..." text.
- Charts follow `src/lib/chartTheme.js` (validated palette: #2a78d6 primary):
  solid 1px hairline grids, 2px lines, dots with white ring, ≤24px bars with
  4px rounded data-end, no legend for single series, endpoint direct labels,
  text in slate tokens never series colors.
- User-facing copy says "training block", not "mesocycle" (code keeps mesocycle).
- Mobile-first: bottom tab bar (Today / Programs / Progress), FocusLayout for
  active workouts, safe-area padding.

## Commands

- Backend: `cd microservices/workouttracker && go test ./...`
- Webapp: `cd microservices/webapp && npm run test:unit && npm run lint && npm run build`
- E2E (needs local stack): `npx playwright test` — 23 tests incl. offline logging.
- Local stack: docker postgres:16 → `go run ./cmd/api -db-dsn ... -migrate-only` →
  seed `dumps/seed.sql` → API on :4001 → `npm run dev` on :3000 (proxies /v1).
- Deploy: push to master → GitHub Actions builds images + commits pinned tags →
  `git pull` → `KUBECONFIG_PATH=$PWD/kubeconfig BUILD_IMAGES=false ./scripts/deploy-linode.sh`
  (kubeconfig is gitignored, lives at repo root). Fresh envs only: `RUN_DB_BOOTSTRAP=true`.
- Invite code / admin key live in k8s secrets (`liftnotebook-app-secrets`,
  `exerciselib-app-secrets`) — deploy script prints retrieval commands.

## Roadmap (approved plan: ~/.claude/plans/cryptic-wobbling-starfish.md)

- ✅ P0 hardening + P1 training core (progression engine, offline logger, charts)
- P2: program templates + seeded "Tremendous" programs (2-sets-to-failure splits)
- P3: exercise library enrichment (video/instructions), body metrics/photos/PRs,
  retire exerciselib. The exercise detail modal is the last old-style UI — becomes
  a full page here.
- P4: nutrition (TDEE, intake log, recipes)
- Deferred from P1: mid-workout exercise swap, session notes editing (needs a
  PATCH /v1/sessions/:id endpoint).
