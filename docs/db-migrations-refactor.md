# DB Migrations Refactor

## Problem

The current deploy flow mixes routine app rollout with database bootstrap:

- `scripts/deploy-linode.sh` reruns database bootstrap jobs on normal deploys.
- Schema creation and seed loading are handled by shared bootstrap jobs instead of a standard migration workflow.
- This makes deploys noisy, harder to reason about, and easy to misuse.

## Target State

Each app owns its own database migrations and runs them in a standard, repeatable way.

- `exerciselib` owns the `exerciselib` schema and migration history.
- `workouttracker` owns the `liftnotebook` schema and migration history.
- Routine app deploys do not rerun bootstrap SQL or reseed databases.
- Seed/reference data is handled explicitly, not as part of every deploy.

## Desired Design

### Migration ownership

- Put migrations alongside each service source code.
- Each service gets a migration table/version history in its own database.
- New schema changes are introduced only through ordered migrations.

### Runtime model

Candidate approaches:

- Each app Deployment gets an init container that runs migrations before the app container starts.
- A dedicated migration Job per service runs as part of deployment, but separate from app startup.

Selection rule:

- If init containers are used, the migration tool must safely handle concurrent startup attempts.
- If that is not guaranteed, prefer a dedicated migration Job or equivalent pre-deploy migration step.

### Standardization

- Use one migration tool consistently across services.
- Define one command shape per service, for example:
  - `migrate up`
  - `migrate status`
  - `migrate create <name>`
- Document the workflow for adding a new migration.

### Seed data

- Treat seed/reference data separately from schema migrations.
- Seed only when explicitly requested, or make seeding idempotent and environment-aware.
- Do not reseed on every routine deploy.

## Refactor Plan

1. Pick a migration tool and standard command interface.
2. Move existing schema bootstrap SQL into real migration files.
3. Decide what seed data is still required and split it from schema setup.
4. Add per-service migration runner support.
5. Update Kubernetes manifests to run migrations in a standard way.
6. Remove bootstrap jobs from normal deploy flow.
7. Keep a separate bootstrap/reset path for fresh environments only.

## Open Questions

- Should migrations run via init containers or standalone Jobs?
- Should `exerciselib` and `workouttracker` keep separate databases long-term?
- Which seed data is essential in production versus dev-only?

## Rule Going Forward

No schema change should be introduced by editing bootstrap SQL alone.
All schema changes should land as explicit service-owned migrations.
