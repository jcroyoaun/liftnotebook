package main

import (
	"errors"
	"net/http"
	"time"

	"workouttracker.jcroyoaun.io/internal/data"
)

// exportMesocycleHandler dumps a whole training block — structure (days +
// exercise targets) and history (sessions with every set) — as one JSON
// document. The webapp derives CSV variants from it client-side; the JSON
// itself is the canonical takeout format.
func (app *application) exportMesocycleHandler(w http.ResponseWriter, r *http.Request) {
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

	sessions, err := app.models.WorkoutSessions.ListForMesocycle(userID, meso.ID)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	sets, err := app.models.WorkoutSets.GetForMesocycle(userID, meso.ID)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	notes, err := app.models.ExerciseNotes.GetForMesocycle(userID, meso.ID)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	setsBySession := make(map[int64][]data.WorkoutSet)
	for _, s := range sets {
		setsBySession[s.WorkoutSessionID] = append(setsBySession[s.WorkoutSessionID], s)
	}

	notesBySession := make(map[int64][]data.ExerciseNote)
	for _, n := range notes {
		notesBySession[n.WorkoutSessionID] = append(notesBySession[n.WorkoutSessionID], n)
	}

	type sessionExport struct {
		*data.WorkoutSession
		Sets          []data.WorkoutSet   `json:"sets"`
		ExerciseNotes []data.ExerciseNote `json:"exercise_notes"`
	}
	sessionExports := make([]sessionExport, 0, len(sessions))
	for _, sess := range sessions {
		exp := sessionExport{
			WorkoutSession: sess,
			Sets:           setsBySession[sess.ID],
			ExerciseNotes:  notesBySession[sess.ID],
		}
		if exp.Sets == nil {
			exp.Sets = []data.WorkoutSet{}
		}
		if exp.ExerciseNotes == nil {
			exp.ExerciseNotes = []data.ExerciseNote{}
		}
		sessionExports = append(sessionExports, exp)
	}

	err = app.writeJSON(w, http.StatusOK, envelope{
		"format":      "liftnotebook/block-export/v1",
		"exported_at": time.Now().UTC(),
		"mesocycle":   meso,
		"days":        days,
		"sessions":    sessionExports,
	}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
