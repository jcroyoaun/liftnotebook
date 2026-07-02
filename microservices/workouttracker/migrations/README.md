# Migrations

Schema changes for the workouttracker (liftnotebook) database. Applied
automatically at API startup via golang-migrate (see `migrations.go`), or
manually with the `-migrate-only` flag:

```sh
go run ./cmd/api -db-dsn "$WORKOUTTRACKER_DB_DSN" -migrate-only
```

## Adding a migration

1. Create a sequentially numbered pair of files:
   `00000N_short_name.up.sql` and `00000N_short_name.down.sql`.
2. Write plain incremental SQL (`ALTER TABLE ...`) in the up file and its
   reverse in the down file. Only `000001` needs to be idempotent — it doubles
   as the adoption baseline for databases created before migration tracking.
3. `go test ./...` — the migrations package test checks the files parse.
4. Deploy; the API applies pending migrations on startup before serving.

## Rules

- Never change a migration file that has already been deployed; add a new one.
- Schema changes land only here — never by editing bootstrap/seed SQL
  (see docs/db-migrations-refactor.md).
- Seed/reference data (exercise catalog) is separate: `dumps/seed.sql`,
  applied explicitly via the bootstrap job (`RUN_DB_BOOTSTRAP=true` on
  scripts/deploy-linode.sh) for fresh environments only.
