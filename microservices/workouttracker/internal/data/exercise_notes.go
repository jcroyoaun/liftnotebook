package data

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

// ExerciseNote is a per-(session, exercise) note — a dated record like
// "Panatta taken, used Lifefitness at 45 kg". It is deliberately temporal:
// the note stays joined to the session's date and weights, which is the
// whole point (a mutable pinned note would destroy that history).
type ExerciseNote struct {
	WorkoutSessionID int64     `json:"workout_session_id"`
	ExerciseID       int64     `json:"exercise_id"`
	Note             string    `json:"note"`
	CreatedAt        time.Time `json:"-"`
	Version          int32     `json:"version,omitzero"`
}

// RecentExerciseNote is a dated note surfaced beside progression
// suggestions ("what happened last time I did this exercise").
type RecentExerciseNote struct {
	Note        string    `json:"note"`
	PerformedAt time.Time `json:"performed_at"`
	SessionID   int64     `json:"session_id"`
}

type ExerciseNoteModel struct {
	DB *sql.DB
}

// UpsertForUser writes the note for one exercise in one session the user
// owns (ownership enforced through the sessions join, mirroring set
// logging). An empty note deletes the row; the composite natural PK makes
// offline replays idempotent.
func (m ExerciseNoteModel) UpsertForUser(note *ExerciseNote, userID int64) error {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if note.Note == "" {
		query := `
			DELETE FROM workout_exercise_notes wen
			USING workout_sessions ws
			WHERE wen.workout_session_id = $1 AND wen.exercise_id = $2
			  AND wen.workout_session_id = ws.id AND ws.user_id = $3`

		// Clearing an absent note is a no-op, not an error: the write is
		// idempotent by design so the offline queue can replay it safely.
		_, err := m.DB.ExecContext(ctx, query, note.WorkoutSessionID, note.ExerciseID, userID)
		return err
	}

	query := `
		INSERT INTO workout_exercise_notes (workout_session_id, exercise_id, note)
		SELECT $1, $2, $3
		FROM workout_sessions ws
		WHERE ws.id = $1 AND ws.user_id = $4
		ON CONFLICT (workout_session_id, exercise_id)
		DO UPDATE SET note = EXCLUDED.note, version = workout_exercise_notes.version + 1
		RETURNING created_at, version`

	err := m.DB.QueryRowContext(ctx, query,
		note.WorkoutSessionID, note.ExerciseID, note.Note, userID,
	).Scan(&note.CreatedAt, &note.Version)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrRecordNotFound
		}
		return err
	}

	return nil
}

// GetForSession returns every exercise note in a session. Ownership is the
// caller's job (the handler loads the session first), matching how sets are
// fetched.
func (m ExerciseNoteModel) GetForSession(sessionID int64) ([]ExerciseNote, error) {
	query := `
		SELECT workout_session_id, exercise_id, note, created_at, version
		FROM workout_exercise_notes
		WHERE workout_session_id = $1
		ORDER BY exercise_id`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := m.DB.QueryContext(ctx, query, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notes []ExerciseNote
	for rows.Next() {
		var n ExerciseNote
		err := rows.Scan(&n.WorkoutSessionID, &n.ExerciseID, &n.Note, &n.CreatedAt, &n.Version)
		if err != nil {
			return nil, err
		}
		notes = append(notes, n)
	}
	return notes, rows.Err()
}

// GetRecentForExercise returns the user's latest dated notes for one
// exercise, most recent first — the "4 weeks ago when Panatta was taken I
// used Lifefitness at 45 kg" lookup during logging.
func (m ExerciseNoteModel) GetRecentForExercise(userID, exerciseID int64, limit int) ([]RecentExerciseNote, error) {
	query := `
		SELECT wen.note, ws.performed_at, ws.id
		FROM workout_exercise_notes wen
		JOIN workout_sessions ws ON wen.workout_session_id = ws.id
		WHERE ws.user_id = $1 AND wen.exercise_id = $2
		ORDER BY ws.performed_at DESC, ws.id DESC
		LIMIT $3`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := m.DB.QueryContext(ctx, query, userID, exerciseID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notes []RecentExerciseNote
	for rows.Next() {
		var n RecentExerciseNote
		err := rows.Scan(&n.Note, &n.PerformedAt, &n.SessionID)
		if err != nil {
			return nil, err
		}
		notes = append(notes, n)
	}
	return notes, rows.Err()
}

// GetForMesocycle returns every exercise note in a block (ownership through
// the sessions join) — the notes half of a block export.
func (m ExerciseNoteModel) GetForMesocycle(userID, mesocycleID int64) ([]ExerciseNote, error) {
	query := `
		SELECT wen.workout_session_id, wen.exercise_id, wen.note, wen.created_at, wen.version
		FROM workout_exercise_notes wen
		JOIN workout_sessions ws ON wen.workout_session_id = ws.id
		WHERE ws.user_id = $1 AND ws.mesocycle_id = $2
		ORDER BY wen.workout_session_id, wen.exercise_id`

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := m.DB.QueryContext(ctx, query, userID, mesocycleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notes []ExerciseNote
	for rows.Next() {
		var n ExerciseNote
		err := rows.Scan(&n.WorkoutSessionID, &n.ExerciseID, &n.Note, &n.CreatedAt, &n.Version)
		if err != nil {
			return nil, err
		}
		notes = append(notes, n)
	}
	return notes, rows.Err()
}
