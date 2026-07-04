package data

import (
	"database/sql/driver"
	"errors"
	"testing"
	"time"
)

func TestWorkoutSessionUpdatePersistsNotesAndDate(t *testing.T) {
	performedAt := time.Date(2026, 7, 1, 18, 0, 0, 0, time.UTC)
	notes := "machine was taken, swapped to dumbbells"

	db, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "UPDATE workout_sessions SET performed_at = $1, notes = $2, version = version + 1 WHERE id = $3 AND user_id = $4 AND version = $5",
			args:        []driver.Value{performedAt, notes, int64(9), int64(7), int64(2)},
			rows: &stubRows{
				columns: []string{"version"},
				values:  [][]driver.Value{{int64(3)}},
			},
		},
	)

	model := WorkoutSessionModel{DB: db}
	session := &WorkoutSession{ID: 9, UserID: 7, PerformedAt: performedAt, Notes: &notes, Version: 2}

	if err := model.Update(session); err != nil {
		t.Fatalf("Update: %v", err)
	}
	if session.Version != 3 {
		t.Errorf("version = %d, want 3", session.Version)
	}

	stub.assertExhausted(t)
}

func TestWorkoutSessionUpdateReturnsEditConflict(t *testing.T) {
	db, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "UPDATE workout_sessions",
			rows:        &stubRows{columns: []string{"version"}},
		},
	)

	model := WorkoutSessionModel{DB: db}
	session := &WorkoutSession{ID: 9, UserID: 7, PerformedAt: time.Now(), Version: 2}

	err := model.Update(session)
	if !errors.Is(err, ErrEditConflict) {
		t.Fatalf("err = %v, want ErrEditConflict", err)
	}

	stub.assertExhausted(t)
}
