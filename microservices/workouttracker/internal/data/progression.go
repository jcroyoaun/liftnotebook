package data

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

// WeightIncrementKg is the smallest jump suggested when an exercise's rep
// target is beaten — one small plate on each side of a barbell.
const WeightIncrementKg = 2.5

// LastPerformance is the best recorded set from the most recent session in
// which the user performed an exercise.
type LastPerformance struct {
	Weight      float64   `json:"weight"`
	Reps        int       `json:"reps"`
	RIR         *int      `json:"rir"`
	PerformedAt time.Time `json:"performed_at"`
}

// Suggestion is a computed next-session target for one exercise. It is never
// stored — always derived at read time from the latest recorded sets.
type Suggestion struct {
	TrainingDayExerciseID int64            `json:"training_day_exercise_id"`
	ExerciseID            int64            `json:"exercise_id"`
	ExerciseName          string           `json:"exercise_name"`
	TargetSets            int              `json:"target_sets"`
	TargetRepRangeLow     int              `json:"target_rep_range_low"`
	TargetRepRangeHigh    int              `json:"target_rep_range_high"`
	TargetRIR             int              `json:"target_rir"`
	SuggestedWeight       float64          `json:"suggested_weight"`
	SuggestedReps         int              `json:"suggested_reps"`
	Reason                string           `json:"reason"`
	LastPerformance       *LastPerformance `json:"last_performance,omitempty"`
}

// SuggestNextSet implements double progression tuned for to-failure
// training: once the top of the rep range is reached at (or under) the
// target RIR, add weight and drop back to the bottom of the range;
// otherwise keep the weight and beat the last rep count.
func SuggestNextSet(last *LastPerformance, target TrainingExercise) Suggestion {
	s := Suggestion{
		TrainingDayExerciseID: target.ID,
		ExerciseID:            target.ExerciseID,
		ExerciseName:          target.ExerciseName,
		TargetSets:            target.TargetSets,
		TargetRepRangeLow:     target.TargetRepRangeLow,
		TargetRepRangeHigh:    target.TargetRepRangeHigh,
		TargetRIR:             target.TargetRIR,
		LastPerformance:       last,
	}

	if last == nil {
		s.SuggestedWeight = 0
		s.SuggestedReps = target.TargetRepRangeLow
		s.Reason = "first exposure: pick a weight you can take to failure inside the rep range"
		return s
	}

	intensityMet := last.RIR == nil || *last.RIR <= target.TargetRIR

	switch {
	case last.Reps >= target.TargetRepRangeHigh && intensityMet:
		s.SuggestedWeight = last.Weight + WeightIncrementKg
		s.SuggestedReps = target.TargetRepRangeLow
		s.Reason = "topped the rep range at target intensity: add weight"
	case last.Reps < target.TargetRepRangeLow:
		s.SuggestedWeight = last.Weight
		s.SuggestedReps = target.TargetRepRangeLow
		s.Reason = "below the rep range: stay at this weight until the bottom of the range is reached"
	default:
		s.SuggestedWeight = last.Weight
		s.SuggestedReps = min(last.Reps+1, target.TargetRepRangeHigh)
		s.Reason = "same weight: beat the last rep count"
	}

	return s
}

type ProgressionModel struct {
	DB *sql.DB
}

// GetSuggestionsForTrainingDay computes next-session targets for every
// exercise on a training day the user owns. History is looked up across all
// of the user's mesocycles so a new block starts from real numbers.
func (m ProgressionModel) GetSuggestionsForTrainingDay(userID, trainingDayID int64) ([]Suggestion, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var ownedTrainingDayID int64
	err := m.DB.QueryRowContext(ctx, `
		SELECT td.id
		FROM training_days td
		JOIN mesocycles m ON td.mesocycle_id = m.id
		WHERE td.id = $1 AND m.user_id = $2
	`, trainingDayID, userID).Scan(&ownedTrainingDayID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrRecordNotFound
		}
		return nil, err
	}

	exercises, err := m.getExercisesWithTargets(ctx, trainingDayID)
	if err != nil {
		return nil, err
	}

	suggestions := make([]Suggestion, 0, len(exercises))
	for _, te := range exercises {
		last, err := m.getLastPerformance(ctx, userID, te.ExerciseID)
		if err != nil {
			return nil, err
		}
		suggestions = append(suggestions, SuggestNextSet(last, te))
	}

	return suggestions, nil
}

func (m ProgressionModel) getExercisesWithTargets(ctx context.Context, trainingDayID int64) ([]TrainingExercise, error) {
	query := `
		SELECT tde.id, tde.exercise_id, e.name, tde.target_sets,
		       tde.target_rep_range_low, tde.target_rep_range_high, tde.target_rir
		FROM training_day_exercises tde
		JOIN exercises e ON tde.exercise_id = e.id
		WHERE tde.training_day_id = $1
		ORDER BY tde.position`

	rows, err := m.DB.QueryContext(ctx, query, trainingDayID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var exercises []TrainingExercise
	for rows.Next() {
		var te TrainingExercise
		err := rows.Scan(&te.ID, &te.ExerciseID, &te.ExerciseName, &te.TargetSets,
			&te.TargetRepRangeLow, &te.TargetRepRangeHigh, &te.TargetRIR)
		if err != nil {
			return nil, err
		}
		exercises = append(exercises, te)
	}
	return exercises, rows.Err()
}

// getLastPerformance returns the best recorded set (heaviest, then most
// reps) from the user's most recent session containing the exercise, or nil
// when there is no history.
func (m ProgressionModel) getLastPerformance(ctx context.Context, userID, exerciseID int64) (*LastPerformance, error) {
	query := `
		SELECT wset.weight, wset.reps, wset.rir, wsess.performed_at
		FROM workout_sets wset
		JOIN workout_sessions wsess ON wset.workout_session_id = wsess.id
		WHERE wsess.user_id = $1 AND wset.exercise_id = $2 AND wset.recorded = true
		ORDER BY wsess.performed_at DESC, wset.weight DESC, wset.reps DESC
		LIMIT 1`

	var lp LastPerformance
	err := m.DB.QueryRowContext(ctx, query, userID, exerciseID).Scan(&lp.Weight, &lp.Reps, &lp.RIR, &lp.PerformedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &lp, nil
}
