package main

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func newTestApplication(adminAPIKey, jwtSecret string) *application {
	cfg := config{}
	cfg.adminAPIKey = adminAPIKey
	cfg.jwtSecret = jwtSecret

	return &application{
		config: cfg,
		logger: slog.New(slog.NewTextHandler(os.Stderr, nil)),
	}
}

func signToken(t *testing.T, secret, role string, expired bool) string {
	t.Helper()
	exp := time.Now().Add(time.Hour)
	if expired {
		exp = time.Now().Add(-time.Hour)
	}
	claims := jwt.MapClaims{
		"user_id": int64(1),
		"email":   "owner@example.com",
		"role":    role,
		"exp":     exp.Unix(),
		"iat":     time.Now().Add(-2 * time.Hour).Unix(),
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("signing test token: %v", err)
	}
	return token
}

func TestRequireAdmin(t *testing.T) {
	const secret = "shared-jwt-secret"

	tests := []struct {
		name           string
		configuredKey  string
		jwtSecret      string
		requestKey     string
		bearer         func(t *testing.T) string
		expectedStatus int
	}{
		{
			name:           "valid admin key allows request",
			configuredKey:  "super-secret",
			jwtSecret:      secret,
			requestKey:     "super-secret",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "wrong admin key is rejected even with jwt configured",
			configuredKey:  "super-secret",
			jwtSecret:      secret,
			requestKey:     "wrong-key",
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "no credentials at all is rejected",
			configuredKey:  "super-secret",
			jwtSecret:      secret,
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "unconfigured server fails closed",
			configuredKey:  "",
			jwtSecret:      "",
			requestKey:     "anything",
			expectedStatus: http.StatusServiceUnavailable,
		},
		{
			name:          "admin jwt allows request",
			configuredKey: "super-secret",
			jwtSecret:     secret,
			bearer: func(t *testing.T) string {
				return signToken(t, secret, "admin", false)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:          "non-admin jwt is forbidden",
			configuredKey: "super-secret",
			jwtSecret:     secret,
			bearer: func(t *testing.T) string {
				return signToken(t, secret, "user", false)
			},
			expectedStatus: http.StatusForbidden,
		},
		{
			name:          "expired admin jwt is rejected",
			configuredKey: "super-secret",
			jwtSecret:     secret,
			bearer: func(t *testing.T) string {
				return signToken(t, secret, "admin", true)
			},
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:          "jwt signed with wrong secret is rejected",
			configuredKey: "super-secret",
			jwtSecret:     secret,
			bearer: func(t *testing.T) string {
				return signToken(t, "some-other-secret", "admin", false)
			},
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:          "admin jwt without configured jwt secret is rejected",
			configuredKey: "super-secret",
			jwtSecret:     "",
			bearer: func(t *testing.T) string {
				return signToken(t, secret, "admin", false)
			},
			expectedStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := newTestApplication(tt.configuredKey, tt.jwtSecret)

			nextCalled := false
			next := func(w http.ResponseWriter, r *http.Request) {
				nextCalled = true
				w.WriteHeader(http.StatusOK)
			}

			r := httptest.NewRequest(http.MethodPost, "/v1/exercises", nil)
			if tt.requestKey != "" {
				r.Header.Set("X-Admin-Key", tt.requestKey)
			}
			if tt.bearer != nil {
				r.Header.Set("Authorization", "Bearer "+tt.bearer(t))
			}

			w := httptest.NewRecorder()
			app.requireAdmin(next)(w, r)

			if w.Code != tt.expectedStatus {
				t.Errorf("got status %d; want %d", w.Code, tt.expectedStatus)
			}

			if nextCalled != (tt.expectedStatus == http.StatusOK) {
				t.Errorf("next handler called = %v; want %v", nextCalled, tt.expectedStatus == http.StatusOK)
			}
		})
	}
}
