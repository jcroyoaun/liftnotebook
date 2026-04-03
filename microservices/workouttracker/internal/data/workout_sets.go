package data

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"workouttracker.jcroyoaun.io/internal/validator"
)

type WorkoutSet struct {
	ID               int64     `json:"id"`
	WorkoutSessionID int64     `json:"workout_session_id"`
	ExerciseID       int64     `json:"exercise_id"`
	ExerciseName     string    `json:"exercise_name,omitempty"`
	SetNumber        int       `json:"set_number"`
	Weight           float64   `json:"weight"`
	Reps             int       `json:"reps"`
	RIR              *int      `json:"rir"`
	Recorded         bool      `json:"recorded"`
	CreatedAt        time.Time `json:"-"`
	Version          int32     `json:"version,omitzero"`
}

type WorkoutSetModel struct {
	DB *sql.DB
}

func ValidateWorkoutSet(v *validator.Validator, s *WorkoutSet) {
	v.Check(s.ExerciseID > 0, "exercise_id", "must be a positive integer")
	v.Check(s.SetNumber >= 1, "set_number", "must be at least 1")
	v.Check(s.Weight >= 0, "weight", "must be zero or positive")
	v.Check(s.Reps >= 1, "reps", "must be at least 1")
	if s.RIR != nil {
		v.Check(*s.RIR >= 0 && *s.RIR <= 10, "rir", "must be between 0 and 10")
	}
}

func (m WorkoutSetModel) Insert(set *WorkoutSet) error {
	query := `
		INSERT INTO workout_sets (workout_session_id, exercise_id, set_number, weight, reps, rir, recorded)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, version`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	return m.DB.QueryRowContext(ctx, query,
		set.WorkoutSessionID, set.ExerciseID, set.SetNumber, set.Weight, set.Reps, set.RIR, set.Recorded,
	).Scan(&set.ID, &set.CreatedAt, &set.Version)
}

func (m WorkoutSetModel) InsertForUser(set *WorkoutSet, userID int64) error {
	query := `
		INSERT INTO workout_sets (workout_session_id, exercise_id, set_number, weight, reps, rir, recorded)
		SELECT $1, $2, $3, $4, $5, $6, $7
		FROM workout_sessions ws
		WHERE ws.id = $1 AND ws.user_id = $8
		RETURNING id, created_at, version`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := m.DB.QueryRowContext(ctx, query,
		set.WorkoutSessionID, set.ExerciseID, set.SetNumber, set.Weight, set.Reps, set.RIR, set.Recorded, userID,
	).Scan(&set.ID, &set.CreatedAt, &set.Version)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrRecordNotFound
		}
		return err
	}

	return nil
}

func (m WorkoutSetModel) GetForSession(sessionID int64) ([]WorkoutSet, error) {
	query := `
		SELECT ws.id, ws.workout_session_id, ws.exercise_id, e.name,
		       ws.set_number, ws.weight, ws.reps, ws.rir, ws.recorded, ws.created_at, ws.version
		FROM workout_sets ws
		JOIN exercises e ON ws.exercise_id = e.id
		WHERE ws.workout_session_id = $1
		ORDER BY ws.exercise_id, ws.set_number`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := m.DB.QueryContext(ctx, query, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sets []WorkoutSet
	for rows.Next() {
		var s WorkoutSet
		err := rows.Scan(
			&s.ID, &s.WorkoutSessionID, &s.ExerciseID, &s.ExerciseName,
			&s.SetNumber, &s.Weight, &s.Reps, &s.RIR, &s.Recorded, &s.CreatedAt, &s.Version,
		)
		if err != nil {
			return nil, err
		}
		sets = append(sets, s)
	}
	return sets, rows.Err()
}

func (m WorkoutSetModel) Delete(id int64) error {
	query := `DELETE FROM workout_sets WHERE id = $1`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	result, err := m.DB.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return ErrRecordNotFound
	}
	return nil
}

func (m WorkoutSetModel) DeleteForUser(id, userID int64) error {
	query := `
		DELETE FROM workout_sets wset
		USING workout_sessions ws
		WHERE wset.id = $1 AND wset.workout_session_id = ws.id AND ws.user_id = $2`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	result, err := m.DB.ExecContext(ctx, query, id, userID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return ErrRecordNotFound
	}
	return nil
}

func (m WorkoutSetModel) Update(set *WorkoutSet) error {
	query := `
		UPDATE workout_sets
		SET weight = $1, reps = $2, rir = $3, recorded = $4, version = version + 1
		WHERE id = $5
		RETURNING version`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	return m.DB.QueryRowContext(ctx, query, set.Weight, set.Reps, set.RIR, set.Recorded, set.ID).Scan(&set.Version)
}

func (m WorkoutSetModel) UpdateForUser(set *WorkoutSet, userID int64) error {
	query := `
		UPDATE workout_sets wset
		SET weight = $1, reps = $2, rir = $3, recorded = $4, version = wset.version + 1
		FROM workout_sessions ws
		WHERE wset.id = $5 AND wset.workout_session_id = ws.id AND ws.user_id = $6
		RETURNING wset.version`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := m.DB.QueryRowContext(ctx, query, set.Weight, set.Reps, set.RIR, set.Recorded, set.ID, userID).Scan(&set.Version)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrRecordNotFound
		}
		return err
	}

	return nil
}
