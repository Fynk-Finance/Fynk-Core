package audit

import (
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	identityports "github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/ports"
)

func TestMapKeycloakEvent(t *testing.T) {
	now := time.Now().UTC()

	t.Run("LOGIN event mapping and validation", func(t *testing.T) {
		kcEvt := identityports.AuthEvent{
			ID:        "e-1",
			Time:      now,
			Type:      "LOGIN",
			UserID:    "u-123",
			IPAddress: "192.168.1.10",
			Details: map[string]string{
				"auth_method": "openid-connect",
				"username":    "sensitive-email@test.com", // must be discarded!
			},
		}

		auditEvt, ok := mapKeycloakEvent(kcEvt)
		if !ok {
			t.Fatal("expected LOGIN event to be mapped")
		}
		if auditEvt.Type != ports.AuthLogin || auditEvt.UserID != "u-123" {
			t.Fatalf("unexpected mapped event: %+v", auditEvt)
		}
		if auditEvt.Meta["ip"] != "192.168.1.10" || auditEvt.Meta["auth_method"] != "openid-connect" {
			t.Fatalf("unexpected meta: %+v", auditEvt.Meta)
		}
		if _, hasUsername := auditEvt.Meta["username"]; hasUsername {
			t.Fatal("username must never be included in audit meta")
		}

		if err := ValidateEvent(auditEvt); err != nil {
			t.Fatalf("mapped event failed ValidateEvent: %v", err)
		}
	})

	t.Run("LOGIN_ERROR event mapping and validation", func(t *testing.T) {
		kcEvt := identityports.AuthEvent{
			ID:        "e-2",
			Time:      now,
			Type:      "LOGIN_ERROR",
			UserID:    "",
			IPAddress: "10.0.0.1",
			Error:     "user_not_found",
			Details: map[string]string{
				"username": "attacker@evil.com",
			},
		}

		auditEvt, ok := mapKeycloakEvent(kcEvt)
		if !ok {
			t.Fatal("expected LOGIN_ERROR event to be mapped")
		}
		if auditEvt.Type != ports.AuthLoginFailed {
			t.Fatalf("unexpected type: %s", auditEvt.Type)
		}
		if auditEvt.Meta["reason"] != "user_not_found" || auditEvt.Meta["status"] != "failed" {
			t.Fatalf("unexpected meta: %+v", auditEvt.Meta)
		}
		if err := ValidateEvent(auditEvt); err != nil {
			t.Fatalf("mapped event failed ValidateEvent: %v", err)
		}
	})

	t.Run("RESET_PASSWORD event mapping and validation", func(t *testing.T) {
		kcEvt := identityports.AuthEvent{
			ID:        "e-3",
			Time:      now,
			Type:      "RESET_PASSWORD",
			UserID:    "u-456",
			IPAddress: "172.16.0.5",
		}

		auditEvt, ok := mapKeycloakEvent(kcEvt)
		if !ok {
			t.Fatal("expected RESET_PASSWORD event to be mapped")
		}
		if auditEvt.Type != ports.AuthPasswordReset {
			t.Fatalf("unexpected type: %s", auditEvt.Type)
		}
		if err := ValidateEvent(auditEvt); err != nil {
			t.Fatalf("mapped event failed ValidateEvent: %v", err)
		}
	})

	t.Run("Unrelated events ignored", func(t *testing.T) {
		kcEvt := identityports.AuthEvent{
			ID:   "e-4",
			Time: now,
			Type: "CLIENT_LOGIN",
		}
		_, ok := mapKeycloakEvent(kcEvt)
		if ok {
			t.Fatal("expected unrelated event to be ignored")
		}
	})
}
