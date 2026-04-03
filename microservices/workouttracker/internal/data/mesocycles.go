package data

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"workouttracker.jcroyoaun.io/internal/validator"
)

type Mesocycle struct {
	ID          int64      `json:"id"`
	UserID      int64      `json:"user_id"`
	Name        string     `json:"name"`
	DaysPerWeek int        `json:"days_per_week"`
	StartedAt   time.Time  `json:"started_at"`
	EndedAt     *time.Time `json:"ended_at"`
	CreatedAt   time.Time  `json:"-"`
	Version     int32      `json:"version,omitzero"`
}

type MesocycleModel struct {
	DB *sql.DB
}

func ValidateMesocycle(v *validator.Validator, m *Mesocycle) {
	v.Check(m.Name != "", "name", "must be provided")
	v.Check(len(m.Name) <= 200, "name", "must not be more than 200 characters")
	v.Check(m.DaysPerWeek >= 1, "days_per_week", "must be at least 1")
	v.Check(m.DaysPerWeek <= 7, "days_per_week", "must be at most 7")
}

func (m MesocycleModel) Insert(meso *Mesocycle) error {
	query := `
		INSERT INTO mesocycles (user_id, name, days_per_week)
		VALUES ($1, $2, $3)
		RETURNING id, started_at, created_at, version`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	return m.DB.QueryRowContext(ctx, query, meso.UserID, meso.Name, meso.DaysPerWeek).Scan(
		&meso.ID, &meso.StartedAt, &meso.CreatedAt, &meso.Version,
	)
}

func (m MesocycleModel) Get(id, userID int64) (*Mesocycle, error) {
	query := `
		SELECT id, user_id, name, days_per_week, started_at, ended_at, created_at, version
		FROM mesocycles
		WHERE id = $1 AND user_id = $2`

	var meso Mesocycle

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := m.DB.QueryRowContext(ctx, query, id, userID).Scan(
		&meso.ID, &meso.UserID, &meso.Name, &meso.DaysPerWeek,
		&meso.StartedAt, &meso.EndedAt, &meso.CreatedAt, &meso.Version,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrRecordNotFound
		}
		return nil, err
	}
	return &meso, nil
}

func (m MesocycleModel) GetActive(userID int64) (*Mesocycle, error) {
	query := `
		SELECT id, user_id, name, days_per_week, started_at, ended_at, created_at, version
		FROM mesocycles
		WHERE user_id = $1 AND ended_at IS NULL
		ORDER BY started_at DESC
		LIMIT 1`

	var meso Mesocycle

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := m.DB.QueryRowContext(ctx, query, userID).Scan(
		&meso.ID, &meso.UserID, &meso.Name, &meso.DaysPerWeek,
		&meso.StartedAt, &meso.EndedAt, &meso.CreatedAt, &meso.Version,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrRecordNotFound
		}
		return nil, err
	}
	return &meso, nil
}

func (m MesocycleModel) ListForUser(userID int64) ([]*Mesocycle, error) {
	query := `
		SELECT id, user_id, name, days_per_week, started_at, ended_at, created_at, version
		FROM mesocycles
		WHERE user_id = $1
		ORDER BY started_at DESC`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := m.DB.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var mesocycles []*Mesocycle
	for rows.Next() {
		var meso Mesocycle
		err := rows.Scan(
			&meso.ID, &meso.UserID, &meso.Name, &meso.DaysPerWeek,
			&meso.StartedAt, &meso.EndedAt, &meso.CreatedAt, &meso.Version,
		)
		if err != nil {
			return nil, err
		}
		mesocycles = append(mesocycles, &meso)
	}
	return mesocycles, rows.Err()
}

func (m MesocycleModel) Delete(id, userID int64) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	tx, err := m.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Verify ownership
	var exists bool
	err = tx.QueryRowContext(ctx,
		`SELECT EXISTS(SELECT 1 FROM mesocycles WHERE id = $1 AND user_id = $2)`,
		id, userID).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return ErrRecordNotFound
	}

	// Delete workout_sessions (workout_sets cascade from sessions)
	_, err = tx.ExecContext(ctx,
		`DELETE FROM workout_sessions WHERE mesocycle_id = $1`, id)
	if err != nil {
		return err
	}

	// Delete mesocycle (training_days and training_day_exercises cascade)
	_, err = tx.ExecContext(ctx,
		`DELETE FROM mesocycles WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (m MesocycleModel) End(id, userID int64) error {
	query := `
		UPDATE mesocycles
		SET ended_at = now(), version = version + 1
		WHERE id = $1 AND user_id = $2 AND ended_at IS NULL
		RETURNING version`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	var version int32
	err := m.DB.QueryRowContext(ctx, query, id, userID).Scan(&version)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrRecordNotFound
		}
		return err
	}
	return nil
}
