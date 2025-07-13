package data

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"exerciselib.jcroyoaun.io/internal/validator"
)

// Exercise type enum
type ExerciseType string

const (
	ExerciseTypeCompound  ExerciseType = "compound"
	ExerciseTypeIsolation ExerciseType = "isolation"
)

// Muscle represents a muscle in the database
type Muscle struct {
	ID        int64     `json:"id"`
	CreatedAt time.Time `json:"-"`
	Name      string    `json:"name"`
	BodyPart  string    `json:"body_part"`
	Version   int32     `json:"version,omitzero"`
}

// ExerciseMuscle represents the relationship between an exercise and a muscle
type ExerciseMuscle struct {
	ExerciseID int64  `json:"exercise_id"`
	MuscleID   int64  `json:"muscle_id"`
	Muscle     Muscle `json:"muscle"`
	TargetType string `json:"target_type"` // "primary" or "secondary"
}

type Exercise struct {
	ID                int64            `json:"id"`
	CreatedAt         time.Time        `json:"-"`
	Name              string           `json:"name"`
	Type              ExerciseType     `json:"type"`
	MovementPatternID int64            `json:"movement_pattern_id"`
	MovementPattern   *MovementPattern `json:"movement_pattern,omitempty"`
	PrimaryMuscles    []Muscle         `json:"primary_muscles,omitempty"`
	SecondaryMuscles  []Muscle         `json:"secondary_muscles,omitempty"`
	Version           int32            `json:"version,omitzero"`
}

type ExerciseModel struct {
	DB *sql.DB
}

func (e ExerciseModel) Insert(exercise *Exercise) error {
	query := `
        INSERT INTO exercises(name, type, movement_pattern_id)
		VALUES ($1, $2, $3)
		RETURNING id, created_at, version`

	args := []any{exercise.Name, exercise.Type, exercise.MovementPatternID}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	return e.DB.QueryRowContext(ctx, query, args...).Scan(&exercise.ID, &exercise.CreatedAt, &exercise.Version)
}

