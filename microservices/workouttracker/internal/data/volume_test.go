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

func TestPreviewVolumeExposesPrimarySecondarySplit(t *testing.T) {
	sqlDB, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "FROM exercise_muscles em",
			rows: &stubRows{
				columns: []string{"exercise_id", "id", "name", "body_part", "target_type"},
				values: [][]driver.Value{
					// Bench: chest primary, front delts + triceps secondary.
					{int64(11), int64(1), "Pecs", "chest", "primary"},
					{int64(11), int64(2), "Front Delts", "shoulders", "secondary"},
					{int64(11), int64(4), "Triceps", "triceps", "secondary"},
					// Lateral raise: side delts primary — shoulders get BOTH kinds.
					{int64(10), int64(5), "Side Delts", "shoulders", "primary"},
				},
			},
		},
	)

	model := VolumeModel{DB: sqlDB}

	volume, err := model.PreviewVolume([]ExerciseSetsInput{
		{ExerciseID: 11, Sets: 4},
		{ExerciseID: 10, Sets: 2},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	byBP := make(map[string]BodyPartVolume, len(volume))
	for _, bp := range volume {
		byBP[bp.BodyPart] = bp
	}

	shoulders := byBP["shoulders"]
	if shoulders.PrimarySets != 2 || shoulders.SecondarySets != 4 {
		t.Fatalf("shoulders split = %v primary / %v secondary, want 2 / 4", shoulders.PrimarySets, shoulders.SecondarySets)
	}
	if shoulders.TotalSets != 4 { // 2 + 4*0.5
		t.Fatalf("shoulders merged = %v, want 4", shoulders.TotalSets)
	}

	// Muscle-level split inside shoulders: side delts all-primary, front delts all-secondary.
	muscles := make(map[string]MuscleVolume)
	for _, m := range shoulders.SubMuscles {
		muscles[m.MuscleName] = m
	}
	if m := muscles["Side Delts"]; m.PrimarySets != 2 || m.SecondarySets != 0 || m.Sets != 2 {
		t.Fatalf("side delts = %+v, want 2 primary / 0 secondary / 2 merged", m)
	}
	if m := muscles["Front Delts"]; m.PrimarySets != 0 || m.SecondarySets != 4 || m.Sets != 2 {
		t.Fatalf("front delts = %+v, want 0 primary / 4 secondary / 2 merged", m)
	}

	if tri := byBP["triceps"]; tri.PrimarySets != 0 || tri.SecondarySets != 4 || tri.TotalSets != 2 {
		t.Fatalf("triceps = %v/%v/%v, want 0/4/2", tri.PrimarySets, tri.SecondarySets, tri.TotalSets)
	}
	if chest := byBP["chest"]; chest.PrimarySets != 4 || chest.TotalSets != 4 {
		t.Fatalf("chest = %v primary / %v merged, want 4 / 4", chest.PrimarySets, chest.TotalSets)
	}

	stub.assertExhausted(t)
}
