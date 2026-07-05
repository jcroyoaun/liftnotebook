package data

import (
	"database/sql/driver"
	"testing"
	"time"

	"workouttracker.jcroyoaun.io/internal/validator"
)

func floatPtr(f float64) *float64 { return &f }

func TestValidateWorkoutSetPerLimbPairRule(t *testing.T) {
	base := WorkoutSet{ExerciseID: 3, SetNumber: 1, Weight: 40, Reps: 10}

	tests := []struct {
		name        string
		left, right *float64
		wantValid   bool
	}{
		{"bilateral set (both nil) is valid", nil, nil, true},
		{"both limbs set is valid", floatPtr(40), floatPtr(42.5), true},
		{"left without right is invalid", floatPtr(40), nil, false},
		{"right without left is invalid", nil, floatPtr(40), false},
		{"negative left is invalid", floatPtr(-1), floatPtr(40), false},
		{"negative right is invalid", floatPtr(40), floatPtr(-1), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := base
			s.WeightLeft = tt.left
			s.WeightRight = tt.right

			v := validator.New()
			ValidateWorkoutSet(v, &s)

			if v.Valid() != tt.wantValid {
				t.Errorf("Valid() = %v, want %v (errors: %v)", v.Valid(), tt.wantValid, v.Errors)
			}
		})
	}
}

func TestInsertForUserUpsertsPerLimbWeights(t *testing.T) {
	now := time.Now()
	clientID := "5f0c39a2-9c9f-4d33-8f27-01a2b3c4d5e6"

	db, stub := newStubDB(t,
		stubExpectation{
			op: "query",
			sqlContains: "INSERT INTO workout_sets (workout_session_id, exercise_id, set_number, weight, weight_left, weight_right, reps, rir, recorded, client_id) " +
				"SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10",
			args: []driver.Value{int64(10), int64(11), int64(1), 40.0, 40.0, 42.5, int64(10), nil, true, clientID, int64(7)},
			rows: &stubRows{
				columns: []string{"id", "created_at", "version"},
				values:  [][]driver.Value{{int64(5), now, int64(1)}},
			},
		},
	)

	model := WorkoutSetModel{DB: db}
	set := &WorkoutSet{
		WorkoutSessionID: 10,
		ExerciseID:       11,
		SetNumber:        1,
		Weight:           40,
		WeightLeft:       floatPtr(40),
		WeightRight:      floatPtr(42.5),
		Reps:             10,
		Recorded:         true,
		ClientID:         &clientID,
	}

	if err := model.InsertForUser(set, 7); err != nil {
		t.Fatalf("InsertForUser: %v", err)
	}
	if set.ID != 5 {
		t.Errorf("id = %d, want 5", set.ID)
	}

	stub.assertExhausted(t)
}

func TestInsertForUserConflictUpdatesPerLimbWeights(t *testing.T) {
	now := time.Now()

	db, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "DO UPDATE SET weight = EXCLUDED.weight, weight_left = EXCLUDED.weight_left, weight_right = EXCLUDED.weight_right, reps = EXCLUDED.reps",
			rows: &stubRows{
				columns: []string{"id", "created_at", "version"},
				values:  [][]driver.Value{{int64(5), now, int64(2)}},
			},
		},
	)

	model := WorkoutSetModel{DB: db}
	set := &WorkoutSet{WorkoutSessionID: 10, ExerciseID: 11, SetNumber: 1, Weight: 40, Reps: 10}

	if err := model.InsertForUser(set, 7); err != nil {
		t.Fatalf("InsertForUser: %v", err)
	}
	if set.Version != 2 {
		t.Errorf("version = %d, want 2", set.Version)
	}

	stub.assertExhausted(t)
}

func TestUpdateForUserPersistsPerLimbWeights(t *testing.T) {
	db, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "SET weight = $1, weight_left = $2, weight_right = $3, reps = $4, rir = $5, recorded = $6, version = wset.version + 1",
			args:        []driver.Value{37.5, 37.5, 40.0, int64(9), int64(1), true, int64(5), int64(7)},
			rows: &stubRows{
				columns: []string{"version"},
				values:  [][]driver.Value{{int64(3)}},
			},
		},
	)

	model := WorkoutSetModel{DB: db}
	set := &WorkoutSet{
		ID:          5,
		Weight:      37.5,
		WeightLeft:  floatPtr(37.5),
		WeightRight: floatPtr(40),
		Reps:        9,
		RIR:         intPtr(1),
		Recorded:    true,
	}

	if err := model.UpdateForUser(set, 7); err != nil {
		t.Fatalf("UpdateForUser: %v", err)
	}
	if set.Version != 3 {
		t.Errorf("version = %d, want 3", set.Version)
	}

	stub.assertExhausted(t)
}
