package main

import (
	"errors"
	"net/http"

	"workouttracker.jcroyoaun.io/internal/data"
	"workouttracker.jcroyoaun.io/internal/validator"
)

type templateInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	DaysPerWeek int    `json:"days_per_week"`
	Days        []struct {
		DayNumber int    `json:"day_number"`
		Label     string `json:"label"`
		Exercises []struct {
			ExerciseID         int64 `json:"exercise_id"`
			Position           int   `json:"position"`
			TargetSets         int   `json:"target_sets"`
			TargetRepRangeLow  int   `json:"target_rep_range_low"`
			TargetRepRangeHigh int   `json:"target_rep_range_high"`
			TargetRIR          int   `json:"target_rir"`
		} `json:"exercises"`
	} `json:"days"`
}

func (in *templateInput) toTemplate() *data.ProgramTemplate {
	t := &data.ProgramTemplate{
		Name:        in.Name,
		Description: in.Description,
		DaysPerWeek: in.DaysPerWeek,
	}
	for _, d := range in.Days {
		day := data.TemplateDay{
			DayNumber: d.DayNumber,
			Label:     d.Label,
			Exercises: []data.TemplateExercise{},
		}
		for i, ex := range d.Exercises {
			te := data.TemplateExercise{
				ExerciseID:         ex.ExerciseID,
				Position:           ex.Position,
				TargetSets:         ex.TargetSets,
				TargetRepRangeLow:  ex.TargetRepRangeLow,
				TargetRepRangeHigh: ex.TargetRepRangeHigh,
				TargetRIR:          ex.TargetRIR,
			}
			if te.Position == 0 {
				te.Position = i + 1
			}
			te.ApplyTargetDefaults()
			day.Exercises = append(day.Exercises, te)
		}
		t.Days = append(t.Days, day)
	}
	return t
}

func (app *application) listTemplatesHandler(w http.ResponseWriter, r *http.Request) {
	templates, err := app.models.Templates.GetAll()
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"templates": templates}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) getTemplateHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	template, err := app.models.Templates.Get(id)
	if err != nil {
		if errors.Is(err, data.ErrRecordNotFound) {
			app.notFoundResponse(w, r)
			return
		}
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"template": template}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) createTemplateHandler(w http.ResponseWriter, r *http.Request) {
	var input templateInput

	err := app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	template := input.toTemplate()

	v := validator.New()
	if data.ValidateProgramTemplate(v, template); !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	err = app.models.Templates.Insert(template, app.contextGetUserID(r))
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	// Reload so exercise names come back JOIN-resolved.
	template, err = app.models.Templates.Get(template.ID)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusCreated, envelope{"template": template}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) updateTemplateHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	var input templateInput

	err = app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	template := input.toTemplate()
	template.ID = id

	v := validator.New()
	if data.ValidateProgramTemplate(v, template); !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	err = app.models.Templates.Update(template)
	if err != nil {
		if errors.Is(err, data.ErrRecordNotFound) {
			app.notFoundResponse(w, r)
			return
		}
		app.serverErrorResponse(w, r, err)
		return
	}

	template, err = app.models.Templates.Get(template.ID)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"template": template}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) deleteTemplateHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	err = app.models.Templates.Delete(id)
	if err != nil {
		if errors.Is(err, data.ErrRecordNotFound) {
			app.notFoundResponse(w, r)
			return
		}
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"message": "template deleted"}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

// startTemplateHandler clones a template into a new mesocycle owned by the
// caller — same response shape as createMesocycleHandler so the webapp can
// treat both paths identically.
func (app *application) startTemplateHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	userID := app.contextGetUserID(r)

	meso, days, err := app.models.Templates.Start(id, userID)
	if err != nil {
		if errors.Is(err, data.ErrRecordNotFound) {
			app.notFoundResponse(w, r)
			return
		}
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusCreated, envelope{
		"mesocycle": meso,
		"days":      days,
	}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
