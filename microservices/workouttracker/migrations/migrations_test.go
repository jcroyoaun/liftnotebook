package migrations

import (
	"testing"

	"github.com/golang-migrate/migrate/v4/source/iofs"
)

// TestEmbeddedMigrationsParse verifies every embedded migration filename is
// well-formed and the sequence starts at the baseline version.
func TestEmbeddedMigrationsParse(t *testing.T) {
	driver, err := iofs.New(files, ".")
	if err != nil {
		t.Fatalf("embedded migrations failed to parse: %v", err)
	}

	first, err := driver.First()
	if err != nil {
		t.Fatalf("no migrations found: %v", err)
	}

	if first != 1 {
		t.Errorf("first migration version = %d; want 1 (the adoption baseline)", first)
	}

	// Walk the chain to catch gaps or duplicate versions.
	version := first
	for {
		next, err := driver.Next(version)
		if err != nil {
			break
		}
		if next != version+1 {
			t.Errorf("migration versions must be sequential: %d is followed by %d", version, next)
		}
		version = next
	}
}
