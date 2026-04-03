package data

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type Exercise struct {
	ID                int64            `json:"id"`
	Name              string           `json:"name"`
	Type              string           `json:"type"`
	MovementPatternID int64            `json:"movement_pattern_id"`
	MovementPattern   string           `json:"movement_pattern,omitempty"`
	Targets           []ExerciseTarget `json:"targets,omitempty"`
}

type ExerciseTarget struct {
	MuscleID   int64  `json:"muscle_id"`
	MuscleName string `json:"muscle_name"`
	BodyPart   string `json:"body_part"`
	TargetType string `json:"target_type"`
}

type ExerciseReader struct {
	DB *sql.DB
}

func (r ExerciseReader) GetAll() ([]Exercise, error) {
	query := `
		SELECT e.id, e.name, e.type::text, e.movement_pattern_id, COALESCE(mp.name, '')
		FROM exercises e
		LEFT JOIN movement_patterns mp ON e.movement_pattern_id = mp.id
		ORDER BY e.name`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := r.DB.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var exercises []Exercise
	for rows.Next() {
		var e Exercise
		err := rows.Scan(&e.ID, &e.Name, &e.Type, &e.MovementPatternID, &e.MovementPattern)
		if err != nil {
			return nil, err
		}
		exercises = append(exercises, e)
	}
	return exercises, rows.Err()
}

func (r ExerciseReader) Get(id int64) (*Exercise, error) {
	query := `
		SELECT e.id, e.name, e.type::text, e.movement_pattern_id, COALESCE(mp.name, '')
		FROM exercises e
		LEFT JOIN movement_patterns mp ON e.movement_pattern_id = mp.id
		WHERE e.id = $1`

	var exercise Exercise

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := r.DB.QueryRowContext(ctx, query, id).Scan(
		&exercise.ID, &exercise.Name, &exercise.Type, &exercise.MovementPatternID, &exercise.MovementPattern,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrRecordNotFound
		}
		return nil, err
	}

	targetsQuery := `
		SELECT mu.id, mu.name, mu.body_part::text, em.target_type::text
		FROM exercise_muscles em
		JOIN muscles mu ON em.muscle_id = mu.id
		WHERE em.exercise_id = $1
		ORDER BY CASE WHEN em.target_type = 'primary' THEN 0 ELSE 1 END, mu.body_part, mu.name`

	rows, err := r.DB.QueryContext(ctx, targetsQuery, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var target ExerciseTarget
		err := rows.Scan(&target.MuscleID, &target.MuscleName, &target.BodyPart, &target.TargetType)
		if err != nil {
			return nil, err
		}
		exercise.Targets = append(exercise.Targets, target)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}

	return &exercise, nil
}

// GetUserExercises returns distinct exercises the user has logged at least one recorded set for.
func (r ExerciseReader) GetUserExercises(userID int64) ([]Exercise, error) {
	query := `
		SELECT DISTINCT e.id, e.name, e.type::text, e.movement_pattern_id, COALESCE(mp.name, '')
		FROM exercises e
		LEFT JOIN movement_patterns mp ON e.movement_pattern_id = mp.id
		JOIN workout_sets ws ON ws.exercise_id = e.id
		JOIN workout_sessions s ON ws.workout_session_id = s.id
		WHERE s.user_id = $1 AND ws.recorded = true
		ORDER BY e.name`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := r.DB.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var exercises []Exercise
	for rows.Next() {
		var e Exercise
		err := rows.Scan(&e.ID, &e.Name, &e.Type, &e.MovementPatternID, &e.MovementPattern)
		if err != nil {
			return nil, err
		}
		exercises = append(exercises, e)
	}
	return exercises, rows.Err()
}
