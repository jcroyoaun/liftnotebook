package main

import (
	"errors"
	"net/http"
	"strconv"

	"workouttracker.jcroyoaun.io/internal/data"
)

var errMissingExerciseID = errors.New("exercise_id query parameter is required")

func (app *application) getE1RMProgressHandler(w http.ResponseWriter, r *http.Request) {
	userID := app.contextGetUserID(r)

	exerciseIDStr := r.URL.Query().Get("exercise_id")
	if exerciseIDStr == "" {
		app.badRequestResponse(w, r, errMissingExerciseID)
		return
	}

	exerciseID, err := strconv.ParseInt(exerciseIDStr, 10, 64)
	if err != nil || exerciseID < 1 {
		app.badRequestResponse(w, r, errMissingExerciseID)
		return
	}

	points, err := app.models.Progress.GetE1RMHistory(userID, exerciseID)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"progress": points}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) getMesocycleVolumeHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	userID := app.contextGetUserID(r)

	volume, err := app.models.Volume.GetMesocycleVolume(userID, id)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"volume": volume}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) getWeeklyVolumeHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	userID := app.contextGetUserID(r)

	volume, err := app.models.Volume.GetWeeklyVolume(userID, id)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"weekly_volume": volume}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) previewVolumeHandler(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Exercises []data.ExerciseSetsInput `json:"exercises"`
	}

	err := app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	volume, err := app.models.Volume.PreviewVolume(input.Exercises)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"volume": volume}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) listUserExercisesHandler(w http.ResponseWriter, r *http.Request) {
	userID := app.contextGetUserID(r)

	exercises, err := app.models.Exercises.GetUserExercises(userID)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"exercises": exercises}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) listExercisesHandler(w http.ResponseWriter, r *http.Request) {
	exercises, err := app.models.Exercises.GetAll()
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"exercises": exercises}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) getExerciseHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	exercise, err := app.models.Exercises.Get(id)
	if err != nil {
		if errors.Is(err, data.ErrRecordNotFound) {
			app.notFoundResponse(w, r)
			return
		}
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"exercise": exercise}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) trainingDayExercisesHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	userID := app.contextGetUserID(r)

	var input struct {
		Exercises []struct {
			ExerciseID int64 `json:"exercise_id"`
			Position   int   `json:"position"`
			TargetSets int   `json:"target_sets"`
		} `json:"exercises"`
	}

	err = app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	var exercises []data.TrainingExercise
	for _, e := range input.Exercises {
		exercises = append(exercises, data.TrainingExercise{
			ExerciseID: e.ExerciseID,
			Position:   e.Position,
			TargetSets: e.TargetSets,
		})
	}

	err = app.models.TrainingDays.UpdateExercisesForUser(id, userID, exercises)
	if err != nil {
		if errors.Is(err, data.ErrRecordNotFound) {
			app.notFoundResponse(w, r)
			return
		}
		app.serverErrorResponse(w, r, err)
		return
	}

	day, err := app.models.TrainingDays.Get(id)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"training_day": day}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
