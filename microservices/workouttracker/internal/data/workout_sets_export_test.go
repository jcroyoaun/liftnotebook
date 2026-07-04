package data

import (
	"database/sql/driver"
	"testing"
	"time"
)

func TestGetForMesocycleScopesToOwnerAndJoinsNames(t *testing.T) {
	now := time.Now()

	db, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "JOIN workout_sessions sess ON ws.workout_session_id = sess.id WHERE sess.user_id = $1 AND sess.mesocycle_id = $2",
			args:        []driver.Value{int64(7), int64(3)},
			rows: &stubRows{
				columns: []string{"id", "workout_session_id", "exercise_id", "name", "set_number", "weight", "reps", "rir", "recorded", "client_id", "created_at", "version"},
				values: [][]driver.Value{
					{int64(1), int64(10), int64(11), "Flat Barbell Bench Press", int64(1), 100.0, int64(8), int64(0), true, nil, now, int64(1)},
					{int64(2), int64(10), int64(11), "Flat Barbell Bench Press", int64(2), 100.0, int64(7), int64(0), true, nil, now, int64(1)},
				},
			},
		},
	)

	model := WorkoutSetModel{DB: db}

	sets, err := model.GetForMesocycle(7, 3)
	if err != nil {
		t.Fatalf("GetForMesocycle: %v", err)
	}
	if len(sets) != 2 || sets[0].ExerciseName != "Flat Barbell Bench Press" || sets[1].SetNumber != 2 {
		t.Errorf("unexpected sets %+v", sets)
	}

	stub.assertExhausted(t)
}
