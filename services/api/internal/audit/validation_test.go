package audit

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
)

func TestValidateEventTypes(t *testing.T) {
	requiredTypes := []string{
		ports.AuthLogin,
		ports.AuthLoginFailed,
		ports.AuthPasswordReset,
		ports.DeviceRegistered,
		ports.DeviceApproved,
		ports.DeviceRejected,
		ports.DeviceRemoved,
		ports.ConsentCreated,
		ports.ConsentGranted,
		ports.ConsentRevoked,
		ports.ConsentExpired,
		ports.BankLinkCreated,
		ports.BankSync,
		ports.BankSyncFailed,
		ports.BankTokenRefreshed,
		ports.BackupUploaded,
		ports.BackupRestored,
		ports.RecoveryKeySet,
		ports.PrivacyDeletionRequested,
		ports.PrivacyDeletionCompleted,
	}

	for _, typ := range requiredTypes {
		err := ValidateEvent(ports.Event{
			Type: typ,
			At:   time.Now(),
		})
		if err != nil {
			t.Errorf("expected valid event for type %s, got: %v", typ, err)
		}
	}

	err := ValidateEvent(ports.Event{
		Type: "invalid.type",
		At:   time.Now(),
	})
	if !errors.Is(err, ErrUnknownEventType) {
		t.Fatalf("expected ErrUnknownEventType, got: %v", err)
	}
}

func TestValidateSensitiveKeysRejected(t *testing.T) {
	forbiddenKeys := []string{
		"amount",
		"email",
		"token",
		"account_number",
		"accountnumber",
		"password",
		"cedula",
		"authorization",
		"card",
		"pan",
		"cvv",
		"user_email",
		"total_amount",
		"jwt_token",
	}

	for _, k := range forbiddenKeys {
		err := ValidateEvent(ports.Event{
			Type: ports.BankSync,
			Meta: map[string]string{k: "secret-value"},
		})
		if !errors.Is(err, ErrSensitiveMetaKey) {
			t.Errorf("expected key %q to be rejected with ErrSensitiveMetaKey, got: %v", k, err)
		}
	}
}

func TestValidateDisallowedMetaKeys(t *testing.T) {
	err := ValidateEvent(ports.Event{
		Type: ports.DeviceRegistered,
		Meta: map[string]string{
			"unregistered_key": "some_value",
		},
	})
	if !errors.Is(err, ErrDisallowedMetaKey) {
		t.Fatalf("expected ErrDisallowedMetaKey, got: %v", err)
	}

	// Valid keys should pass
	err = ValidateEvent(ports.Event{
		Type: ports.DeviceRegistered,
		Meta: map[string]string{
			"platform": "ios",
			"status":   "active",
		},
	})
	if err != nil {
		t.Fatalf("expected nil error for valid keys, got: %v", err)
	}
}

func TestValidateDeviceID(t *testing.T) {
	// Valid UUID should pass
	validUUID := uuid.NewString()
	err := ValidateEvent(ports.Event{
		Type:     ports.AuthLogin,
		DeviceID: validUUID,
	})
	if err != nil {
		t.Fatalf("expected valid UUID to pass, got: %v", err)
	}

	// Invalid UUID should fail
	err = ValidateEvent(ports.Event{
		Type:     ports.AuthLogin,
		DeviceID: "not-a-uuid",
	})
	if !errors.Is(err, ErrInvalidDeviceID) {
		t.Fatalf("expected ErrInvalidDeviceID, got: %v", err)
	}

	// Empty DeviceID should pass
	err = ValidateEvent(ports.Event{
		Type:     ports.AuthLogin,
		DeviceID: "",
	})
	if err != nil {
		t.Fatalf("expected empty DeviceID to pass, got: %v", err)
	}
}
