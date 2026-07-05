package main

import (
	"encoding/json"
	"io"
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
// the client push is not configured on this deployment. "subscribed" lets the
// client detect a server-side pruned subscription (iOS silently revokes) and
// re-subscribe instead of showing a toggle that lies.
func (app *application) getPushPublicKeyHandler(w http.ResponseWriter, r *http.Request) {
	subscribed, err := app.models.PushSubs.HasForUser(app.contextGetUserID(r))
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{
		"public_key": app.config.vapid.publicKey,
		"subscribed": subscribed,
	}, nil)
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
	app.scheduleRestAlarm(userID, time.Duration(input.Seconds)*time.Second)

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

// pushTestHandler sends an immediate notification to every subscription the
// user has — the on-device answer to "is push actually working here?".
func (app *application) pushTestHandler(w http.ResponseWriter, r *http.Request) {
	if !app.pushConfigured() {
		app.errorResponse(w, r, http.StatusServiceUnavailable, "push notifications are not configured")
		return
	}

	userID := app.contextGetUserID(r)

	sent, subCount := app.sendPushToUser(userID, "Test notification", "Push works on this device 💪", "push-test")
	if subCount == 0 {
		app.errorResponse(w, r, http.StatusNotFound, "no push subscription for this account — enable the rest alarm on this device first")
		return
	}

	err := app.writeJSON(w, http.StatusAccepted, envelope{"sent": sent}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

// scheduleRestAlarm arms (or replaces — one pending alarm per user) the
// user's rest-end notification.
func (app *application) scheduleRestAlarm(userID int64, d time.Duration) {
	app.restAlarms.schedule(userID, d, func() {
		app.sendRestPush(userID)
	})
	app.logger.Info("rest alarm scheduled", "user_id", userID, "seconds", int(d/time.Second))
}

// maybeScheduleRestAlarmAt arms the rest alarm from the set write path, so
// offline-replayed set logs still schedule their alarm. Best effort: only
// when the deadline is still ahead (and sane), and only for users with a
// subscription to deliver to.
func (app *application) maybeScheduleRestAlarmAt(userID int64, endsAt time.Time) {
	if !app.pushConfigured() {
		return
	}

	d := time.Until(endsAt)
	if d <= 0 || d > time.Hour {
		return
	}

	subscribed, err := app.models.PushSubs.HasForUser(userID)
	if err != nil {
		app.logger.Error("rest alarm: subscription lookup failed", "user_id", userID, "error", err.Error())
		return
	}
	if !subscribed {
		return
	}

	app.scheduleRestAlarm(userID, d)
}

func (app *application) sendRestPush(userID int64) {
	sent, subCount := app.sendPushToUser(userID, "Rest over — lift!", "Next set is waiting. Back to work.", "rest-timer")
	if subCount == 0 {
		app.logger.Warn("rest alarm fired but user has no push subscriptions", "user_id", userID)
		return
	}
	app.logger.Info("rest alarm fired", "user_id", userID, "subscriptions", subCount, "sent", sent)
}

// sendPushToUser delivers a Declarative Web Push payload (web_push: 8030) to
// every subscription the user has. iOS 18.4+ renders it without waking the
// service worker (no silent-push strikes); older clients read the same JSON
// in the sw push handler. Returns accepted (2xx) sends and how many
// subscriptions were attempted.
func (app *application) sendPushToUser(userID int64, title, body, topic string) (sent, subCount int) {
	subs, err := app.models.PushSubs.GetForUser(userID)
	if err != nil {
		app.logger.Error("push: loading subscriptions failed", "user_id", userID, "error", err.Error())
		return 0, 0
	}
	if len(subs) == 0 {
		return 0, 0
	}

	payload, err := json.Marshal(map[string]any{
		"web_push": 8030,
		"notification": map[string]string{
			"title":    title,
			"body":     body,
			"navigate": app.config.appURL,
		},
	})
	if err != nil {
		app.logger.Error("push: payload marshal failed", "error", err.Error())
		return 0, len(subs)
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
			// Topic collapses undelivered messages at the push service, so a
			// re-scheduled alarm replaces a stale pending one.
			Topic: topic,
		})
		if err != nil {
			app.logger.Error("push: send failed", "user_id", userID, "endpoint", sub.Endpoint, "error", err.Error())
			continue
		}

		switch {
		case resp.StatusCode >= 200 && resp.StatusCode < 300:
			sent++
			app.logger.Info("push: sent", "user_id", userID, "status", resp.StatusCode)
		case resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone:
			// The push service says this endpoint is dead — prune it.
			app.logger.Warn("push: endpoint gone, pruning subscription",
				"user_id", userID, "status", resp.StatusCode, "endpoint", sub.Endpoint)
			_ = app.models.PushSubs.DeleteByEndpoint(sub.Endpoint)
		default:
			// APNs 400/401/403 (e.g. VAPID mismatch) must be visible in logs
			// — this used to be silently discarded.
			respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
			app.logger.Error("push: rejected by push service",
				"user_id", userID, "status", resp.StatusCode, "endpoint", sub.Endpoint, "body", string(respBody))
		}
		resp.Body.Close()
	}

	return sent, len(subs)
}
