package main

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const userContextKey = contextKey("user")

func (app *application) contextSetUserID(r *http.Request, userID int64) *http.Request {
	ctx := context.WithValue(r.Context(), userContextKey, userID)
	return r.WithContext(ctx)
}

func (app *application) contextGetUserID(r *http.Request) int64 {
	id, ok := r.Context().Value(userContextKey).(int64)
	if !ok {
		panic("missing user ID in request context")
	}
	return id
}

func (app *application) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			app.invalidAuthenticationTokenResponse(w, r)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			app.invalidAuthenticationTokenResponse(w, r)
			return
		}

		tokenString := parts[1]

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (any, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(app.config.jwt.secret), nil
		})
		if err != nil || !token.Valid {
			app.invalidAuthenticationTokenResponse(w, r)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			app.invalidAuthenticationTokenResponse(w, r)
			return
		}

		userIDFloat, ok := claims["user_id"].(float64)
		if !ok {
			app.invalidAuthenticationTokenResponse(w, r)
			return
		}

		r = app.contextSetUserID(r, int64(userIDFloat))
		next.ServeHTTP(w, r)
	}
}

func (app *application) enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (app *application) recoverPanic(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				w.Header().Set("Connection", "close")
				app.serverErrorResponse(w, r, fmt.Errorf("%s", err))
			}
		}()
		next.ServeHTTP(w, r)
	})
}
