package main

import (
	"errors"
	"net/http"

	"workouttracker.jcroyoaun.io/internal/data"
	"workouttracker.jcroyoaun.io/internal/validator"
)

func (app *application) createMesocycleHandler(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Name        string `json:"name"`
		DaysPerWeek int    `json:"days_per_week"`
		Days        []struct {
			DayNumber int    `json:"day_number"`
			Label     string `json:"label"`
		} `json:"days"`
	}

	err := app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	userID := app.contextGetUserID(r)

	meso := &data.Mesocycle{
		UserID:      userID,
		Name:        input.Name,
		DaysPerWeek: input.DaysPerWeek,
	}

	v := validator.New()
	data.ValidateMesocycle(v, meso)

	v.Check(len(input.Days) == input.DaysPerWeek, "days", "must provide labels for each training day")
	if !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	err = app.models.Mesocycles.Insert(meso)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	// Create training days
	days := make([]data.TrainingDay, len(input.Days))
	for i, d := range input.Days {
		days[i] = data.TrainingDay{
			DayNumber: d.DayNumber,
			Label:     d.Label,
		}
	}

	days, err = app.models.TrainingDays.InsertBatch(meso.ID, days)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusCreated, envelope{
		"mesocycle": meso,
		"days":     days,
	}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) getActiveMesocycleHandler(w http.ResponseWriter, r *http.Request) {
	userID := app.contextGetUserID(r)

	meso, err := app.models.Mesocycles.GetActive(userID)
	if err != nil {
		if errors.Is(err, data.ErrRecordNotFound) {
			err = app.writeJSON(w, http.StatusOK, envelope{"mesocycle": nil}, nil)
			if err != nil {
				app.serverErrorResponse(w, r, err)
			}
			return
		}
		app.serverErrorResponse(w, r, err)
		return
	}

	days, err := app.models.TrainingDays.GetForMesocycle(meso.ID)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{
		"mesocycle": meso,
		"days":     days,
	}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) getMesocycleHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	userID := app.contextGetUserID(r)

	meso, err := app.models.Mesocycles.Get(id, userID)
	if err != nil {
		if errors.Is(err, data.ErrRecordNotFound) {
			app.notFoundResponse(w, r)
			return
		}
		app.serverErrorResponse(w, r, err)
		return
	}

	days, err := app.models.TrainingDays.GetForMesocycle(meso.ID)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{
		"mesocycle": meso,
		"days":     days,
	}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) listMesocyclesHandler(w http.ResponseWriter, r *http.Request) {
	userID := app.contextGetUserID(r)

	mesocycles, err := app.models.Mesocycles.ListForUser(userID)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"mesocycles": mesocycles}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) deleteMesocycleHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	userID := app.contextGetUserID(r)

	err = app.models.Mesocycles.Delete(id, userID)
	if err != nil {
		if errors.Is(err, data.ErrRecordNotFound) {
			app.notFoundResponse(w, r)
			return
		}
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"message": "mesocycle deleted"}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) endMesocycleHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	userID := app.contextGetUserID(r)

	err = app.models.Mesocycles.End(id, userID)
	if err != nil {
		if errors.Is(err, data.ErrRecordNotFound) {
			app.notFoundResponse(w, r)
			return
		}
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"message": "mesocycle ended"}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
