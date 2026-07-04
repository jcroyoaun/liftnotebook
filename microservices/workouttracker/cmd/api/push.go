package main

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
	"workouttracker.jcroyoaun.io/internal/data"
	"workouttracker.jcroyoaun.io/internal/validator"
)

// restAlarmScheduler holds at most one pending rest-end notification per
// user. In-memory by design: alarms live ~3 minutes and the API runs as a
// single replica, so losing them on restart is acceptable.
type restAlarmScheduler struct {
	mu     sync.Mutex
	timers map[int64]*time.Timer
}

func newRestAlarmScheduler() *restAlarmScheduler {
	return &restAlarmScheduler{timers: make(map[int64]*time.Timer)}
}

func (s *restAlarmScheduler) schedule(userID int64, d time.Duration, fire func()) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if t, ok := s.timers[userID]; ok {
		t.Stop()
	}
	s.timers[userID] = time.AfterFunc(d, func() {
		s.mu.Lock()
		delete(s.timers, userID)
		s.mu.Unlock()
		fire()
	})
}

func (s *restAlarmScheduler) cancel(userID int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if t, ok := s.timers[userID]; ok {
		t.Stop()
		delete(s.timers, userID)
	}
}

func (app *application) pushConfigured() bool {
	return app.config.vapid.publicKey != "" && app.config.vapid.privateKey != ""
}

// getPushPublicKeyHandler bootstraps client subscriptions; an empty key tells
// the client push is not configured on this deployment.
func (app *application) getPushPublicKeyHandler(w http.ResponseWriter, r *http.Request) {
	err := app.writeJSON(w, http.StatusOK, envelope{"public_key": app.config.vapid.publicKey}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) savePushSubscriptionHandler(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Endpoint string `json:"endpoint"`
		Keys     struct {
			P256dh string `json:"p256dh"`
			Auth   string `json:"auth"`
		} `json:"keys"`
	}

	err := app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	v := validator.New()
	v.Check(input.Endpoint != "", "endpoint", "must be provided")
	v.Check(len(input.Endpoint) <= 2000, "endpoint", "must not be more than 2000 characters")
	v.Check(input.Keys.P256dh != "", "keys.p256dh", "must be provided")
	v.Check(input.Keys.Auth != "", "keys.auth", "must be provided")
	if !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	sub := &data.PushSubscription{
		UserID:   app.contextGetUserID(r),
		Endpoint: input.Endpoint,
		P256dh:   input.Keys.P256dh,
		Auth:     input.Keys.Auth,
	}

	err = app.models.PushSubs.Upsert(sub)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"message": "subscribed"}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) deletePushSubscriptionHandler(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Endpoint string `json:"endpoint"`
	}

	err := app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	err = app.models.PushSubs.Delete(app.contextGetUserID(r), input.Endpoint)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"message": "unsubscribed"}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) scheduleRestAlarmHandler(w http.ResponseWriter, r *http.Request) {
	if !app.pushConfigured() {
		app.errorResponse(w, r, http.StatusServiceUnavailable, "push notifications are not configured")
		return
	}

	var input struct {
		Seconds int `json:"seconds"`
	}

	err := app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	v := validator.New()
	v.Check(input.Seconds >= 1 && input.Seconds <= 3600, "seconds", "must be between 1 and 3600")
	if !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	userID := app.contextGetUserID(r)
	app.restAlarms.schedule(userID, time.Duration(input.Seconds)*time.Second, func() {
		app.sendRestPush(userID)
	})

	err = app.writeJSON(w, http.StatusAccepted, envelope{"message": "rest alarm scheduled"}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) cancelRestAlarmHandler(w http.ResponseWriter, r *http.Request) {
	app.restAlarms.cancel(app.contextGetUserID(r))

	err := app.writeJSON(w, http.StatusOK, envelope{"message": "rest alarm cancelled"}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) sendRestPush(userID int64) {
	subs, err := app.models.PushSubs.GetForUser(userID)
	if err != nil {
		app.logger.Error("rest push: loading subscriptions failed", "error", err.Error())
		return
	}

	payload, err := json.Marshal(map[string]string{
		"title": "Rest over — lift!",
		"body":  "Next set is waiting. Back to work.",
	})
	if err != nil {
		app.logger.Error("rest push: payload marshal failed", "error", err.Error())
		return
	}

	for _, sub := range subs {
		resp, err := webpush.SendNotification(payload, &webpush.Subscription{
			Endpoint: sub.Endpoint,
			Keys:     webpush.Keys{P256dh: sub.P256dh, Auth: sub.Auth},
		}, &webpush.Options{
			Subscriber:      "mailto:jcroyoaun@gmail.com",
			VAPIDPublicKey:  app.config.vapid.publicKey,
			VAPIDPrivateKey: app.config.vapid.privateKey,
			TTL:             120,
			Urgency:         webpush.UrgencyHigh,
		})
		if err != nil {
			app.logger.Error("rest push: send failed", "error", err.Error())
			continue
		}
		if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone {
			// The push service says this endpoint is dead — prune it.
			_ = app.models.PushSubs.DeleteByEndpoint(sub.Endpoint)
		}
		resp.Body.Close()
	}
}
