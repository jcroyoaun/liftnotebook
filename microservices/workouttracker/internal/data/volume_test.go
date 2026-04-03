package data

import (
	"database/sql/driver"
	"testing"
)

func TestPreviewVolumeAccumulatesRepeatedExercises(t *testing.T) {
	sqlDB, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "FROM exercise_muscles em",
			rows: &stubRows{
				columns: []string{"exercise_id", "id", "name", "body_part", "target_type"},
				values: [][]driver.Value{
					{int64(11), int64(1), "Pecs", "chest", "primary"},
					{int64(11), int64(2), "Front Delts", "shoulders", "secondary"},
					{int64(12), int64(3), "Lats", "back", "primary"},
				},
			},
		},
	)

	model := VolumeModel{DB: sqlDB}

	volume, err := model.PreviewVolume([]ExerciseSetsInput{
		{ExerciseID: 11, Sets: 3},
		{ExerciseID: 11, Sets: 2},
		{ExerciseID: 12, Sets: 4},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	totals := make(map[string]float64, len(volume))
	for _, bp := range volume {
		totals[bp.BodyPart] = bp.TotalSets
	}

	if totals["chest"] != 5 {
		t.Fatalf("expected chest total 5, got %v", totals["chest"])
	}
	if totals["shoulders"] != 2.5 {
		t.Fatalf("expected shoulders total 2.5, got %v", totals["shoulders"])
	}
	if totals["back"] != 4 {
		t.Fatalf("expected back total 4, got %v", totals["back"])
	}

	stub.assertExhausted(t)
}
