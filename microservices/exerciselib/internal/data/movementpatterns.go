package data

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"exerciselib.jcroyoaun.io/internal/validator"
)

type MovementPattern struct {
	ID          int64     `json:"id"`
	CreatedAt   time.Time `json:"-"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Version     int32     `json:"version,omitzero"`
}

type MovementPatternModel struct {
	DB *sql.DB
}

func (m MovementPatternModel) Insert(pattern *MovementPattern) error {
	query := `
        INSERT INTO movement_patterns(name, description)
		VALUES ($1, $2)
		RETURNING id, created_at, version`

	args := []any{pattern.Name, pattern.Description}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	return m.DB.QueryRowContext(ctx, query, args...).Scan(&pattern.ID, &pattern.CreatedAt, &pattern.Version)
}

func (m MovementPatternModel) Get(id int64) (*MovementPattern, error) {
	if id < 1 {
		return nil, ErrRecordNotFound
	}

	query := `
		SELECT id, created_at, name, description, version
		FROM movement_patterns
		WHERE id = $1`

	var pattern MovementPattern

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := m.DB.QueryRowContext(ctx, query, id).Scan(
		&pattern.ID,
		&pattern.CreatedAt,
		&pattern.Name,
		&pattern.Description,
		&pattern.Version,
	)

	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, err
		}
	}

	return &pattern, nil
}

func (m MovementPatternModel) Update(pattern *MovementPattern) error {
	query := `
		UPDATE movement_patterns
		SET name = $1, description = $2, version = version + 1
		WHERE id = $3 AND version = $4
		RETURNING version`

	args := []any{
		pattern.Name,
		pattern.Description,
		pattern.ID,
		pattern.Version,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := m.DB.QueryRowContext(ctx, query, args...).Scan(&pattern.Version)
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

func (m MovementPatternModel) Delete(id int64) error {
	if id < 1 {
		return ErrRecordNotFound
	}

	query := `
		DELETE FROM movement_patterns
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

func (m MovementPatternModel) GetAll(name string, filters Filters) ([]*MovementPattern, Metadata, error) {
	query := `
		SELECT count(*) OVER(), id, created_at, name, description, version
		FROM movement_patterns
		WHERE ($1 = '' OR LOWER(name) LIKE LOWER($1))
		ORDER BY name ASC
		LIMIT $2 OFFSET $3`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// Add wildcards for partial matching
	var nameFilter string
	if name != "" {
		nameFilter = "%" + name + "%"
	}

	args := []any{nameFilter, filters.limit(), filters.offset()}

	rows, err := m.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, Metadata{}, err
	}
	defer rows.Close()

	totalRecords := 0
	patterns := []*MovementPattern{}

	for rows.Next() {
		var pattern MovementPattern

		err := rows.Scan(
			&totalRecords,
			&pattern.ID,
			&pattern.CreatedAt,
			&pattern.Name,
			&pattern.Description,
			&pattern.Version,
		)

		if err != nil {
			return nil, Metadata{}, err
		}

		patterns = append(patterns, &pattern)
	}

	if err = rows.Err(); err != nil {
		return nil, Metadata{}, err
	}

	metadata := calculateMetadata(totalRecords, filters.Page, filters.PageSize)

	return patterns, metadata, nil
}

func ValidateMovementPattern(v *validator.Validator, pattern *MovementPattern) {
	v.Check(pattern.Name != "", "name", "must be provided")
	v.Check(len(pattern.Name) <= 500, "name", "must not be more than 500 bytes long")
}
