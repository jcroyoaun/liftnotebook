package data

import "testing"

func intPtr(n int) *int { return &n }

func TestSuggestNextSet(t *testing.T) {
	// The house targets: 2 sets of 8-12 taken to failure.
	target := TrainingExercise{
		ID:                 7,
		ExerciseID:         3,
		ExerciseName:       "Flat Barbell Bench Press",
		TargetSets:         2,
		TargetRepRangeLow:  8,
		TargetRepRangeHigh: 12,
		TargetRIR:          0,
	}

	tests := []struct {
		name           string
		last           *LastPerformance
		target         TrainingExercise
		wantWeight     float64
		wantReps       int
		wantReasonPart string
	}{
		{
			name:           "no history suggests bottom of range",
			last:           nil,
			target:         target,
			wantWeight:     0,
			wantReps:       8,
			wantReasonPart: "first exposure",
		},
		{
			name:           "topped rep range at failure adds weight and resets reps",
			last:           &LastPerformance{Weight: 100, Reps: 12, RIR: intPtr(0)},
			target:         target,
			wantWeight:     102.5,
			wantReps:       8,
			wantReasonPart: "add weight",
		},
		{
			name:           "above rep range also adds weight",
			last:           &LastPerformance{Weight: 100, Reps: 14, RIR: intPtr(0)},
			target:         target,
			wantWeight:     102.5,
			wantReps:       8,
			wantReasonPart: "add weight",
		},
		{
			name:           "topped range but sandbagged (RIR above target) keeps weight",
			last:           &LastPerformance{Weight: 100, Reps: 12, RIR: intPtr(3)},
			target:         target,
			wantWeight:     100,
			wantReps:       12,
			wantReasonPart: "beat the last rep count",
		},
		{
			name:           "mid range keeps weight and adds a rep",
			last:           &LastPerformance{Weight: 100, Reps: 10, RIR: intPtr(0)},
			target:         target,
			wantWeight:     100,
			wantReps:       11,
			wantReasonPart: "beat the last rep count",
		},
		{
			name:           "one below top of range caps suggestion at range top",
			last:           &LastPerformance{Weight: 100, Reps: 11, RIR: intPtr(0)},
			target:         target,
			wantWeight:     100,
			wantReps:       12,
			wantReasonPart: "beat the last rep count",
		},
		{
			name:           "below rep range holds weight, aims for range bottom",
			last:           &LastPerformance{Weight: 100, Reps: 5, RIR: intPtr(0)},
			target:         target,
			wantWeight:     100,
			wantReps:       8,
			wantReasonPart: "below the rep range",
		},
		{
			name:           "nil RIR counts as intensity met",
			last:           &LastPerformance{Weight: 60, Reps: 12, RIR: nil},
			target:         target,
			wantWeight:     62.5,
			wantReps:       8,
			wantReasonPart: "add weight",
		},
		{
			name: "RIR-based style progresses at its own target intensity",
			last: &LastPerformance{Weight: 80, Reps: 12, RIR: intPtr(2)},
			target: TrainingExercise{
				TargetSets: 3, TargetRepRangeLow: 8, TargetRepRangeHigh: 12, TargetRIR: 2,
			},
			wantWeight:     82.5,
			wantReps:       8,
			wantReasonPart: "add weight",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SuggestNextSet(tt.last, tt.target)

			if got.SuggestedWeight != tt.wantWeight {
				t.Errorf("SuggestedWeight = %v; want %v", got.SuggestedWeight, tt.wantWeight)
			}
			if got.SuggestedReps != tt.wantReps {
				t.Errorf("SuggestedReps = %v; want %v", got.SuggestedReps, tt.wantReps)
			}
			if !contains(got.Reason, tt.wantReasonPart) {
				t.Errorf("Reason = %q; want it to contain %q", got.Reason, tt.wantReasonPart)
			}
		})
	}
}

func TestApplyTargetDefaults(t *testing.T) {
	te := TrainingExercise{ExerciseID: 1}
	te.ApplyTargetDefaults()

	if te.TargetSets != 2 || te.TargetRepRangeLow != 8 || te.TargetRepRangeHigh != 12 || te.TargetRIR != 0 {
		t.Errorf("defaults = %d sets, %d-%d reps @ RIR %d; want 2 sets, 8-12 reps @ RIR 0",
			te.TargetSets, te.TargetRepRangeLow, te.TargetRepRangeHigh, te.TargetRIR)
	}

	// Explicit values are preserved.
	te = TrainingExercise{ExerciseID: 1, TargetSets: 4, TargetRepRangeLow: 5, TargetRepRangeHigh: 8, TargetRIR: 2}
	te.ApplyTargetDefaults()
	if te.TargetSets != 4 || te.TargetRepRangeLow != 5 || te.TargetRepRangeHigh != 8 || te.TargetRIR != 2 {
		t.Error("ApplyTargetDefaults must not override explicit targets")
	}
}

func contains(s, substr string) bool {
	for i := 0; i+len(substr) <= len(s); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
