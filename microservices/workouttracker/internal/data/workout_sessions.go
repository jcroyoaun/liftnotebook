package data

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type WorkoutSession struct {
	ID            int64     `json:"id"`
	UserID        int64     `json:"user_id"`
	MesocycleID   int64     `json:"mesocycle_id"`
	TrainingDayID int64     `json:"training_day_id"`
	DayLabel      string    `json:"day_label,omitempty"`
	PerformedAt   time.Time `json:"performed_at"`
	Notes         *string   `json:"notes"`
	CreatedAt     time.Time `json:"-"`
	Version       int32     `json:"version,omitzero"`
}

type WorkoutSessionModel struct {
	DB *sql.DB
}

func (m WorkoutSessionModel) Insert(session *WorkoutSession) error {
	query := `
		INSERT INTO workout_sessions (user_id, mesocycle_id, training_day_id, performed_at, notes)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, version`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	performedAt := session.PerformedAt
	if performedAt.IsZero() {
		performedAt = time.Now()
	}

	return m.DB.QueryRowContext(ctx, query,
		session.UserID, session.MesocycleID, session.TrainingDayID, performedAt, session.Notes,
	).Scan(&session.ID, &session.CreatedAt, &session.Version)
}

func (m WorkoutSessionModel) Get(id, userID int64) (*WorkoutSession, error) {
	query := `
		SELECT ws.id, ws.user_id, ws.mesocycle_id, ws.training_day_id, td.label,
		       ws.performed_at, ws.notes, ws.created_at, ws.version
		FROM workout_sessions ws
		JOIN training_days td ON ws.training_day_id = td.id
		WHERE ws.id = $1 AND ws.user_id = $2`

	var session WorkoutSession

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := m.DB.QueryRowContext(ctx, query, id, userID).Scan(
		&session.ID, &session.UserID, &session.MesocycleID, &session.TrainingDayID,
		&session.DayLabel, &session.PerformedAt, &session.Notes, &session.CreatedAt, &session.Version,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrRecordNotFound
		}
		return nil, err
	}
	return &session, nil
}

func (m WorkoutSessionModel) ListForMesocycle(userID, mesocycleID int64) ([]*WorkoutSession, error) {
	query := `
		SELECT ws.id, ws.user_id, ws.mesocycle_id, ws.training_day_id, td.label,
		       ws.performed_at, ws.notes, ws.created_at, ws.version
		FROM workout_sessions ws
		JOIN training_days td ON ws.training_day_id = td.id
		WHERE ws.user_id = $1 AND ws.mesocycle_id = $2
		ORDER BY ws.performed_at DESC`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := m.DB.QueryContext(ctx, query, userID, mesocycleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []*WorkoutSession
	for rows.Next() {
		var s WorkoutSession
		err := rows.Scan(
			&s.ID, &s.UserID, &s.MesocycleID, &s.TrainingDayID,
			&s.DayLabel, &s.PerformedAt, &s.Notes, &s.CreatedAt, &s.Version,
		)
		if err != nil {
			return nil, err
		}
		sessions = append(sessions, &s)
	}
	return sessions, rows.Err()
}
