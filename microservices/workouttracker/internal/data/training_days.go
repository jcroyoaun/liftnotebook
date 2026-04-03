package data

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"workouttracker.jcroyoaun.io/internal/validator"
)

type TrainingDay struct {
	ID          int64              `json:"id"`
	MesocycleID int64              `json:"mesocycle_id"`
	DayNumber   int                `json:"day_number"`
	Label       string             `json:"label"`
	Exercises   []TrainingExercise `json:"exercises,omitempty"`
	CreatedAt   time.Time          `json:"-"`
	Version     int32              `json:"version,omitzero"`
}

type TrainingExercise struct {
	ID            int64  `json:"id"`
	TrainingDayID int64  `json:"training_day_id"`
	ExerciseID    int64  `json:"exercise_id"`
	ExerciseName  string `json:"exercise_name"`
	Position      int    `json:"position"`
	TargetSets    int    `json:"target_sets"`
}

type TrainingDayModel struct {
	DB *sql.DB
}

func ValidateTrainingDay(v *validator.Validator, td *TrainingDay) {
	v.Check(td.Label != "", "label", "must be provided")
	v.Check(len(td.Label) <= 100, "label", "must not be more than 100 characters")
	v.Check(td.DayNumber >= 1, "day_number", "must be at least 1")
}

func (m TrainingDayModel) InsertBatch(mesocycleID int64, days []TrainingDay) ([]TrainingDay, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	tx, err := m.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	query := `
		INSERT INTO training_days (mesocycle_id, day_number, label)
		VALUES ($1, $2, $3)
		RETURNING id, created_at, version`

	for i := range days {
		days[i].MesocycleID = mesocycleID
		err := tx.QueryRowContext(ctx, query, mesocycleID, days[i].DayNumber, days[i].Label).Scan(
			&days[i].ID, &days[i].CreatedAt, &days[i].Version,
		)
		if err != nil {
			return nil, err
		}
	}

	return days, tx.Commit()
}

func (m TrainingDayModel) GetForMesocycle(mesocycleID int64) ([]TrainingDay, error) {
	query := `
		SELECT id, mesocycle_id, day_number, label, created_at, version
		FROM training_days
		WHERE mesocycle_id = $1
		ORDER BY day_number`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := m.DB.QueryContext(ctx, query, mesocycleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var days []TrainingDay
	for rows.Next() {
		var day TrainingDay
		err := rows.Scan(&day.ID, &day.MesocycleID, &day.DayNumber, &day.Label, &day.CreatedAt, &day.Version)
		if err != nil {
			return nil, err
		}
		days = append(days, day)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}

	// Load exercises for each day
	for i := range days {
		exercises, err := m.GetExercisesForDay(days[i].ID)
		if err != nil {
			return nil, err
		}
		days[i].Exercises = exercises
	}

	return days, nil
}

func (m TrainingDayModel) Get(id int64) (*TrainingDay, error) {
	query := `
		SELECT id, mesocycle_id, day_number, label, created_at, version
		FROM training_days
		WHERE id = $1`

	var day TrainingDay

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := m.DB.QueryRowContext(ctx, query, id).Scan(
		&day.ID, &day.MesocycleID, &day.DayNumber, &day.Label, &day.CreatedAt, &day.Version,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrRecordNotFound
		}
		return nil, err
	}

	exercises, err := m.GetExercisesForDay(day.ID)
	if err != nil {
		return nil, err
	}
	day.Exercises = exercises

	return &day, nil
}

func (m TrainingDayModel) AddExercise(trainingDayID, exerciseID int64, position, targetSets int) (*TrainingExercise, error) {
	query := `
		INSERT INTO training_day_exercises (training_day_id, exercise_id, position, target_sets)
		VALUES ($1, $2, $3, $4)
		RETURNING id`

	var te TrainingExercise
	te.TrainingDayID = trainingDayID
	te.ExerciseID = exerciseID
	te.Position = position
	te.TargetSets = targetSets

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := m.DB.QueryRowContext(ctx, query, trainingDayID, exerciseID, position, targetSets).Scan(&te.ID)
	if err != nil {
		return nil, err
	}
	return &te, nil
}

func (m TrainingDayModel) RemoveExercise(id int64) error {
	query := `DELETE FROM training_day_exercises WHERE id = $1`

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

func (m TrainingDayModel) GetExercisesForDay(trainingDayID int64) ([]TrainingExercise, error) {
	query := `
		SELECT tde.id, tde.training_day_id, tde.exercise_id, e.name, tde.position, tde.target_sets
		FROM training_day_exercises tde
		JOIN exercises e ON tde.exercise_id = e.id
		WHERE tde.training_day_id = $1
		ORDER BY tde.position`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := m.DB.QueryContext(ctx, query, trainingDayID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var exercises []TrainingExercise
	for rows.Next() {
		var te TrainingExercise
		err := rows.Scan(&te.ID, &te.TrainingDayID, &te.ExerciseID, &te.ExerciseName, &te.Position, &te.TargetSets)
		if err != nil {
			return nil, err
		}
		exercises = append(exercises, te)
	}
	return exercises, rows.Err()
}

func (m TrainingDayModel) UpdateExercises(trainingDayID int64, exercises []TrainingExercise) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	tx, err := m.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, `DELETE FROM training_day_exercises WHERE training_day_id = $1`, trainingDayID)
	if err != nil {
		return err
	}

	query := `INSERT INTO training_day_exercises (training_day_id, exercise_id, position, target_sets) VALUES ($1, $2, $3, $4)`
	for _, ex := range exercises {
		_, err = tx.ExecContext(ctx, query, trainingDayID, ex.ExerciseID, ex.Position, ex.TargetSets)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (m TrainingDayModel) UpdateExercisesForUser(trainingDayID, userID int64, exercises []TrainingExercise) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	tx, err := m.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var ownedTrainingDayID int64
	err = tx.QueryRowContext(ctx, `
		SELECT td.id
		FROM training_days td
		JOIN mesocycles m ON td.mesocycle_id = m.id
		WHERE td.id = $1 AND m.user_id = $2
	`, trainingDayID, userID).Scan(&ownedTrainingDayID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrRecordNotFound
		}
		return err
	}

	_, err = tx.ExecContext(ctx, `DELETE FROM training_day_exercises WHERE training_day_id = $1`, trainingDayID)
	if err != nil {
		return err
	}

	query := `INSERT INTO training_day_exercises (training_day_id, exercise_id, position, target_sets) VALUES ($1, $2, $3, $4)`
	for _, ex := range exercises {
		_, err = tx.ExecContext(ctx, query, trainingDayID, ex.ExerciseID, ex.Position, ex.TargetSets)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}
