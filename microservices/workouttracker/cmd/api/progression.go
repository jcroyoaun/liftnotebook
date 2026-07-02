package main

import (
	"errors"
	"net/http"

	"workouttracker.jcroyoaun.io/internal/data"
)

func (app *application) getTrainingDaySuggestionsHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	userID := app.contextGetUserID(r)

	suggestions, err := app.models.Progression.GetSuggestionsForTrainingDay(userID, id)
	if err != nil {
		if errors.Is(err, data.ErrRecordNotFound) {
			app.notFoundResponse(w, r)
			return
		}
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"suggestions": suggestions}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
