package main

import (
	"net/http"

	"github.com/julienschmidt/httprouter"
)

func (app *application) routes() http.Handler {
	router := httprouter.New()

	router.NotFound = http.HandlerFunc(app.notFoundResponse)
	router.MethodNotAllowed = http.HandlerFunc(app.methodNotAllowedResponse)

	// Health check
	router.HandlerFunc(http.MethodGet, "/v1/healthcheck", app.healthcheckHandler)

	// Auth (public)
	router.HandlerFunc(http.MethodPost, "/v1/users/register", app.registerUserHandler)
	router.HandlerFunc(http.MethodPost, "/v1/users/login", app.loginUserHandler)

	// Exercises (public, read-only from shared DB)
	router.HandlerFunc(http.MethodGet, "/v1/exercises", app.listExercisesHandler)
	router.HandlerFunc(http.MethodGet, "/v1/exercises/:id", app.getExerciseHandler)

	// Protected routes
	router.HandlerFunc(http.MethodPost, "/v1/mesocycles", app.requireAuth(app.createMesocycleHandler))
	router.HandlerFunc(http.MethodGet, "/v1/mesocycles", app.requireAuth(app.listMesocyclesHandler))
	router.HandlerFunc(http.MethodGet, "/v1/me/mesocycle", app.requireAuth(app.getActiveMesocycleHandler))
	router.HandlerFunc(http.MethodGet, "/v1/mesocycles/:id", app.requireAuth(app.getMesocycleHandler))
	router.HandlerFunc(http.MethodPost, "/v1/mesocycles/:id/end", app.requireAuth(app.endMesocycleHandler))
	router.HandlerFunc(http.MethodDelete, "/v1/mesocycles/:id", app.requireAuth(app.deleteMesocycleHandler))

	router.HandlerFunc(http.MethodGet, "/v1/me/exercises", app.requireAuth(app.listUserExercisesHandler))

	// Training day exercises
	router.HandlerFunc(http.MethodPut, "/v1/training-days/:id/exercises", app.requireAuth(app.trainingDayExercisesHandler))

	// Workout sessions
	router.HandlerFunc(http.MethodPost, "/v1/sessions", app.requireAuth(app.createWorkoutSessionHandler))
	router.HandlerFunc(http.MethodGet, "/v1/sessions/:id", app.requireAuth(app.getWorkoutSessionHandler))
	router.HandlerFunc(http.MethodGet, "/v1/mesocycles/:id/sessions", app.requireAuth(app.listWorkoutSessionsHandler))

	// Sets
	router.HandlerFunc(http.MethodPost, "/v1/sets", app.requireAuth(app.logSetHandler))
	router.HandlerFunc(http.MethodPatch, "/v1/sets/:id", app.requireAuth(app.updateSetHandler))
	router.HandlerFunc(http.MethodDelete, "/v1/sets/:id", app.requireAuth(app.deleteSetHandler))

	// Analytics
	router.HandlerFunc(http.MethodPost, "/v1/volume/preview", app.requireAuth(app.previewVolumeHandler))
	router.HandlerFunc(http.MethodGet, "/v1/progress/e1rm", app.requireAuth(app.getE1RMProgressHandler))
	router.HandlerFunc(http.MethodGet, "/v1/mesocycles/:id/volume", app.requireAuth(app.getMesocycleVolumeHandler))
	router.HandlerFunc(http.MethodGet, "/v1/mesocycles/:id/weekly-volume", app.requireAuth(app.getWeeklyVolumeHandler))

	return app.recoverPanic(app.enableCORS(router))
}

func (app *application) healthcheckHandler(w http.ResponseWriter, r *http.Request) {
	err := app.writeJSON(w, http.StatusOK, envelope{
		"status": "available",
		"system_info": map[string]string{
			"version":     version,
			"environment": app.config.env,
		},
	}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
