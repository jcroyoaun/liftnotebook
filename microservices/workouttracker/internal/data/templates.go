package data

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"workouttracker.jcroyoaun.io/internal/validator"
)

type ProgramTemplate struct {
	ID          int64         `json:"id"`
	CreatedAt   time.Time     `json:"created_at"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	DaysPerWeek int           `json:"days_per_week"`
	Days        []TemplateDay `json:"days"`
	Version     int32         `json:"version,omitzero"`
}

type TemplateDay struct {
	ID         int64              `json:"id"`
	TemplateID int64              `json:"template_id"`
	DayNumber  int                `json:"day_number"`
	Label      string             `json:"label"`
	Exercises  []TemplateExercise `json:"exercises"`
}

type TemplateExercise struct {
	ID                 int64  `json:"id"`
	TemplateDayID      int64  `json:"template_day_id"`
	ExerciseID         int64  `json:"exercise_id"`
	ExerciseName       string `json:"exercise_name"`
	Position           int    `json:"position"`
	TargetSets         int    `json:"target_sets"`
	TargetRepRangeLow  int    `json:"target_rep_range_low"`
	TargetRepRangeHigh int    `json:"target_rep_range_high"`
	TargetRIR          int    `json:"target_rir"`
}

// ApplyTargetDefaults fills unset training targets with the house defaults:
// 2 working sets of 8-12 reps taken to failure (RIR 0).
func (te *TemplateExercise) ApplyTargetDefaults() {
	if te.TargetSets == 0 {
		te.TargetSets = 2
	}
	if te.TargetRepRangeLow == 0 {
		te.TargetRepRangeLow = 8
	}
	if te.TargetRepRangeHigh == 0 {
		te.TargetRepRangeHigh = 12
	}
}

func ValidateProgramTemplate(v *validator.Validator, t *ProgramTemplate) {
	v.Check(t.Name != "", "name", "must be provided")
	v.Check(len(t.Name) <= 100, "name", "must not be more than 100 characters")
	v.Check(len(t.Description) <= 1000, "description", "must not be more than 1000 characters")
	v.Check(t.DaysPerWeek >= 1 && t.DaysPerWeek <= 7, "days_per_week", "must be between 1 and 7")
	v.Check(len(t.Days) == t.DaysPerWeek, "days", "must provide one entry per training day")

	seen := make(map[int]bool)
	for _, day := range t.Days {
		v.Check(day.Label != "", "label", "must be provided for every day")
		v.Check(len(day.Label) <= 100, "label", "must not be more than 100 characters")
		v.Check(day.DayNumber >= 1 && day.DayNumber <= t.DaysPerWeek, "day_number", "must be between 1 and days_per_week")
		v.Check(!seen[day.DayNumber], "day_number", "must be unique per day")
		seen[day.DayNumber] = true

		for i := range day.Exercises {
			ex := &day.Exercises[i]
			v.Check(ex.ExerciseID > 0, "exercise_id", "must be a positive integer")
			v.Check(ex.TargetSets >= 1, "target_sets", "must be at least 1")
			v.Check(ex.TargetRepRangeLow >= 1, "target_rep_range_low", "must be at least 1")
			v.Check(ex.TargetRepRangeHigh >= ex.TargetRepRangeLow, "target_rep_range_high", "must not be lower than target_rep_range_low")
			v.Check(ex.TargetRIR >= 0 && ex.TargetRIR <= 10, "target_rir", "must be between 0 and 10")
		}
	}
}

type TemplateModel struct {
	DB *sql.DB
}

func (m TemplateModel) Insert(t *ProgramTemplate, createdBy int64) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	tx, err := m.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	err = tx.QueryRowContext(ctx, `
		INSERT INTO program_templates (name, description, days_per_week, created_by)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, version`,
		t.Name, t.Description, t.DaysPerWeek, createdBy,
	).Scan(&t.ID, &t.CreatedAt, &t.Version)
	if err != nil {
		return err
	}

	err = insertTemplateDays(ctx, tx, t)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func insertTemplateDays(ctx context.Context, tx *sql.Tx, t *ProgramTemplate) error {
	dayQuery := `
		INSERT INTO template_days (template_id, day_number, label)
		VALUES ($1, $2, $3)
		RETURNING id`
	exQuery := `
		INSERT INTO template_day_exercises
			(template_day_id, exercise_id, position, target_sets, target_rep_range_low, target_rep_range_high, target_rir)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id`

	for i := range t.Days {
		day := &t.Days[i]
		day.TemplateID = t.ID
		err := tx.QueryRowContext(ctx, dayQuery, t.ID, day.DayNumber, day.Label).Scan(&day.ID)
		if err != nil {
			return err
		}
		for j := range day.Exercises {
			ex := &day.Exercises[j]
			ex.TemplateDayID = day.ID
			err := tx.QueryRowContext(ctx, exQuery,
				day.ID, ex.ExerciseID, ex.Position, ex.TargetSets,
				ex.TargetRepRangeLow, ex.TargetRepRangeHigh, ex.TargetRIR,
			).Scan(&ex.ID)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (m TemplateModel) Update(t *ProgramTemplate) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	tx, err := m.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	err = tx.QueryRowContext(ctx, `
		UPDATE program_templates
		SET name = $1, description = $2, days_per_week = $3, version = version + 1
		WHERE id = $4
		RETURNING created_at, version`,
		t.Name, t.Description, t.DaysPerWeek, t.ID,
	).Scan(&t.CreatedAt, &t.Version)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrRecordNotFound
		}
		return err
	}

	_, err = tx.ExecContext(ctx, `DELETE FROM template_days WHERE template_id = $1`, t.ID)
	if err != nil {
		return err
	}

	err = insertTemplateDays(ctx, tx, t)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (m TemplateModel) GetAll() ([]ProgramTemplate, error) {
	query := `
		SELECT id, created_at, name, description, days_per_week, version
		FROM program_templates
		ORDER BY days_per_week, name`

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := m.DB.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var templates []ProgramTemplate
	for rows.Next() {
		var t ProgramTemplate
		err := rows.Scan(&t.ID, &t.CreatedAt, &t.Name, &t.Description, &t.DaysPerWeek, &t.Version)
		if err != nil {
			return nil, err
		}
		templates = append(templates, t)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}

	for i := range templates {
		days, err := m.getDays(templates[i].ID)
		if err != nil {
			return nil, err
		}
		templates[i].Days = days
	}

	return templates, nil
}

func (m TemplateModel) Get(id int64) (*ProgramTemplate, error) {
	query := `
		SELECT id, created_at, name, description, days_per_week, version
		FROM program_templates
		WHERE id = $1`

	var t ProgramTemplate

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := m.DB.QueryRowContext(ctx, query, id).Scan(
		&t.ID, &t.CreatedAt, &t.Name, &t.Description, &t.DaysPerWeek, &t.Version,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrRecordNotFound
		}
		return nil, err
	}

	days, err := m.getDays(t.ID)
	if err != nil {
		return nil, err
	}
	t.Days = days

	return &t, nil
}

func (m TemplateModel) getDays(templateID int64) ([]TemplateDay, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := m.DB.QueryContext(ctx, `
		SELECT id, template_id, day_number, label
		FROM template_days
		WHERE template_id = $1
		ORDER BY day_number`, templateID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var days []TemplateDay
	for rows.Next() {
		var day TemplateDay
		err := rows.Scan(&day.ID, &day.TemplateID, &day.DayNumber, &day.Label)
		if err != nil {
			return nil, err
		}
		day.Exercises = []TemplateExercise{}
		days = append(days, day)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}

	for i := range days {
		exRows, err := m.DB.QueryContext(ctx, `
			SELECT tde.id, tde.template_day_id, tde.exercise_id, e.name, tde.position,
			       tde.target_sets, tde.target_rep_range_low, tde.target_rep_range_high, tde.target_rir
			FROM template_day_exercises tde
			JOIN exercises e ON tde.exercise_id = e.id
			WHERE tde.template_day_id = $1
			ORDER BY tde.position`, days[i].ID)
		if err != nil {
			return nil, err
		}
		for exRows.Next() {
			var ex TemplateExercise
			err := exRows.Scan(&ex.ID, &ex.TemplateDayID, &ex.ExerciseID, &ex.ExerciseName, &ex.Position,
				&ex.TargetSets, &ex.TargetRepRangeLow, &ex.TargetRepRangeHigh, &ex.TargetRIR)
			if err != nil {
				exRows.Close()
				return nil, err
			}
			days[i].Exercises = append(days[i].Exercises, ex)
		}
		if err = exRows.Err(); err != nil {
			exRows.Close()
			return nil, err
		}
		exRows.Close()
	}

	return days, nil
}

func (m TemplateModel) Delete(id int64) error {
	query := `DELETE FROM program_templates WHERE id = $1`

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

// Start clones a template into a brand-new mesocycle owned by userID —
// mesocycle, training days, and day exercises in one transaction.
func (m TemplateModel) Start(templateID, userID int64) (*Mesocycle, []TrainingDay, error) {
	t, err := m.Get(templateID)
	if err != nil {
		return nil, nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	tx, err := m.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, nil, err
	}
	defer tx.Rollback()

	meso := &Mesocycle{
		UserID:      userID,
		Name:        t.Name,
		DaysPerWeek: t.DaysPerWeek,
	}
	err = tx.QueryRowContext(ctx, `
		INSERT INTO mesocycles (user_id, name, days_per_week)
		VALUES ($1, $2, $3)
		RETURNING id, started_at, created_at, version`,
		meso.UserID, meso.Name, meso.DaysPerWeek,
	).Scan(&meso.ID, &meso.StartedAt, &meso.CreatedAt, &meso.Version)
	if err != nil {
		return nil, nil, err
	}

	dayQuery := `
		INSERT INTO training_days (mesocycle_id, day_number, label)
		VALUES ($1, $2, $3)
		RETURNING id, created_at, version`
	exQuery := `
		INSERT INTO training_day_exercises
			(training_day_id, exercise_id, position, target_sets, target_rep_range_low, target_rep_range_high, target_rir)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`

	days := make([]TrainingDay, len(t.Days))
	for i, tday := range t.Days {
		day := TrainingDay{
			MesocycleID: meso.ID,
			DayNumber:   tday.DayNumber,
			Label:       tday.Label,
		}
		err := tx.QueryRowContext(ctx, dayQuery, meso.ID, day.DayNumber, day.Label).Scan(
			&day.ID, &day.CreatedAt, &day.Version,
		)
		if err != nil {
			return nil, nil, err
		}

		for _, tex := range tday.Exercises {
			_, err := tx.ExecContext(ctx, exQuery,
				day.ID, tex.ExerciseID, tex.Position, tex.TargetSets,
				tex.TargetRepRangeLow, tex.TargetRepRangeHigh, tex.TargetRIR,
			)
			if err != nil {
				return nil, nil, err
			}
			day.Exercises = append(day.Exercises, TrainingExercise{
				TrainingDayID:      day.ID,
				ExerciseID:         tex.ExerciseID,
				ExerciseName:       tex.ExerciseName,
				Position:           tex.Position,
				TargetSets:         tex.TargetSets,
				TargetRepRangeLow:  tex.TargetRepRangeLow,
				TargetRepRangeHigh: tex.TargetRepRangeHigh,
				TargetRIR:          tex.TargetRIR,
			})
		}
		days[i] = day
	}

	return meso, days, tx.Commit()
}
