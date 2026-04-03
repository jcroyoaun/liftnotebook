package data

import (
	"database/sql/driver"
	"errors"
	"testing"
	"time"
)

func TestTrainingDayModelUpdateExercisesForUserReturnsNotFoundForUnauthorizedDay(t *testing.T) {
	sqlDB, stub := newStubDB(t,
		stubExpectation{op: "begin"},
		stubExpectation{
			op:          "query",
			sqlContains: "FROM training_days td JOIN mesocycles m ON td.mesocycle_id = m.id",
			args:        []driver.Value{int64(77), int64(9)},
			rows: &stubRows{
				columns: []string{"id"},
			},
		},
	)

	model := TrainingDayModel{DB: sqlDB}

	err := model.UpdateExercisesForUser(77, 9, []TrainingExercise{{ExerciseID: 11, Position: 1, TargetSets: 4}})
	if !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("expected ErrRecordNotFound, got %v", err)
	}

	stub.assertExhausted(t)
}

func TestTrainingDayModelUpdateExercisesForUserReplacesExercises(t *testing.T) {
	sqlDB, stub := newStubDB(t,
		stubExpectation{op: "begin"},
		stubExpectation{
			op:          "query",
			sqlContains: "FROM training_days td JOIN mesocycles m ON td.mesocycle_id = m.id",
			args:        []driver.Value{int64(77), int64(9)},
			rows: &stubRows{
				columns: []string{"id"},
				values:  [][]driver.Value{{int64(77)}},
			},
		},
		stubExpectation{
			op:          "exec",
			sqlContains: "DELETE FROM training_day_exercises WHERE training_day_id = $1",
			args:        []driver.Value{int64(77)},
			result:      driverRowsAffected(2),
		},
		stubExpectation{
			op:          "exec",
			sqlContains: "INSERT INTO training_day_exercises",
			args:        []driver.Value{int64(77), int64(11), int64(1), int64(4)},
			result:      driverRowsAffected(1),
		},
		stubExpectation{
			op:          "exec",
			sqlContains: "INSERT INTO training_day_exercises",
			args:        []driver.Value{int64(77), int64(12), int64(2), int64(3)},
			result:      driverRowsAffected(1),
		},
		stubExpectation{op: "commit"},
	)

	model := TrainingDayModel{DB: sqlDB}

	err := model.UpdateExercisesForUser(77, 9, []TrainingExercise{
		{ExerciseID: 11, Position: 1, TargetSets: 4},
		{ExerciseID: 12, Position: 2, TargetSets: 3},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	stub.assertExhausted(t)
}

func TestWorkoutSetModelInsertForUserReturnsNotFoundForUnknownSession(t *testing.T) {
	sqlDB, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "FROM workout_sessions ws WHERE ws.id = $1 AND ws.user_id = $8",
			args:        []driver.Value{int64(5), int64(11), int64(1), 100.0, int64(8), nil, false, int64(9)},
			rows: &stubRows{
				columns: []string{"id", "created_at", "version"},
			},
		},
	)

	model := WorkoutSetModel{DB: sqlDB}
	set := &WorkoutSet{
		WorkoutSessionID: 5,
		ExerciseID:       11,
		SetNumber:        1,
		Weight:           100,
		Reps:             8,
	}

	err := model.InsertForUser(set, 9)
	if !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("expected ErrRecordNotFound, got %v", err)
	}

	stub.assertExhausted(t)
}

func TestWorkoutSetModelUpdateForUserReturnsNotFoundForUnauthorizedSet(t *testing.T) {
	sqlDB, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "FROM workout_sessions ws WHERE wset.id = $5 AND wset.workout_session_id = ws.id AND ws.user_id = $6",
			args:        []driver.Value{120.0, int64(6), nil, true, int64(44), int64(9)},
			rows: &stubRows{
				columns: []string{"version"},
			},
		},
	)

	model := WorkoutSetModel{DB: sqlDB}

	err := model.UpdateForUser(&WorkoutSet{
		ID:       44,
		Weight:   120,
		Reps:     6,
		Recorded: true,
	}, 9)
	if !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("expected ErrRecordNotFound, got %v", err)
	}

	stub.assertExhausted(t)
}

func TestWorkoutSetModelDeleteForUserReturnsNotFoundForUnauthorizedSet(t *testing.T) {
	sqlDB, stub := newStubDB(t,
		stubExpectation{
			op:          "exec",
			sqlContains: "USING workout_sessions ws",
			args:        []driver.Value{int64(44), int64(9)},
			result:      driverRowsAffected(0),
		},
	)

	model := WorkoutSetModel{DB: sqlDB}

	err := model.DeleteForUser(44, 9)
	if !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("expected ErrRecordNotFound, got %v", err)
	}

	stub.assertExhausted(t)
}

func TestWorkoutSetModelInsertForUserInsertsOwnedSession(t *testing.T) {
	createdAt := time.Date(2026, time.April, 2, 10, 0, 0, 0, time.UTC)

	sqlDB, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "FROM workout_sessions ws WHERE ws.id = $1 AND ws.user_id = $8",
			args:        []driver.Value{int64(5), int64(11), int64(1), 100.0, int64(8), nil, false, int64(9)},
			rows: &stubRows{
				columns: []string{"id", "created_at", "version"},
				values:  [][]driver.Value{{int64(88), createdAt, int64(1)}},
			},
		},
	)

	model := WorkoutSetModel{DB: sqlDB}
	set := &WorkoutSet{
		WorkoutSessionID: 5,
		ExerciseID:       11,
		SetNumber:        1,
		Weight:           100,
		Reps:             8,
	}

	err := model.InsertForUser(set, 9)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if set.ID != 88 {
		t.Fatalf("expected inserted set ID 88, got %d", set.ID)
	}

	stub.assertExhausted(t)
}

type driverRowsAffected int64

func (r driverRowsAffected) LastInsertId() (int64, error) {
	return 0, errors.New("not implemented")
}

func (r driverRowsAffected) RowsAffected() (int64, error) {
	return int64(r), nil
}
