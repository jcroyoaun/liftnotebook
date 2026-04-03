package main

import (
	"errors"
	"net/http"
	"time"

	"workouttracker.jcroyoaun.io/internal/data"
	"workouttracker.jcroyoaun.io/internal/validator"
)

func (app *application) createWorkoutSessionHandler(w http.ResponseWriter, r *http.Request) {
	var input struct {
		MesocycleID   int64  `json:"mesocycle_id"`
		TrainingDayID int64  `json:"training_day_id"`
		PerformedAt   string `json:"performed_at,omitempty"`
		Notes         string `json:"notes,omitempty"`
	}

	err := app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	userID := app.contextGetUserID(r)

	v := validator.New()
	v.Check(input.MesocycleID > 0, "mesocycle_id", "must be a positive integer")
	v.Check(input.TrainingDayID > 0, "training_day_id", "must be a positive integer")
	if !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	var performedAt time.Time
	if input.PerformedAt != "" {
		performedAt, err = time.Parse(time.RFC3339, input.PerformedAt)
		if err != nil {
			v.AddError("performed_at", "must be a valid RFC3339 timestamp")
			app.failedValidationResponse(w, r, v.Errors)
			return
		}
	} else {
		performedAt = time.Now()
	}

	var notes *string
	if input.Notes != "" {
		notes = &input.Notes
	}

	session := &data.WorkoutSession{
		UserID:        userID,
		MesocycleID:   input.MesocycleID,
		TrainingDayID: input.TrainingDayID,
		PerformedAt:   performedAt,
		Notes:         notes,
	}

	err = app.models.WorkoutSessions.Insert(session)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusCreated, envelope{"session": session}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) getWorkoutSessionHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	userID := app.contextGetUserID(r)

	session, err := app.models.WorkoutSessions.Get(id, userID)
	if err != nil {
		if errors.Is(err, data.ErrRecordNotFound) {
			app.notFoundResponse(w, r)
			return
		}
		app.serverErrorResponse(w, r, err)
		return
	}

	sets, err := app.models.WorkoutSets.GetForSession(session.ID)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{
		"session": session,
		"sets":    sets,
	}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) listWorkoutSessionsHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	userID := app.contextGetUserID(r)

	sessions, err := app.models.WorkoutSessions.ListForMesocycle(userID, id)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"sessions": sessions}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) logSetHandler(w http.ResponseWriter, r *http.Request) {
	var input struct {
		WorkoutSessionID int64   `json:"workout_session_id"`
		ExerciseID       int64   `json:"exercise_id"`
		SetNumber        int     `json:"set_number"`
		Weight           float64 `json:"weight"`
		Reps             int     `json:"reps"`
		RIR              *int    `json:"rir"`
	}

	err := app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	set := &data.WorkoutSet{
		WorkoutSessionID: input.WorkoutSessionID,
		ExerciseID:       input.ExerciseID,
		SetNumber:        input.SetNumber,
		Weight:           input.Weight,
		Reps:             input.Reps,
		RIR:              input.RIR,
	}

	v := validator.New()
	v.Check(set.WorkoutSessionID > 0, "workout_session_id", "must be a positive integer")
	data.ValidateWorkoutSet(v, set)
	if !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	userID := app.contextGetUserID(r)

	err = app.models.WorkoutSets.InsertForUser(set, userID)
	if err != nil {
		if errors.Is(err, data.ErrRecordNotFound) {
			app.notFoundResponse(w, r)
			return
		}
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusCreated, envelope{"set": set}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) updateSetHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	var input struct {
		Weight   float64 `json:"weight"`
		Reps     int     `json:"reps"`
		RIR      *int    `json:"rir"`
		Recorded *bool   `json:"recorded"`
	}

	err = app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	recorded := false
	if input.Recorded != nil {
		recorded = *input.Recorded
	}

	set := &data.WorkoutSet{
		ID:       id,
		Weight:   input.Weight,
		Reps:     input.Reps,
		RIR:      input.RIR,
		Recorded: recorded,
	}

	userID := app.contextGetUserID(r)

	err = app.models.WorkoutSets.UpdateForUser(set, userID)
	if err != nil {
		if errors.Is(err, data.ErrRecordNotFound) {
			app.notFoundResponse(w, r)
			return
		}
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"set": set}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) deleteSetHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	userID := app.contextGetUserID(r)

	err = app.models.WorkoutSets.DeleteForUser(id, userID)
	if err != nil {
		if errors.Is(err, data.ErrRecordNotFound) {
			app.notFoundResponse(w, r)
			return
		}
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"message": "set deleted"}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