func (e ExerciseModel) InsertMuscles(exerciseID int64, primaryMuscles, secondaryMuscles []int64) error {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// Start a transaction
	tx, err := e.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Insert primary muscles
	for _, muscleID := range primaryMuscles {
		_, err = tx.ExecContext(ctx, `
			INSERT INTO exercise_muscles (exercise_id, muscle_id, target_type)
			VALUES ($1, $2, 'primary')
			ON CONFLICT (exercise_id, muscle_id) DO UPDATE SET target_type = 'primary'
		`, exerciseID, muscleID)
		if err != nil {
			return err
		}
	}

	// Insert secondary muscles
	for _, muscleID := range secondaryMuscles {
		_, err = tx.ExecContext(ctx, `
			INSERT INTO exercise_muscles (exercise_id, muscle_id, target_type)
			VALUES ($1, $2, 'secondary')
			ON CONFLICT (exercise_id, muscle_id) DO UPDATE SET target_type = 'secondary'
		`, exerciseID, muscleID)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (e ExerciseModel) UpdateMuscles(exerciseID int64, primaryMuscles, secondaryMuscles []int64) error {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// Start a transaction
	tx, err := e.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Remove existing muscle relationships
	_, err = tx.ExecContext(ctx, `DELETE FROM exercise_muscles WHERE exercise_id = $1`, exerciseID)
	if err != nil {
		return err
	}

	// Insert primary muscles
	for _, muscleID := range primaryMuscles {
		_, err = tx.ExecContext(ctx, `
			INSERT INTO exercise_muscles (exercise_id, muscle_id, target_type)
			VALUES ($1, $2, 'primary')
		`, exerciseID, muscleID)
		if err != nil {
			return err
		}
	}

	// Insert secondary muscles
	for _, muscleID := range secondaryMuscles {
		_, err = tx.ExecContext(ctx, `
			INSERT INTO exercise_muscles (exercise_id, muscle_id, target_type)
			VALUES ($1, $2, 'secondary')
		`, exerciseID, muscleID)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (e ExerciseModel) Get(id int64) (*Exercise, error) {
	if id < 1 {
		return nil, ErrRecordNotFound
	}

	query := `
		SELECT e.id, e.created_at, e.name, e.type, e.movement_pattern_id, e.version,
		       mp.name as movement_pattern_name, mp.description as movement_pattern_description
		FROM exercises e
		LEFT JOIN movement_patterns mp ON e.movement_pattern_id = mp.id
		WHERE e.id = $1`

	var exercise Exercise
	var movementPattern MovementPattern

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := e.DB.QueryRowContext(ctx, query, id).Scan(
		&exercise.ID,
		&exercise.CreatedAt,
		&exercise.Name,
		&exercise.Type,
		&exercise.MovementPatternID,
		&exercise.Version,
		&movementPattern.Name,
		&movementPattern.Description,
	)

	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, err
		}
	}

	movementPattern.ID = exercise.MovementPatternID
	exercise.MovementPattern = &movementPattern

	// Get muscles for this exercise
	err = e.getMusclesForExercise(&exercise)
	if err != nil {
		return nil, err
	}

	return &exercise, nil
}

func (e ExerciseModel) getMusclesForExercise(exercise *Exercise) error {
	query := `
		SELECT m.id, m.name, m.body_part, em.target_type
		FROM muscles m
		JOIN exercise_muscles em ON m.id = em.muscle_id
		WHERE em.exercise_id = $1
		ORDER BY em.target_type, m.name`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := e.DB.QueryContext(ctx, query, exercise.ID)
	if err != nil {
		return err
	}
	defer rows.Close()

	var primaryMuscles []Muscle
	var secondaryMuscles []Muscle

	for rows.Next() {
		var muscle Muscle
		var targetType string

		err := rows.Scan(&muscle.ID, &muscle.Name, &muscle.BodyPart, &targetType)
		if err != nil {
			return err
		}

		if targetType == "primary" {
			primaryMuscles = append(primaryMuscles, muscle)
		} else {
			secondaryMuscles = append(secondaryMuscles, muscle)
		}
	}

	if err = rows.Err(); err != nil {
		return err
	}

	exercise.PrimaryMuscles = primaryMuscles
	exercise.SecondaryMuscles = secondaryMuscles

	return nil
}

func (e ExerciseModel) Update(exercise *Exercise) error {
	query := `
		UPDATE exercises
		SET name = $1, type = $2, movement_pattern_id = $3, version = version + 1
		WHERE id = $4 AND version = $5
		RETURNING version`

	args := []any{
		exercise.Name,
		exercise.Type,
		exercise.MovementPatternID,
		exercise.ID,
		exercise.Version,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := e.DB.QueryRowContext(ctx, query, args...).Scan(&exercise.Version)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return ErrEditConflict
		default:
			return err
		}
	}

	return nil
}

func (e ExerciseModel) Delete(id int64) error {
	if id < 1 {
		return ErrRecordNotFound
	}

	query := `
		DELETE FROM exercises
		WHERE id = $1`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	result, err := e.DB.ExecContext(ctx, query, id)
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

func (e ExerciseModel) GetAll(name string, exerciseType ExerciseType, movementPatternID int64, movementPatternName string, bodyPart string, muscleID int64, filters Filters) ([]*Exercise, Metadata, error) {
	// Base query with exercise and movement pattern data
	baseQuery := `
		SELECT DISTINCT count(*) OVER(), e.id, e.created_at, e.name, e.type, e.movement_pattern_id, e.version,
		       mp.name as movement_pattern_name, mp.description as movement_pattern_description
		FROM exercises e
		LEFT JOIN movement_patterns mp ON e.movement_pattern_id = mp.id`

	// Add joins and filters based on muscle filtering
	var whereConditions []string
	var args []any
	argIndex := 1

	// Name filter
	whereConditions = append(whereConditions, fmt.Sprintf("(to_tsvector('simple', e.name) @@ plainto_tsquery('simple', $%d) OR $%d = '')", argIndex, argIndex))
	args = append(args, name)
	argIndex++

	// Exercise type filter
	whereConditions = append(whereConditions, fmt.Sprintf("($%d = '' OR e.type::text = $%d)", argIndex, argIndex))
	var exerciseTypeStr string
	if exerciseType != "" {
		exerciseTypeStr = string(exerciseType)
	}
	args = append(args, exerciseTypeStr)
	argIndex++

	// Movement pattern ID filter (exact match)
	whereConditions = append(whereConditions, fmt.Sprintf("($%d = 0 OR e.movement_pattern_id = $%d)", argIndex, argIndex))
	args = append(args, movementPatternID)
	argIndex++

	// Movement pattern name filter (partial match)
	whereConditions = append(whereConditions, fmt.Sprintf("($%d = '' OR LOWER(mp.name) LIKE LOWER($%d))", argIndex, argIndex))
	var movementPatternNameFilter string
	if movementPatternName != "" {
		movementPatternNameFilter = "%" + movementPatternName + "%"
	}
	args = append(args, movementPatternNameFilter)
	argIndex++

	// Add muscle filtering if requested
	if bodyPart != "" || muscleID > 0 {
		baseQuery += `
		JOIN exercise_muscles em ON e.id = em.exercise_id
		JOIN muscles m ON em.muscle_id = m.id`

		if bodyPart != "" {
			whereConditions = append(whereConditions, fmt.Sprintf("m.body_part::text = $%d", argIndex))
			args = append(args, bodyPart)
			argIndex++
		}

		if muscleID > 0 {
			whereConditions = append(whereConditions, fmt.Sprintf("m.id = $%d", argIndex))
			args = append(args, muscleID)
			argIndex++
		}
	}

	// Combine all conditions
	if len(whereConditions) > 0 {
		baseQuery += " WHERE " + strings.Join(whereConditions, " AND ")
	}

	// Add ordering and pagination
	query := fmt.Sprintf(`%s
		ORDER BY %s %s, e.id ASC
		LIMIT $%d OFFSET $%d`, baseQuery, filters.sortColumn(), filters.sortDirection(), argIndex, argIndex+1)

	args = append(args, filters.limit(), filters.offset())

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := e.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, Metadata{}, err
	}
	defer rows.Close()

	totalRecords := 0
	exercises := []*Exercise{}

	for rows.Next() {
		var exercise Exercise
		var movementPattern MovementPattern

		err := rows.Scan(
			&totalRecords,
			&exercise.ID,
			&exercise.CreatedAt,
			&exercise.Name,
			&exercise.Type,
			&exercise.MovementPatternID,
			&exercise.Version,
			&movementPattern.Name,
			&movementPattern.Description,
		)

		if err != nil {
			return nil, Metadata{}, err
		}

		movementPattern.ID = exercise.MovementPatternID
		exercise.MovementPattern = &movementPattern

		// Get muscles for this exercise
		err = e.getMusclesForExercise(&exercise)
		if err != nil {
			return nil, Metadata{}, err
		}

		exercises = append(exercises, &exercise)
	}

	if err = rows.Err(); err != nil {
		return nil, Metadata{}, err
	}

	metadata := calculateMetadata(totalRecords, filters.Page, filters.PageSize)

	return exercises, metadata, nil
}

func ValidateExercise(v *validator.Validator, exercise *Exercise) {
	v.Check(exercise.Name != "", "name", "must be provided")
	v.Check(len(exercise.Name) <= 500, "name", "must not be more than 500 bytes long")

	v.Check(exercise.Type != "", "type", "must be provided")
	v.Check(exercise.Type == ExerciseTypeCompound || exercise.Type == ExerciseTypeIsolation, "type", "must be either 'compound' or 'isolation'")

	v.Check(exercise.MovementPatternID > 0, "movement_pattern_id", "must be a positive integer")
}
