package main

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"exerciselib.jcroyoaun.io/internal/data"
	"exerciselib.jcroyoaun.io/internal/validator"
)

// Add a createExerciseHandler for the "POST /v1/exercises" endpoint. For now we simply
// return a plain-text placeholder response.
func (app *application) createExerciseHandler(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Name              string            `json:"name"`
		Type              data.ExerciseType `json:"type"`
		MovementPatternID int64             `json:"movement_pattern_id"`
		PrimaryMuscles    []int64           `json:"primary_muscles"`
		SecondaryMuscles  []int64           `json:"secondary_muscles"`
	}

	err := app.readJSON(w, r, &input)

	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	exercise := &data.Exercise{
		Name:              input.Name,
		Type:              input.Type,
		MovementPatternID: input.MovementPatternID,
	}

	v := validator.New()

	if data.ValidateExercise(v, exercise); !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	err = app.models.Exercises.Insert(exercise)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	// Insert muscle relationships
	err = app.models.Exercises.InsertMuscles(exercise.ID, input.PrimaryMuscles, input.SecondaryMuscles)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	// Reload the exercise with its muscle relationships
	exercise, err = app.models.Exercises.Get(exercise.ID)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	headers := make(http.Header)
	headers.Set("Location", fmt.Sprintf("/v1/exercises/%d", exercise.ID))

	err = app.writeJSON(w, http.StatusCreated, envelope{"exercise": exercise}, headers)

	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

// Add a showExerciseHandler for the "GET /v1/exercises/:id" endpoint. For now, we retrieve
// the interpolated "id" parameter from the current URL and include it in a placeholder
// response.

func (app *application) showExerciseHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)

	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	exercise, err := app.models.Exercises.Get(id)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrRecordNotFound):
			app.notFoundResponse(w, r)
		default:
			app.serverErrorResponse(w, r, err)
		}
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"exercise": exercise}, nil)

	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) updateExerciseHandler(w http.ResponseWriter, r *http.Request) {
	// Extract the Exercise ID from the URL.
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	exercise, err := app.models.Exercises.Get(id)
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
		Name              *string            `json:"name"`
		Type              *data.ExerciseType `json:"type"`
		MovementPatternID *int64             `json:"movement_pattern_id"`
		PrimaryMuscles    []int64            `json:"primary_muscles"`
		SecondaryMuscles  []int64            `json:"secondary_muscles"`
	}

	err = app.readJSON(w, r, &input)

	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if input.Name != nil {
		exercise.Name = *input.Name
	}

	if input.Type != nil {
		exercise.Type = *input.Type
	}

	if input.MovementPatternID != nil {
		exercise.MovementPatternID = *input.MovementPatternID
	}

	v := validator.New()

	if data.ValidateExercise(v, exercise); !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	err = app.models.Exercises.Update(exercise)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrEditConflict):
			app.editConflictResponse(w, r)
		default:
			app.serverErrorResponse(w, r, err)
		}
		return
	}

	// Update muscle relationships if provided
	if input.PrimaryMuscles != nil || input.SecondaryMuscles != nil {
		err = app.models.Exercises.UpdateMuscles(exercise.ID, input.PrimaryMuscles, input.SecondaryMuscles)
		if err != nil {
			app.serverErrorResponse(w, r, err)
			return
		}
	}

	// Reload the exercise with its muscle relationships
	exercise, err = app.models.Exercises.Get(exercise.ID)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"exercise": exercise}, nil)

	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) deleteExerciseHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	err = app.models.Exercises.Delete(id)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrRecordNotFound):
			app.notFoundResponse(w, r)
		default:
			app.serverErrorResponse(w, r, err)
		}
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"message": "exercise successfully deleted"}, nil)

	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) listExerciseHandle(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Name                string
		Type                data.ExerciseType
		MovementPatternID   int64
		MovementPatternName string
		BodyPart            string
		MuscleID            int64
		data.Filters
	}

	v := validator.New()

	qs := r.URL.Query()

	input.Name = app.readString(qs, "name", "")
	input.Type = data.ExerciseType(app.readString(qs, "type", ""))
	input.BodyPart = app.readString(qs, "body_part", "")
	input.MovementPatternName = app.readString(qs, "movement_pattern", "")

	// Parse movement_pattern_id
	movementPatternIDStr := app.readString(qs, "movement_pattern_id", "0")
	if movementPatternIDStr != "0" {
		movementPatternID, err := strconv.ParseInt(movementPatternIDStr, 10, 64)
		if err != nil {
			v.AddError("movement_pattern_id", "must be a valid integer")
		} else {
			input.MovementPatternID = movementPatternID
		}
	}

	// Parse muscle_id
	muscleIDStr := app.readString(qs, "muscle_id", "0")
	if muscleIDStr != "0" {
		muscleID, err := strconv.ParseInt(muscleIDStr, 10, 64)
		if err != nil {
			v.AddError("muscle_id", "must be a valid integer")
		} else {
			input.MuscleID = muscleID
		}
	}

	input.Filters.Page = app.readInt(qs, "page", 1, v)
	input.Filters.PageSize = app.readInt(qs, "page_size", 20, v)

	input.Filters.Sort = app.readString(qs, "sort", "id")
	input.Filters.SortSafelist = []string{"id", "name", "type", "movement_pattern_id", "-id", "-name", "-type", "-movement_pattern_id"}

	if data.ValidateFilters(v, input.Filters); !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	exercises, metadata, err := app.models.Exercises.GetAll(input.Name, input.Type, input.MovementPatternID, input.MovementPatternName, input.BodyPart, input.MuscleID, input.Filters)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"exercises": exercises, "metadata": metadata}, nil)

	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
