package data

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"exerciselib.jcroyoaun.io/internal/validator"
)

type BodyPart string

const (
	BodyPartChest     BodyPart = "chest"
	BodyPartBack      BodyPart = "back"
	BodyPartShoulders BodyPart = "shoulders"
	BodyPartArms      BodyPart = "arms"
	BodyPartLegs      BodyPart = "legs"
	BodyPartCore      BodyPart = "core"
)

type MuscleModel struct {
	DB *sql.DB
}

func (m MuscleModel) Insert(muscle *Muscle) error {
	query := `
        INSERT INTO muscles(name, body_part)
		VALUES ($1, $2)
		RETURNING id, created_at, version`

	args := []any{muscle.Name, muscle.BodyPart}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	return m.DB.QueryRowContext(ctx, query, args...).Scan(&muscle.ID, &muscle.CreatedAt, &muscle.Version)
}

func (m MuscleModel) Get(id int64) (*Muscle, error) {
	if id < 1 {
		return nil, ErrRecordNotFound
	}

	query := `
		SELECT id, created_at, name, body_part, version
		FROM muscles
		WHERE id = $1`

	var muscle Muscle

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := m.DB.QueryRowContext(ctx, query, id).Scan(
		&muscle.ID,
		&muscle.CreatedAt,
		&muscle.Name,
		&muscle.BodyPart,
		&muscle.Version,
	)

	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, err
		}
	}

	return &muscle, nil
}

func (m MuscleModel) Update(muscle *Muscle) error {
	query := `
		UPDATE muscles
		SET name = $1, body_part = $2, version = version + 1
		WHERE id = $3 AND version = $4
		RETURNING version`

	args := []any{
		muscle.Name,
		muscle.BodyPart,
		muscle.ID,
		muscle.Version,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := m.DB.QueryRowContext(ctx, query, args...).Scan(&muscle.Version)
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

func (m MuscleModel) Delete(id int64) error {
	if id < 1 {
		return ErrRecordNotFound
	}

	query := `
		DELETE FROM muscles
		WHERE id = $1`

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

func (m MuscleModel) GetAll(bodyPart BodyPart, filters Filters) ([]*Muscle, Metadata, error) {
	baseQuery := `
		SELECT count(*) OVER(), id, created_at, name, body_part, version
		FROM muscles
		WHERE ($1 = '' OR body_part::text = $1)`

	query := baseQuery + `
		ORDER BY body_part ASC, name ASC
		LIMIT $2 OFFSET $3`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	var bodyPartStr string
	if bodyPart != "" {
		bodyPartStr = string(bodyPart)
	}

	args := []any{bodyPartStr, filters.limit(), filters.offset()}

	rows, err := m.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, Metadata{}, err
	}
	defer rows.Close()

	totalRecords := 0
	muscles := []*Muscle{}

	for rows.Next() {
		var muscle Muscle

		err := rows.Scan(
			&totalRecords,
			&muscle.ID,
			&muscle.CreatedAt,
			&muscle.Name,
			&muscle.BodyPart,
			&muscle.Version,
		)

		if err != nil {
			return nil, Metadata{}, err
		}

		muscles = append(muscles, &muscle)
	}

	if err = rows.Err(); err != nil {
		return nil, Metadata{}, err
	}

	metadata := calculateMetadata(totalRecords, filters.Page, filters.PageSize)

	return muscles, metadata, nil
}

func ValidateMuscle(v *validator.Validator, muscle *Muscle) {
	v.Check(muscle.Name != "", "name", "must be provided")
	v.Check(len(muscle.Name) <= 100, "name", "must not be more than 100 bytes long")

	validBodyParts := []BodyPart{BodyPartChest, BodyPartBack, BodyPartShoulders, BodyPartArms, BodyPartLegs, BodyPartCore}
	v.Check(validator.PermittedValue(BodyPart(muscle.BodyPart), validBodyParts...), "body_part", "must be a valid body part")
}
