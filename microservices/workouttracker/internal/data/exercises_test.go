package data

import (
	"database/sql/driver"
	"errors"
	"testing"
)

func TestExerciseReaderGetReturnsExerciseWithTargets(t *testing.T) {
	sqlDB, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "FROM exercises e LEFT JOIN movement_patterns mp ON e.movement_pattern_id = mp.id WHERE e.id = $1",
			args:        []driver.Value{int64(31)},
			rows: &stubRows{
				columns: []string{"id", "name", "type", "movement_pattern_id", "name"},
				values: [][]driver.Value{
					{int64(31), "Machine Incline Chest Press", "compound", int64(9), "horizontal press"},
				},
			},
		},
		stubExpectation{
			op:          "query",
			sqlContains: "FROM exercise_muscles em JOIN muscles mu ON em.muscle_id = mu.id WHERE em.exercise_id = $1",
			args:        []driver.Value{int64(31)},
			rows: &stubRows{
				columns: []string{"id", "name", "body_part", "target_type"},
				values: [][]driver.Value{
					{int64(1), "Pectoralis Major", "chest", "primary"},
					{int64(8), "Anterior Deltoid", "shoulders", "primary"},
					{int64(12), "Triceps Brachii", "triceps", "secondary"},
				},
			},
		},
	)

	reader := ExerciseReader{DB: sqlDB}

	exercise, err := reader.Get(31)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if exercise.Name != "Machine Incline Chest Press" {
		t.Fatalf("unexpected exercise name %q", exercise.Name)
	}
	if len(exercise.Targets) != 3 {
		t.Fatalf("expected 3 targets, got %d", len(exercise.Targets))
	}
	if exercise.Targets[0].TargetType != "primary" || exercise.Targets[0].MuscleName != "Pectoralis Major" {
		t.Fatalf("unexpected first target %#v", exercise.Targets[0])
	}

	stub.assertExhausted(t)
}

func TestExerciseReaderGetReturnsNotFound(t *testing.T) {
	sqlDB, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "FROM exercises e LEFT JOIN movement_patterns mp ON e.movement_pattern_id = mp.id WHERE e.id = $1",
			args:        []driver.Value{int64(999)},
			rows: &stubRows{
				columns: []string{"id", "name", "type", "movement_pattern_id", "name"},
			},
		},
	)

	reader := ExerciseReader{DB: sqlDB}

	_, err := reader.Get(999)
	if !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("expected ErrRecordNotFound, got %v", err)
	}

	stub.assertExhausted(t)
}
