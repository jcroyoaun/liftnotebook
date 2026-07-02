// in exerciselib/cmd/api/routes.go
package main

import (
	"net/http"

	"github.com/julienschmidt/httprouter"
	"github.com/prometheus/client_golang/prometheus/promhttp" // <-- ADD THIS IMPORT
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

	// --- ADD THE /metrics ENDPOINT ---
	// This handler serves the Prometheus metrics.
	// We DO NOT wrap this in our metrics middleware.
	router.Handler(http.MethodGet, "/metrics", promhttp.Handler())

	// --- WRAP YOUR HANDLERS WITH METRICS ---

	// Health check
	router.HandlerFunc(http.MethodGet, "/v1/healthcheck", app.metrics(app.healthcheckHandler, "/v1/healthcheck"))

	// Exercise routes. All mutating endpoints require the admin API key.
	router.HandlerFunc(http.MethodGet, "/v1/exercises", app.metrics(app.listExerciseHandle, "/v1/exercises"))
	router.HandlerFunc(http.MethodPost, "/v1/exercises", app.metrics(app.requireAdmin(app.createExerciseHandler), "/v1/exercises"))
	router.HandlerFunc(http.MethodGet, "/v1/exercises/:id", app.metrics(app.showExerciseHandler, "/v1/exercises/:id"))
	router.HandlerFunc(http.MethodPatch, "/v1/exercises/:id", app.metrics(app.requireAdmin(app.updateExerciseHandler), "/v1/exercises/:id"))
	router.HandlerFunc(http.MethodDelete, "/v1/exercises/:id", app.metrics(app.requireAdmin(app.deleteExerciseHandler), "/v1/exercises/:id"))

	// Movement pattern routes
	router.HandlerFunc(http.MethodGet, "/v1/movement-patterns", app.metrics(app.showMovementPatternsHandler, "/v1/movement-patterns"))
	router.HandlerFunc(http.MethodPost, "/v1/movement-patterns", app.metrics(app.requireAdmin(app.createMovementPatternHandler), "/v1/movement-patterns"))
	router.HandlerFunc(http.MethodGet, "/v1/movement-patterns/:id", app.metrics(app.showMovementPatternHandler, "/v1/movement-patterns/:id"))
	router.HandlerFunc(http.MethodPatch, "/v1/movement-patterns/:id", app.metrics(app.requireAdmin(app.updateMovementPatternHandler), "/v1/movement-patterns/:id"))
	router.HandlerFunc(http.MethodDelete, "/v1/movement-patterns/:id", app.metrics(app.requireAdmin(app.deleteMovementPatternHandler), "/v1/movement-patterns/:id"))

	// Muscle routes
	router.HandlerFunc(http.MethodGet, "/v1/muscles", app.metrics(app.listMusclesHandler, "/v1/muscles"))
	router.HandlerFunc(http.MethodPost, "/v1/muscles", app.metrics(app.requireAdmin(app.createMuscleHandler), "/v1/muscles"))
	router.HandlerFunc(http.MethodGet, "/v1/muscles/:id", app.metrics(app.showMuscleHandler, "/v1/muscles/:id"))
	router.HandlerFunc(http.MethodPatch, "/v1/muscles/:id", app.metrics(app.requireAdmin(app.updateMuscleHandler), "/v1/muscles/:id"))
	router.HandlerFunc(http.MethodDelete, "/v1/muscles/:id", app.metrics(app.requireAdmin(app.deleteMuscleHandler), "/v1/muscles/:id"))

	// User routes. Registration here is admin-only scaffolding — end users
	// register through the workouttracker API instead.
	router.HandlerFunc(http.MethodPost, "/v1/users", app.metrics(app.requireAdmin(app.registerUserHandler), "/v1/users"))

	// Return the httprouter instance.
	return app.recoverPanic(app.rateLimit(router))
}
