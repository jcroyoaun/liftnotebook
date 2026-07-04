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
	router.HandlerFunc(http.MethodPut, "/v1/users/password", app.resetPasswordHandler)

	// Account
	router.HandlerFunc(http.MethodPost, "/v1/me/password", app.requireAuth(app.changePasswordHandler))

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
	router.HandlerFunc(http.MethodGet, "/v1/training-days/:id/suggestions", app.requireAuth(app.getTrainingDaySuggestionsHandler))

	// Workout sessions
	router.HandlerFunc(http.MethodPost, "/v1/sessions", app.requireAuth(app.createWorkoutSessionHandler))
	router.HandlerFunc(http.MethodGet, "/v1/sessions/:id", app.requireAuth(app.getWorkoutSessionHandler))
	router.HandlerFunc(http.MethodPatch, "/v1/sessions/:id", app.requireAuth(app.updateWorkoutSessionHandler))
	router.HandlerFunc(http.MethodGet, "/v1/mesocycles/:id/sessions", app.requireAuth(app.listWorkoutSessionsHandler))

	// Web push (rest-timer notifications)
	router.HandlerFunc(http.MethodGet, "/v1/push/public-key", app.requireAuth(app.getPushPublicKeyHandler))
	router.HandlerFunc(http.MethodPut, "/v1/me/push-subscription", app.requireAuth(app.savePushSubscriptionHandler))
	router.HandlerFunc(http.MethodDelete, "/v1/me/push-subscription", app.requireAuth(app.deletePushSubscriptionHandler))
	router.HandlerFunc(http.MethodPost, "/v1/me/rest-alarm", app.requireAuth(app.scheduleRestAlarmHandler))
	router.HandlerFunc(http.MethodDelete, "/v1/me/rest-alarm", app.requireAuth(app.cancelRestAlarmHandler))

	// Sets
	router.HandlerFunc(http.MethodPost, "/v1/sets", app.requireAuth(app.logSetHandler))
	router.HandlerFunc(http.MethodPatch, "/v1/sets/:id", app.requireAuth(app.updateSetHandler))
	router.HandlerFunc(http.MethodDelete, "/v1/sets/:id", app.requireAuth(app.deleteSetHandler))

	// Program templates (browse for everyone, writes are admin-only)
	router.HandlerFunc(http.MethodGet, "/v1/templates", app.requireAuth(app.listTemplatesHandler))
	router.HandlerFunc(http.MethodGet, "/v1/templates/:id", app.requireAuth(app.getTemplateHandler))
	router.HandlerFunc(http.MethodPost, "/v1/templates/:id/start", app.requireAuth(app.startTemplateHandler))
	router.HandlerFunc(http.MethodPost, "/v1/templates", app.requireAdmin(app.createTemplateHandler))
	router.HandlerFunc(http.MethodPut, "/v1/templates/:id", app.requireAdmin(app.updateTemplateHandler))
	router.HandlerFunc(http.MethodDelete, "/v1/templates/:id", app.requireAdmin(app.deleteTemplateHandler))

	// Admin
	router.HandlerFunc(http.MethodGet, "/v1/admin/users", app.requireAdmin(app.listUsersHandler))
	router.HandlerFunc(http.MethodPost, "/v1/admin/users/:id/reset-token", app.requireAdmin(app.createPasswordResetTokenHandler))
	router.HandlerFunc(http.MethodGet, "/v1/admin/invite-code", app.requireAdmin(app.getInviteCodeHandler))

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
