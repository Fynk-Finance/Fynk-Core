package ports

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestValidateEventTypes(t *testing.T) {
	requiredTypes := []string{
		AuthLogin,
		AuthLoginFailed,
		AuthPasswordReset,
		DeviceRegistered,
		DeviceApproved,
		DeviceRejected,
		DeviceRemoved,
		ConsentCreated,
		ConsentGranted,
		ConsentRevoked,
		ConsentExpired,
		BankLinkCreated,
		BankSync,
		BankSyncFailed,
		BankTokenRefreshed,
		BackupUploaded,
		BackupRestored,
		RecoveryKeySet,
		PrivacyDeletionRequested,
		PrivacyDeletionCompleted,
	}

	for _, typ := range requiredTypes {
		err := ValidateEvent(Event{
			Type: typ,
			At:   time.Now(),
		})
		if err != nil {
			t.Errorf("expected valid event for type %s, got: %v", typ, err)
		}
	}

	err := ValidateEvent(Event{
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
		err := ValidateEvent(Event{
			Type: BankSync,
			Meta: map[string]string{k: "secret-value"},
		})
		if !errors.Is(err, ErrSensitiveMetaKey) {
			t.Errorf("expected key %q to be rejected with ErrSensitiveMetaKey, got: %v", k, err)
		}
	}
}

func TestValidateDisallowedMetaKeys(t *testing.T) {
	err := ValidateEvent(Event{
		Type: DeviceRegistered,
		Meta: map[string]string{
			"unregistered_key": "some_value",
		},
	})
	if !errors.Is(err, ErrDisallowedMetaKey) {
		t.Fatalf("expected ErrDisallowedMetaKey, got: %v", err)
	}

	// Valid keys should pass
	err = ValidateEvent(Event{
		Type: DeviceRegistered,
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
	err := ValidateEvent(Event{
		Type:     AuthLogin,
		DeviceID: validUUID,
	})
	if err != nil {
		t.Fatalf("expected valid UUID to pass, got: %v", err)
	}

	// Invalid UUID should fail
	err = ValidateEvent(Event{
		Type:     AuthLogin,
		DeviceID: "not-a-uuid",
	})
	if !errors.Is(err, ErrInvalidDeviceID) {
		t.Fatalf("expected ErrInvalidDeviceID, got: %v", err)
	}

	// Empty DeviceID should pass
	err = ValidateEvent(Event{
		Type:     AuthLogin,
		DeviceID: "",
	})
	if err != nil {
		t.Fatalf("expected empty DeviceID to pass, got: %v", err)
	}
}

// TestAllowListCoversSharedContractEvents mirrors the required event types in
// docs/modules/00-shared-contracts.md section 4.3. Update it together with that section.
func TestAllowListCoversSharedContractEvents(t *testing.T) {
	contractTypes := []string{
		"auth.login",
		"auth.login_failed",
		"auth.password_reset",
		"device.registered",
		"device.approved",
		"device.rejected",
		"device.removed",
		"consent.created",
		"consent.granted",
		"consent.revoked",
		"consent.expired",
		"consent.failed",
		"bank.link_created",
		"bank.sync",
		"bank.sync_failed",
		"bank.token_refreshed",
		"backup.uploaded",
		"backup.restored",
		"backup.reset",
		"recovery_key.set",
		"privacy.deletion_requested",
		"privacy.deletion_completed",
	}

	for _, typ := range contractTypes {
		if _, ok := allowedMetaKeys[typ]; !ok {
			t.Errorf("event type %q from the shared contracts is missing in allowedMetaKeys", typ)
		}
	}
}

func TestValidateEventAcceptsBackupEvents(t *testing.T) {
	deviceID := "6f1b1c0e-7a43-4b0e-9a55-3a1f6c2d9e10"
	approverID := "0c7d2a52-5f3e-4d8b-8c1a-9b2e4f6a7d31"

	tests := []struct {
		name     string
		typ      string
		deviceID string
		meta     map[string]string
	}{
		{"recovery key set", RecoveryKeySet, deviceID, map[string]string{}},
		{"backup uploaded", BackupUploaded, deviceID, map[string]string{"record_count": "12"}},
		{"backup restored by recovery code", BackupRestored, deviceID, map[string]string{"method": "recovery_code"}},
		{"backup restored by device approval", BackupRestored, deviceID, map[string]string{"method": "device_approval"}},
		{"device approved by recovery code", DeviceApproved, deviceID, map[string]string{"method": "recovery_code"}},
		{"device approved by device approval", DeviceApproved, deviceID, map[string]string{"method": "device_approval", "approver_device_id": approverID}},
		{"device rejected", DeviceRejected, deviceID, map[string]string{"method": "device_approval", "approver_device_id": approverID}},
		{"backup reset", BackupReset, deviceID, map[string]string{"method": "email_code"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateEvent(Event{
				Type:     tt.typ,
				DeviceID: tt.deviceID,
				At:       time.Now(),
				Meta:     tt.meta,
			})
			if err != nil {
				t.Fatalf("expected nil error, got: %v", err)
			}
		})
	}
}
