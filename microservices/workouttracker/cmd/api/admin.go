package main

import (
	"errors"
	"net/http"
	"time"

	"workouttracker.jcroyoaun.io/internal/data"
)

// getInviteCodeHandler exposes the configured invite code so the admin UI can
// build shareable /register?code=... links. Admin-only; empty means open
// registration.
func (app *application) getInviteCodeHandler(w http.ResponseWriter, r *http.Request) {
	err := app.writeJSON(w, http.StatusOK, envelope{"invite_code": app.config.inviteCode}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) listUsersHandler(w http.ResponseWriter, r *http.Request) {
	users, err := app.models.Users.ListAll()
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"users": users}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

// createPasswordResetTokenHandler mints a one-time reset code for a user.
// There is no email delivery — the admin shares the code out-of-band, so the
// plaintext is returned exactly once, here.
func (app *application) createPasswordResetTokenHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	user, err := app.models.Users.GetByID(id)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrRecordNotFound):
			app.notFoundResponse(w, r)
		default:
			app.serverErrorResponse(w, r, err)
		}
		return
	}

	// Invalidate any previous outstanding code before minting a new one.
	err = app.models.Tokens.DeleteAllForUser(data.ScopePasswordReset, user.ID)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	token, err := app.models.Tokens.New(user.ID, 2*time.Hour, data.ScopePasswordReset)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusCreated, envelope{
		"reset_token": token,
		"user": envelope{
			"id":    user.ID,
			"email": user.Email,
		},
	}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
