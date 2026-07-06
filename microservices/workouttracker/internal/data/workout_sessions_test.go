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

func TestListForMesocycleExposesRecordedSetCounts(t *testing.T) {
	now := time.Now()

	db, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "SELECT count(*) FROM workout_sets s WHERE s.workout_session_id = ws.id AND s.recorded",
			args:        []driver.Value{int64(7), int64(3)},
			rows: &stubRows{
				columns: []string{"id", "user_id", "mesocycle_id", "training_day_id", "label", "performed_at", "notes", "recorded_sets", "week_number", "created_at", "version"},
				values: [][]driver.Value{
					{int64(20), int64(7), int64(3), int64(1), "Push", now, nil, int64(6), int64(2), now, int64(1)},
					{int64(21), int64(7), int64(3), int64(2), "Pull", now, nil, int64(0), int64(2), now, int64(1)},
				},
			},
		},
	)

	model := WorkoutSessionModel{DB: db}

	sessions, err := model.ListForMesocycle(7, 3)
	if err != nil {
		t.Fatalf("ListForMesocycle: %v", err)
	}
	if len(sessions) != 2 {
		t.Fatalf("len = %d, want 2", len(sessions))
	}
	if sessions[0].RecordedSets != 6 || sessions[1].RecordedSets != 0 {
		t.Errorf("recorded sets = %d/%d, want 6/0 (abandoned session must be distinguishable)",
			sessions[0].RecordedSets, sessions[1].RecordedSets)
	}
	if sessions[0].WeekNumber != 2 {
		t.Errorf("week_number = %d, want 2 (user-defined week rides the session)", sessions[0].WeekNumber)
	}

	stub.assertExhausted(t)
}

func TestListForUserPaginates(t *testing.T) {
	now := time.Now()

	db, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "WHERE ws.user_id = $1 ORDER BY ws.performed_at DESC, ws.id DESC LIMIT $2 OFFSET $3",
			args:        []driver.Value{int64(7), int64(2), int64(2)},
			rows: &stubRows{
				columns: []string{"count", "id", "performed_at", "label", "mesocycle_id", "name", "recorded_sets", "exercises"},
				values: [][]driver.Value{
					{int64(5), int64(20), now, "Upper A", int64(3), "Upper/Lower Maximalist", int64(6), []byte(`{"Flat Barbell Bench Press","Back Squat"}`)},
					{int64(5), int64(19), now, "Lower A", int64(2), "Old Block", int64(0), []byte(`{}`)},
				},
			},
		},
	)

	model := WorkoutSessionModel{DB: db}

	sessions, total, err := model.ListForUser(7, 2, 2)
	if err != nil {
		t.Fatalf("ListForUser: %v", err)
	}
	if total != 5 {
		t.Errorf("total = %d, want 5", total)
	}
	if len(sessions) != 2 {
		t.Fatalf("len = %d, want 2", len(sessions))
	}
	if sessions[0].MesocycleName != "Upper/Lower Maximalist" || sessions[0].RecordedSets != 6 {
		t.Errorf("unexpected first summary %+v", sessions[0])
	}
	if len(sessions[0].Exercises) != 2 || sessions[0].Exercises[0] != "Flat Barbell Bench Press" {
		t.Errorf("exercises = %v, want first-set order preserved", sessions[0].Exercises)
	}
	if sessions[1].Exercises == nil || len(sessions[1].Exercises) != 0 {
		t.Errorf("empty session exercises = %#v, want empty non-nil slice", sessions[1].Exercises)
	}

	stub.assertExhausted(t)
}

func TestWorkoutSessionDeleteReturnsNotFoundForForeignSession(t *testing.T) {
	db, stub := newStubDB(t,
		stubExpectation{
			op:          "exec",
			sqlContains: "DELETE FROM workout_sessions WHERE id = $1 AND user_id = $2",
			args:        []driver.Value{int64(9), int64(7)},
			result:      driver.RowsAffected(0),
		},
	)

	model := WorkoutSessionModel{DB: db}

	err := model.Delete(9, 7)
	if !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("err = %v, want ErrRecordNotFound", err)
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
