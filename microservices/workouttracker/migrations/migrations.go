// Package migrations embeds the SQL migration files and applies them with
// golang-migrate. Running migrations in-process at startup keeps the
// FROM scratch container image free of any external migration tooling.
package migrations

import (
	"database/sql"
	"embed"
	"errors"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

//go:embed *.sql
var files embed.FS

// Up applies all pending migrations. It is safe to run on every startup:
// golang-migrate takes a Postgres advisory lock so concurrent attempts
// serialize, and an already up-to-date database is a no-op.
//
// Databases bootstrapped before migration tracking existed are adopted
// automatically: 000001_init.up.sql is idempotent, so applying it against an
// existing schema no-ops and records version 1 in schema_migrations.
func Up(db *sql.DB) error {
	sourceDriver, err := iofs.New(files, ".")
	if err != nil {
		return err
	}

	dbDriver, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		return err
	}

	m, err := migrate.NewWithInstance("iofs", sourceDriver, "postgres", dbDriver)
	if err != nil {
		return err
	}

	err = m.Up()
	if err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return err
	}

	return nil
}
