package main

import (
	"errors"
	"fmt"
	"net/http"

	"exerciselib.jcroyoaun.io/internal/data"
	"exerciselib.jcroyoaun.io/internal/validator"
)

// Add a createMovementPatternHandler for the "POST /v1/movement-patterns" endpoint.
func (app *application) createMovementPatternHandler(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}

	err := app.readJSON(w, r, &input)

	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	pattern := &data.MovementPattern{
		Name:        input.Name,
		Description: input.Description,
	}

	v := validator.New()

	if data.ValidateMovementPattern(v, pattern); !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	err = app.models.MovementPatterns.Insert(pattern)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	headers := make(http.Header)
	headers.Set("Location", fmt.Sprintf("/v1/movement-patterns/%d", pattern.ID))

	err = app.writeJSON(w, http.StatusCreated, envelope{"movement_pattern": pattern}, headers)

	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

// Add a showMovementPatternHandler for the "GET /v1/movement-patterns/:id" endpoint.
func (app *application) showMovementPatternHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)

	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	pattern, err := app.models.MovementPatterns.Get(id)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrRecordNotFound):
			app.notFoundResponse(w, r)
		default:
			app.serverErrorResponse(w, r, err)
		}
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"movement_pattern": pattern}, nil)

	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) showMovementPatternsHandler(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Name string
		data.Filters
	}

	v := validator.New()

	qs := r.URL.Query()

	input.Name = app.readString(qs, "name", "")

	input.Filters.Page = app.readInt(qs, "page", 1, v)
	input.Filters.PageSize = app.readInt(qs, "page_size", 20, v)

	input.Filters.Sort = app.readString(qs, "sort", "name")
	input.Filters.SortSafelist = []string{"id", "name", "-id", "-name"}

	if data.ValidateFilters(v, input.Filters); !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	patterns, metadata, err := app.models.MovementPatterns.GetAll(input.Name, input.Filters)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"movement_patterns": patterns, "metadata": metadata}, nil)

	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) updateMovementPatternHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	pattern, err := app.models.MovementPatterns.Get(id)
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
		Name        *string `json:"name"`
		Description *string `json:"description"`
	}

	err = app.readJSON(w, r, &input)

	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if input.Name != nil {
		pattern.Name = *input.Name
	}

	if input.Description != nil {
		pattern.Description = *input.Description
	}

	v := validator.New()

	if data.ValidateMovementPattern(v, pattern); !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	err = app.models.MovementPatterns.Update(pattern)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrEditConflict):
			app.editConflictResponse(w, r)
		default:
			app.serverErrorResponse(w, r, err)
		}
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"movement_pattern": pattern}, nil)

	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) deleteMovementPatternHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	err = app.models.MovementPatterns.Delete(id)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrRecordNotFound):
			app.notFoundResponse(w, r)
		default:
			app.serverErrorResponse(w, r, err)
		}
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"message": "movement pattern successfully deleted"}, nil)

	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
