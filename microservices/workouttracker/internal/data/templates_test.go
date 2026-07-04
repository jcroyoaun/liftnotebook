package data

import (
	"database/sql/driver"
	"testing"
	"time"

	"workouttracker.jcroyoaun.io/internal/validator"
)

func TestValidateProgramTemplateRejectsDayCountMismatch(t *testing.T) {
	v := validator.New()
	template := &ProgramTemplate{
		Name:        "PPL",
		DaysPerWeek: 3,
		Days: []TemplateDay{
			{DayNumber: 1, Label: "Push"},
		},
	}

	ValidateProgramTemplate(v, template)

	if v.Valid() {
		t.Fatal("expected validation to fail for mismatched day count")
	}
	if _, ok := v.Errors["days"]; !ok {
		t.Errorf("expected error on days, got %v", v.Errors)
	}
}

func TestValidateProgramTemplateRejectsDuplicateDayNumbers(t *testing.T) {
	v := validator.New()
	template := &ProgramTemplate{
		Name:        "UL",
		DaysPerWeek: 2,
		Days: []TemplateDay{
			{DayNumber: 1, Label: "Upper"},
			{DayNumber: 1, Label: "Lower"},
		},
	}

	ValidateProgramTemplate(v, template)

	if v.Valid() {
		t.Fatal("expected validation to fail for duplicate day numbers")
	}
}

func TestTemplateModelInsertCreatesNestedRows(t *testing.T) {
	now := time.Now()

	db, stub := newStubDB(t,
		stubExpectation{op: "begin"},
		stubExpectation{
			op:          "query",
			sqlContains: "INSERT INTO program_templates (name, description, days_per_week, created_by)",
			args:        []driver.Value{"Push Pull", "House style", int64(2), int64(1)},
			rows: &stubRows{
				columns: []string{"id", "created_at", "version"},
				values:  [][]driver.Value{{int64(9), now, int64(1)}},
			},
		},
		stubExpectation{
			op:          "query",
			sqlContains: "INSERT INTO template_days (template_id, day_number, label)",
			args:        []driver.Value{int64(9), int64(1), "Push"},
			rows: &stubRows{
				columns: []string{"id"},
				values:  [][]driver.Value{{int64(91)}},
			},
		},
		stubExpectation{
			op:          "query",
			sqlContains: "INSERT INTO template_day_exercises",
			args:        []driver.Value{int64(91), int64(11), int64(1), int64(2), int64(8), int64(12), int64(0)},
			rows: &stubRows{
				columns: []string{"id"},
				values:  [][]driver.Value{{int64(911)}},
			},
		},
		stubExpectation{
			op:          "query",
			sqlContains: "INSERT INTO template_days (template_id, day_number, label)",
			args:        []driver.Value{int64(9), int64(2), "Pull"},
			rows: &stubRows{
				columns: []string{"id"},
				values:  [][]driver.Value{{int64(92)}},
			},
		},
		stubExpectation{op: "commit"},
	)

	model := TemplateModel{DB: db}
	template := &ProgramTemplate{
		Name:        "Push Pull",
		Description: "House style",
		DaysPerWeek: 2,
		Days: []TemplateDay{
			{
				DayNumber: 1,
				Label:     "Push",
				Exercises: []TemplateExercise{
					{ExerciseID: 11, Position: 1, TargetSets: 2, TargetRepRangeLow: 8, TargetRepRangeHigh: 12, TargetRIR: 0},
				},
			},
			{DayNumber: 2, Label: "Pull"},
		},
	}

	if err := model.Insert(template, 1); err != nil {
		t.Fatalf("Insert: %v", err)
	}
	if template.ID != 9 {
		t.Errorf("template ID = %d, want 9", template.ID)
	}
	if template.Days[0].ID != 91 || template.Days[0].Exercises[0].ID != 911 {
		t.Errorf("nested IDs not populated: %+v", template.Days)
	}

	stub.assertExhausted(t)
}

func TestTemplateModelStartClonesTemplateIntoMesocycle(t *testing.T) {
	now := time.Now()

	db, stub := newStubDB(t,
		// Get(templateID)
		stubExpectation{
			op:          "query",
			sqlContains: "FROM program_templates WHERE id = $1",
			args:        []driver.Value{int64(5)},
			rows: &stubRows{
				columns: []string{"id", "created_at", "name", "description", "days_per_week", "version"},
				values:  [][]driver.Value{{int64(5), now, "PPL", "", int64(1), int64(1)}},
			},
		},
		stubExpectation{
			op:          "query",
			sqlContains: "FROM template_days WHERE template_id = $1",
			args:        []driver.Value{int64(5)},
			rows: &stubRows{
				columns: []string{"id", "template_id", "day_number", "label"},
				values:  [][]driver.Value{{int64(51), int64(5), int64(1), "Push"}},
			},
		},
		stubExpectation{
			op:          "query",
			sqlContains: "FROM template_day_exercises tde JOIN exercises e",
			args:        []driver.Value{int64(51)},
			rows: &stubRows{
				columns: []string{"id", "template_day_id", "exercise_id", "name", "position", "target_sets", "target_rep_range_low", "target_rep_range_high", "target_rir"},
				values:  [][]driver.Value{{int64(511), int64(51), int64(11), "Flat Barbell Bench Press", int64(1), int64(2), int64(8), int64(12), int64(0)}},
			},
		},
		// Clone into the user's own mesocycle
		stubExpectation{op: "begin"},
		stubExpectation{
			op:          "query",
			sqlContains: "INSERT INTO mesocycles (user_id, name, days_per_week)",
			args:        []driver.Value{int64(42), "PPL", int64(1)},
			rows: &stubRows{
				columns: []string{"id", "started_at", "created_at", "version"},
				values:  [][]driver.Value{{int64(100), now, now, int64(1)}},
			},
		},
		stubExpectation{
			op:          "query",
			sqlContains: "INSERT INTO training_days (mesocycle_id, day_number, label)",
			args:        []driver.Value{int64(100), int64(1), "Push"},
			rows: &stubRows{
				columns: []string{"id", "created_at", "version"},
				values:  [][]driver.Value{{int64(1000), now, int64(1)}},
			},
		},
		stubExpectation{
			op:          "exec",
			sqlContains: "INSERT INTO training_day_exercises",
			args:        []driver.Value{int64(1000), int64(11), int64(1), int64(2), int64(8), int64(12), int64(0)},
			result:      driver.RowsAffected(1),
		},
		stubExpectation{op: "commit"},
	)

	model := TemplateModel{DB: db}

	meso, days, err := model.Start(5, 42)
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	if meso.ID != 100 || meso.UserID != 42 || meso.Name != "PPL" {
		t.Errorf("unexpected mesocycle %+v", meso)
	}
	if len(days) != 1 || days[0].ID != 1000 {
		t.Fatalf("unexpected days %+v", days)
	}
	if len(days[0].Exercises) != 1 || days[0].Exercises[0].ExerciseName != "Flat Barbell Bench Press" {
		t.Errorf("unexpected day exercises %+v", days[0].Exercises)
	}

	stub.assertExhausted(t)
}
