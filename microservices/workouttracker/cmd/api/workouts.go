package main

import (
	"errors"
	"net/http"
	"strconv"
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

	notes, err := app.models.ExerciseNotes.GetForSession(session.ID)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	if notes == nil {
		notes = []data.ExerciseNote{}
	}

	err = app.writeJSON(w, http.StatusOK, envelope{
		"session":        session,
		"sets":           sets,
		"exercise_notes": notes,
	}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

// upsertExerciseNoteHandler writes the per-(session, exercise) note — the
// "Panatta taken, used Lifefitness at 45 kg" record. An empty note clears it.
func (app *application) upsertExerciseNoteHandler(w http.ResponseWriter, r *http.Request) {
	sessionID, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	exerciseID, err := app.readNamedIDParam(r, "exercise_id")
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	var input struct {
		Note string `json:"note"`
	}

	err = app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	v := validator.New()
	v.Check(len(input.Note) <= 2000, "note", "must not be more than 2000 characters")
	if !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	userID := app.contextGetUserID(r)

	note := &data.ExerciseNote{
		WorkoutSessionID: sessionID,
		ExerciseID:       exerciseID,
		Note:             input.Note,
	}

	err = app.models.ExerciseNotes.UpsertForUser(note, userID)
	if err != nil {
		if errors.Is(err, data.ErrRecordNotFound) {
			app.notFoundResponse(w, r)
			return
		}
		app.serverErrorResponse(w, r, err)
		return
	}

	if note.Note == "" {
		err = app.writeJSON(w, http.StatusOK, envelope{"message": "note cleared"}, nil)
	} else {
		err = app.writeJSON(w, http.StatusOK, envelope{"note": note}, nil)
	}
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

// listMySessionsHandler is the cross-block workout history: every session
// the user has logged, newest first, paginated.
func (app *application) listMySessionsHandler(w http.ResponseWriter, r *http.Request) {
	qs := r.URL.Query()

	v := validator.New()

	page := 1
	if s := qs.Get("page"); s != "" {
		n, err := strconv.Atoi(s)
		if err != nil {
			v.AddError("page", "must be an integer")
		} else {
			page = n
		}
	}

	pageSize := 20
	if s := qs.Get("page_size"); s != "" {
		n, err := strconv.Atoi(s)
		if err != nil {
			v.AddError("page_size", "must be an integer")
		} else {
			pageSize = n
		}
	}

	v.Check(page >= 1, "page", "must be at least 1")
	v.Check(pageSize >= 1, "page_size", "must be at least 1")
	v.Check(pageSize <= 50, "page_size", "must not be more than 50")
	if !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	userID := app.contextGetUserID(r)

	sessions, total, err := app.models.WorkoutSessions.ListForUser(userID, page, pageSize)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	if sessions == nil {
		sessions = []data.SessionSummary{}
	}

	err = app.writeJSON(w, http.StatusOK, envelope{
		"sessions": sessions,
		"metadata": envelope{
			"page":      page,
			"page_size": pageSize,
			"total":     total,
		},
	}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

// updateWorkoutSessionHandler is the edit-past-workout escape hatch: date and
// notes only. Set edits go through the set endpoints via /workout/:id.
func (app *application) updateWorkoutSessionHandler(w http.ResponseWriter, r *http.Request) {
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

	var input struct {
		PerformedAt *string `json:"performed_at"`
		Notes       *string `json:"notes"`
	}

	err = app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if input.PerformedAt != nil {
		performedAt, err := time.Parse(time.RFC3339, *input.PerformedAt)
		if err != nil {
			v := validator.New()
			v.AddError("performed_at", "must be a valid RFC3339 timestamp")
			app.failedValidationResponse(w, r, v.Errors)
			return
		}
		session.PerformedAt = performedAt
	}
	if input.Notes != nil {
		v := validator.New()
		v.Check(len(*input.Notes) <= 2000, "notes", "must not be more than 2000 characters")
		if !v.Valid() {
			app.failedValidationResponse(w, r, v.Errors)
			return
		}
		if *input.Notes == "" {
			session.Notes = nil
		} else {
			session.Notes = input.Notes
		}
	}

	err = app.models.WorkoutSessions.Update(session)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrEditConflict):
			app.errorResponse(w, r, http.StatusConflict, "unable to update the record, please try again")
		default:
			app.serverErrorResponse(w, r, err)
		}
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"session": session}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

// deleteWorkoutSessionHandler cleans up sessions — the logger uses it to
// discard abandoned empty workouts (Start Workout creates the row up front).
func (app *application) deleteWorkoutSessionHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	userID := app.contextGetUserID(r)

	err = app.models.WorkoutSessions.Delete(id, userID)
	if err != nil {
		if errors.Is(err, data.ErrRecordNotFound) {
			app.notFoundResponse(w, r)
			return
		}
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"message": "session deleted"}, nil)
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
		WorkoutSessionID int64    `json:"workout_session_id"`
		ExerciseID       int64    `json:"exercise_id"`
		SetNumber        int      `json:"set_number"`
		Weight           float64  `json:"weight"`
		WeightLeft       *float64 `json:"weight_left"`
		WeightRight      *float64 `json:"weight_right"`
		Reps             int      `json:"reps"`
		RIR              *int     `json:"rir"`
		Recorded         bool     `json:"recorded"`
		ClientID         *string  `json:"client_id"`
		// RestEndsAt lets offline-replayed set logs carry their rest alarm:
		// the alarm is scheduled server-side on the write path, so it rides
		// the idempotent offline queue instead of a separate lossy call.
		RestEndsAt *string `json:"rest_ends_at"`
	}

	err := app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	// Per-limb weights are canonicalised server-side: the weak limb governs
	// double progression and e1RM, so weight = MIN(left, right) always.
	if input.WeightLeft != nil && input.WeightRight != nil {
		input.Weight = min(*input.WeightLeft, *input.WeightRight)
	}

	set := &data.WorkoutSet{
		WorkoutSessionID: input.WorkoutSessionID,
		ExerciseID:       input.ExerciseID,
		SetNumber:        input.SetNumber,
		Weight:           input.Weight,
		WeightLeft:       input.WeightLeft,
		WeightRight:      input.WeightRight,
		Reps:             input.Reps,
		RIR:              input.RIR,
		Recorded:         input.Recorded,
		ClientID:         input.ClientID,
	}

	v := validator.New()
	v.Check(set.WorkoutSessionID > 0, "workout_session_id", "must be a positive integer")
	data.ValidateWorkoutSet(v, set)

	var restEndsAt time.Time
	if input.RestEndsAt != nil {
		restEndsAt, err = time.Parse(time.RFC3339, *input.RestEndsAt)
		if err != nil {
			v.AddError("rest_ends_at", "must be a valid RFC3339 timestamp")
		}
	}

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

	// Best-effort: arm the rest alarm from the write path. Never affects the
	// set-logging response.
	if set.Recorded && !restEndsAt.IsZero() {
		app.maybeScheduleRestAlarmAt(userID, restEndsAt)
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
		Weight      float64  `json:"weight"`
		WeightLeft  *float64 `json:"weight_left"`
		WeightRight *float64 `json:"weight_right"`
		Reps        int      `json:"reps"`
		RIR         *int     `json:"rir"`
		Recorded    *bool    `json:"recorded"`
	}

	err = app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	v := validator.New()
	v.Check((input.WeightLeft == nil) == (input.WeightRight == nil), "weight_left", "must be provided together with weight_right")
	if input.WeightLeft != nil {
		v.Check(*input.WeightLeft >= 0, "weight_left", "must be zero or positive")
	}
	if input.WeightRight != nil {
		v.Check(*input.WeightRight >= 0, "weight_right", "must be zero or positive")
	}
	if !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	// Canonical rule: the weak limb governs progression and e1RM.
	if input.WeightLeft != nil && input.WeightRight != nil {
		input.Weight = min(*input.WeightLeft, *input.WeightRight)
	}

	recorded := false
	if input.Recorded != nil {
		recorded = *input.Recorded
	}

	set := &data.WorkoutSet{
		ID:          id,
		Weight:      input.Weight,
		WeightLeft:  input.WeightLeft,
		WeightRight: input.WeightRight,
		Reps:        input.Reps,
		RIR:         input.RIR,
		Recorded:    recorded,
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
