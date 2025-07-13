package main

import (
	"errors"
	"fmt"
	"net/http"

	"exerciselib.jcroyoaun.io/internal/data"
	"exerciselib.jcroyoaun.io/internal/validator"
)

func (app *application) createMuscleHandler(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Name     string        `json:"name"`
		BodyPart data.BodyPart `json:"body_part"`
	}

	err := app.readJSON(w, r, &input)

	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	muscle := &data.Muscle{
		Name:     input.Name,
		BodyPart: string(input.BodyPart),
	}

	v := validator.New()

	if data.ValidateMuscle(v, muscle); !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	err = app.models.Muscles.Insert(muscle)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	headers := make(http.Header)
	headers.Set("Location", fmt.Sprintf("/v1/muscles/%d", muscle.ID))

	err = app.writeJSON(w, http.StatusCreated, envelope{"muscle": muscle}, headers)

	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) showMuscleHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)

	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	muscle, err := app.models.Muscles.Get(id)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrRecordNotFound):
			app.notFoundResponse(w, r)
		default:
			app.serverErrorResponse(w, r, err)
		}
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"muscle": muscle}, nil)

	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) updateMuscleHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	muscle, err := app.models.Muscles.Get(id)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrRecordNotFound):
			app.notFoundResponse(w, r)
		default:
			app.serverErrorResponse(w, r, err)
		}
		return
	}

	var input struct {
		Name     *string        `json:"name"`
		BodyPart *data.BodyPart `json:"body_part"`
	}

	err = app.readJSON(w, r, &input)

	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if input.Name != nil {
		muscle.Name = *input.Name
	}

	if input.BodyPart != nil {
		muscle.BodyPart = string(*input.BodyPart)
	}

	v := validator.New()

	if data.ValidateMuscle(v, muscle); !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	err = app.models.Muscles.Update(muscle)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrEditConflict):
			app.editConflictResponse(w, r)
		default:
			app.serverErrorResponse(w, r, err)
		}
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"muscle": muscle}, nil)

	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) deleteMuscleHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	err = app.models.Muscles.Delete(id)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrRecordNotFound):
			app.notFoundResponse(w, r)
		default:
			app.serverErrorResponse(w, r, err)
		}
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"message": "muscle successfully deleted"}, nil)

	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) listMusclesHandler(w http.ResponseWriter, r *http.Request) {
	var input struct {
		BodyPart data.BodyPart
		data.Filters
	}

	v := validator.New()

	qs := r.URL.Query()

	input.BodyPart = data.BodyPart(app.readString(qs, "body_part", ""))

	input.Filters.Page = app.readInt(qs, "page", 1, v)
	input.Filters.PageSize = app.readInt(qs, "page_size", 20, v)

	input.Filters.Sort = app.readString(qs, "sort", "body_part")
	input.Filters.SortSafelist = []string{"id", "name", "body_part", "-id", "-name", "-body_part"}

	if data.ValidateFilters(v, input.Filters); !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	muscles, metadata, err := app.models.Muscles.GetAll(input.BodyPart, input.Filters)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"muscles": muscles, "metadata": metadata}, nil)

	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
