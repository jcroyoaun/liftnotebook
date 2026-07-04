package data

import (
	"crypto/sha256"
	"database/sql/driver"
	"testing"
	"time"
)

func TestGenerateTokenProducesHashedPlaintext(t *testing.T) {
	token, err := generateToken(42, 2*time.Hour, ScopePasswordReset)
	if err != nil {
		t.Fatalf("generateToken: %v", err)
	}

	if len(token.Plaintext) != 26 {
		t.Errorf("plaintext length = %d, want 26", len(token.Plaintext))
	}
	if token.UserID != 42 {
		t.Errorf("user ID = %d, want 42", token.UserID)
	}
	if token.Scope != ScopePasswordReset {
		t.Errorf("scope = %q, want %q", token.Scope, ScopePasswordReset)
	}
	if !token.Expiry.After(time.Now().Add(time.Hour)) {
		t.Errorf("expiry %v is not ~2h in the future", token.Expiry)
	}

	wantHash := sha256.Sum256([]byte(token.Plaintext))
	if string(token.Hash) != string(wantHash[:]) {
		t.Error("hash does not match sha256 of plaintext")
	}
}

func TestTokenModelNewInsertsHashedToken(t *testing.T) {
	db, stub := newStubDB(t,
		stubExpectation{
			op:          "exec",
			sqlContains: "INSERT INTO tokens (hash, user_id, expiry, scope)",
			result:      driver.RowsAffected(1),
		},
	)

	model := TokenModel{DB: db}

	token, err := model.New(7, time.Hour, ScopePasswordReset)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if token.Plaintext == "" {
		t.Error("expected plaintext token to be returned")
	}

	stub.assertExhausted(t)
}

func TestTokenModelDeleteAllForUser(t *testing.T) {
	db, stub := newStubDB(t,
		stubExpectation{
			op:          "exec",
			sqlContains: "DELETE FROM tokens WHERE scope = $1 AND user_id = $2",
			args:        []driver.Value{ScopePasswordReset, int64(7)},
			result:      driver.RowsAffected(2),
		},
	)

	model := TokenModel{DB: db}

	if err := model.DeleteAllForUser(ScopePasswordReset, 7); err != nil {
		t.Fatalf("DeleteAllForUser: %v", err)
	}

	stub.assertExhausted(t)
}
