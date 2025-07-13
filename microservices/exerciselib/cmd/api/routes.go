package main

import (
	"net/http"

	"github.com/julienschmidt/httprouter"
)

func (app *application) routes() http.Handler {
	// Initialize a new httprouter router instance.
	router := httprouter.New()

	// Register the relevant methods, URL patterns and handler functions for our
	// endpoints using the HandlerFunc() method. Note that http.MethodGet and
	// http.MethodPost are constants which equate to the strings "GET" and "POST"
	// respectively.
	router.NotFound = http.HandlerFunc(app.notFoundResponse)
	router.MethodNotAllowed = http.HandlerFunc(app.methodNotAllowedResponse)

	// Health check
	router.HandlerFunc(http.MethodGet, "/v1/healthcheck", app.healthcheckHandler)

	// Exercise routes
	router.HandlerFunc(http.MethodGet, "/v1/exercises", app.listExerciseHandle)
	router.HandlerFunc(http.MethodPost, "/v1/exercises", app.createExerciseHandler)
	router.HandlerFunc(http.MethodGet, "/v1/exercises/:id", app.showExerciseHandler)
	router.HandlerFunc(http.MethodPatch, "/v1/exercises/:id", app.updateExerciseHandler)
	router.HandlerFunc(http.MethodDelete, "/v1/exercises/:id", app.deleteExerciseHandler)

	// Movement pattern routes
	router.HandlerFunc(http.MethodGet, "/v1/movement-patterns", app.showMovementPatternsHandler)
	router.HandlerFunc(http.MethodPost, "/v1/movement-patterns", app.createMovementPatternHandler)
	router.HandlerFunc(http.MethodGet, "/v1/movement-patterns/:id", app.showMovementPatternHandler)
	router.HandlerFunc(http.MethodPatch, "/v1/movement-patterns/:id", app.updateMovementPatternHandler)
	router.HandlerFunc(http.MethodDelete, "/v1/movement-patterns/:id", app.deleteMovementPatternHandler)

	// Muscle routes
	router.HandlerFunc(http.MethodGet, "/v1/muscles", app.listMusclesHandler)
	router.HandlerFunc(http.MethodPost, "/v1/muscles", app.createMuscleHandler)
	router.HandlerFunc(http.MethodGet, "/v1/muscles/:id", app.showMuscleHandler)
	router.HandlerFunc(http.MethodPatch, "/v1/muscles/:id", app.updateMuscleHandler)
	router.HandlerFunc(http.MethodDelete, "/v1/muscles/:id", app.deleteMuscleHandler)

	// User routes
	router.HandlerFunc(http.MethodPost, "/v1/users", app.registerUserHandler)

	// Return the httprouter instance.
	return app.recoverPanic(app.rateLimit(router))
}
