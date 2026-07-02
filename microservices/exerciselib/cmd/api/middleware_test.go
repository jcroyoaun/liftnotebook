package main

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func newTestApplication(adminAPIKey string) *application {
	cfg := config{}
	cfg.adminAPIKey = adminAPIKey

	return &application{
		config: cfg,
		logger: slog.New(slog.NewTextHandler(os.Stderr, nil)),
	}
}

func TestRequireAdminKey(t *testing.T) {
	tests := []struct {
		name           string
		configuredKey  string
		requestKey     string
		expectedStatus int
	}{
		{
			name:           "valid key allows request",
			configuredKey:  "super-secret",
			requestKey:     "super-secret",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "wrong key is rejected",
			configuredKey:  "super-secret",
			requestKey:     "wrong-key",
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "missing key is rejected",
			configuredKey:  "super-secret",
			requestKey:     "",
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "unconfigured server fails closed",
			configuredKey:  "",
			requestKey:     "anything",
			expectedStatus: http.StatusServiceUnavailable,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := newTestApplication(tt.configuredKey)

			nextCalled := false
			next := func(w http.ResponseWriter, r *http.Request) {
				nextCalled = true
				w.WriteHeader(http.StatusOK)
			}

			r := httptest.NewRequest(http.MethodPost, "/v1/exercises", nil)
			if tt.requestKey != "" {
				r.Header.Set("X-Admin-Key", tt.requestKey)
			}

			w := httptest.NewRecorder()
			app.requireAdminKey(next)(w, r)

			if w.Code != tt.expectedStatus {
				t.Errorf("got status %d; want %d", w.Code, tt.expectedStatus)
			}

			if nextCalled != (tt.expectedStatus == http.StatusOK) {
				t.Errorf("next handler called = %v; want %v", nextCalled, tt.expectedStatus == http.StatusOK)
			}
		})
	}
}
