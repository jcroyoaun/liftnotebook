package data

import (
	"database/sql/driver"
	"errors"
	"testing"
	"time"
)

func TestExerciseNoteUpsertScopedToOwner(t *testing.T) {
	now := time.Now()

	db, stub := newStubDB(t,
		stubExpectation{
			op: "query",
			sqlContains: "INSERT INTO workout_exercise_notes (workout_session_id, exercise_id, note) SELECT $1, $2, $3 " +
				"FROM workout_sessions ws WHERE ws.id = $1 AND ws.user_id = $4 " +
				"ON CONFLICT (workout_session_id, exercise_id) DO UPDATE SET note = EXCLUDED.note",
			args: []driver.Value{int64(9), int64(31), "Panatta taken, used Lifefitness at 45 kg", int64(7)},
			rows: &stubRows{
				columns: []string{"created_at", "version"},
				values:  [][]driver.Value{{now, int64(1)}},
			},
		},
	)

	model := ExerciseNoteModel{DB: db}
	note := &ExerciseNote{WorkoutSessionID: 9, ExerciseID: 31, Note: "Panatta taken, used Lifefitness at 45 kg"}

	if err := model.UpsertForUser(note, 7); err != nil {
		t.Fatalf("UpsertForUser: %v", err)
	}
	if note.Version != 1 {
		t.Errorf("version = %d, want 1", note.Version)
	}

	stub.assertExhausted(t)
}

func TestExerciseNoteUpsertReturnsNotFoundForForeignSession(t *testing.T) {
	db, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "INSERT INTO workout_exercise_notes",
			rows:        &stubRows{columns: []string{"created_at", "version"}},
		},
	)

	model := ExerciseNoteModel{DB: db}
	note := &ExerciseNote{WorkoutSessionID: 9, ExerciseID: 31, Note: "not mine"}

	err := model.UpsertForUser(note, 7)
	if !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("err = %v, want ErrRecordNotFound", err)
	}

	stub.assertExhausted(t)
}

func TestExerciseNoteEmptyNoteDeletes(t *testing.T) {
	db, stub := newStubDB(t,
		stubExpectation{
			op: "exec",
			sqlContains: "DELETE FROM workout_exercise_notes wen USING workout_sessions ws " +
				"WHERE wen.workout_session_id = $1 AND wen.exercise_id = $2 AND wen.workout_session_id = ws.id AND ws.user_id = $3",
			args:   []driver.Value{int64(9), int64(31), int64(7)},
			result: driver.RowsAffected(1),
		},
	)

	model := ExerciseNoteModel{DB: db}
	note := &ExerciseNote{WorkoutSessionID: 9, ExerciseID: 31, Note: ""}

	if err := model.UpsertForUser(note, 7); err != nil {
		t.Fatalf("UpsertForUser (clear): %v", err)
	}

	stub.assertExhausted(t)
}

func TestGetForSessionReturnsNotesInExerciseOrder(t *testing.T) {
	now := time.Now()

	db, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "FROM workout_exercise_notes WHERE workout_session_id = $1 ORDER BY exercise_id",
			args:        []driver.Value{int64(9)},
			rows: &stubRows{
				columns: []string{"workout_session_id", "exercise_id", "note", "created_at", "version"},
				values: [][]driver.Value{
					{int64(9), int64(3), "seat at 4", now, int64(1)},
					{int64(9), int64(31), "Panatta taken", now, int64(2)},
				},
			},
		},
	)

	model := ExerciseNoteModel{DB: db}

	notes, err := model.GetForSession(9)
	if err != nil {
		t.Fatalf("GetForSession: %v", err)
	}
	if len(notes) != 2 || notes[0].ExerciseID != 3 || notes[1].Note != "Panatta taken" {
		t.Errorf("unexpected notes %+v", notes)
	}

	stub.assertExhausted(t)
}

func TestGetRecentForExerciseOrdersNewestFirst(t *testing.T) {
	newer := time.Date(2026, 7, 1, 18, 0, 0, 0, time.UTC)
	older := time.Date(2026, 6, 3, 18, 0, 0, 0, time.UTC)

	db, stub := newStubDB(t,
		stubExpectation{
			op: "query",
			sqlContains: "JOIN workout_sessions ws ON wen.workout_session_id = ws.id " +
				"WHERE ws.user_id = $1 AND wen.exercise_id = $2 ORDER BY ws.performed_at DESC, ws.id DESC LIMIT $3",
			args: []driver.Value{int64(7), int64(31), int64(2)},
			rows: &stubRows{
				columns: []string{"note", "performed_at", "id"},
				values: [][]driver.Value{
					{"Panatta taken, used Lifefitness at 45 kg", newer, int64(20)},
					{"seat at 4", older, int64(12)},
				},
			},
		},
	)

	model := ExerciseNoteModel{DB: db}

	notes, err := model.GetRecentForExercise(7, 31, 2)
	if err != nil {
		t.Fatalf("GetRecentForExercise: %v", err)
	}
	if len(notes) != 2 || notes[0].SessionID != 20 || !notes[0].PerformedAt.Equal(newer) {
		t.Errorf("unexpected notes %+v", notes)
	}

	stub.assertExhausted(t)
}

func TestExerciseNotesGetForMesocycleScopesToOwner(t *testing.T) {
	now := time.Now()

	db, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "JOIN workout_sessions ws ON wen.workout_session_id = ws.id WHERE ws.user_id = $1 AND ws.mesocycle_id = $2",
			args:        []driver.Value{int64(7), int64(3)},
			rows: &stubRows{
				columns: []string{"workout_session_id", "exercise_id", "note", "created_at", "version"},
				values: [][]driver.Value{
					{int64(9), int64(31), "Panatta taken", now, int64(1)},
				},
			},
		},
	)

	model := ExerciseNoteModel{DB: db}

	notes, err := model.GetForMesocycle(7, 3)
	if err != nil {
		t.Fatalf("GetForMesocycle: %v", err)
	}
	if len(notes) != 1 || notes[0].WorkoutSessionID != 9 {
		t.Errorf("unexpected notes %+v", notes)
	}

	stub.assertExhausted(t)
}
