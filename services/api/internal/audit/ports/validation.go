package ports

import (
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

var (
	// ErrUnknownEventType indicates the event type is not in the recognized audit list.
	ErrUnknownEventType = errors.New("audit: unknown event type")
	// ErrSensitiveMetaKey indicates a forbidden sensitive key was detected in metadata.
	ErrSensitiveMetaKey = errors.New("audit: sensitive key prohibited in metadata")
	// ErrDisallowedMetaKey indicates a meta key is not on the allow-list for the event type.
	ErrDisallowedMetaKey = errors.New("audit: meta key not permitted for event type")
	// ErrInvalidDeviceID indicates a non-empty device_id is not a valid UUID.
	ErrInvalidDeviceID = errors.New("audit: invalid device_id UUID")
)

var sensitiveKeySubstrings = []string{
	"amount",
	"email",
	"token",
	"accountnumber",
	"account_number",
	"password",
	"cedula",
	"authorization",
	"card",
	"pan",
	"cvv",
	"secret",
	"jwt",
}

// allowedMetaKeys defines the strict allow-list of metadata keys for each audit event type.
var allowedMetaKeys = map[string]map[string]bool{
	AuthLogin: {
		"ip": true, "user_agent": true, "auth_method": true, "status": true,
	},
	AuthLoginFailed: {
		"ip": true, "user_agent": true, "reason": true, "error_code": true, "status": true,
	},
	AuthPasswordReset: {
		"ip": true, "user_agent": true, "status": true,
	},
	DeviceRegistered: {
		"platform": true, "status": true, "app_version": true, "model": true, "os_version": true,
	},
	DeviceApproved: {
		"approver_device_id": true, "status": true, "method": true,
	},
	DeviceRejected: {
		"reason": true, "status": true, "method": true, "approver_device_id": true,
	},
	DeviceRemoved: {
		"reason": true, "status": true, "self": true, "initiator": true,
	},
	ConsentCreated: {
		"provider": true, "institution_id": true, "scopes": true, "consent_id": true,
	},
	ConsentGranted: {
		"provider": true, "institution_id": true, "scopes": true, "consent_id": true,
	},
	ConsentRevoked: {
		"provider": true, "institution_id": true, "reason": true, "consent_id": true,
	},
	ConsentExpired: {
		"provider": true, "institution_id": true, "consent_id": true,
	},
	BankLinkCreated: {
		"provider": true, "institution_id": true, "link_id": true, "status": true,
	},
	BankSync: {
		"provider": true, "institution_id": true, "accounts_count": true, "tx_count": true, "duration_ms": true, "status": true,
	},
	BankSyncFailed: {
		"provider": true, "institution_id": true, "error_code": true, "reason": true, "duration_ms": true, "status": true,
	},
	BankTokenRefreshed: {
		"provider": true, "institution_id": true, "status": true,
	},
	BackupUploaded: {
		"size_bytes": true, "record_count": true, "version": true, "checksum": true, "status": true,
	},
	BackupRestored: {
		"size_bytes": true, "record_count": true, "version": true, "status": true, "method": true,
	},
	BackupReset: {
		"method": true, "status": true,
	},
	RecoveryKeySet: {
		"status": true, "key_version": true,
	},
	PrivacyDeletionRequested: {
		"request_id": true, "reason": true, "status": true,
	},
	PrivacyDeletionCompleted: {
		"request_id": true, "duration_ms": true, "steps_completed": true, "status": true,
	},
}

// isSensitiveKey returns true if the key contains any prohibited sensitive keywords.
func isSensitiveKey(key string) bool {
	norm := strings.ToLower(strings.TrimSpace(key))
	normNoSpecial := strings.ReplaceAll(strings.ReplaceAll(norm, "_", ""), "-", "")
	for _, sub := range sensitiveKeySubstrings {
		cleanSub := strings.ReplaceAll(strings.ReplaceAll(sub, "_", ""), "-", "")
		if strings.Contains(norm, sub) || strings.Contains(normNoSpecial, cleanSub) {
			return true
		}
	}
	return false
}

// ValidateEvent checks event type, device ID, and metadata keys against security guardrails.
// The audit store runs it on every Record; other modules' tests may call it through this port
// to confirm the events they emit are accepted.
func ValidateEvent(e Event) error {
	allowed, ok := allowedMetaKeys[e.Type]
	if !ok {
		return fmt.Errorf("%w: %q", ErrUnknownEventType, e.Type)
	}

	if e.DeviceID != "" {
		if _, err := uuid.Parse(e.DeviceID); err != nil {
			return fmt.Errorf("%w: %q", ErrInvalidDeviceID, e.DeviceID)
		}
	}

	for k := range e.Meta {
		if isSensitiveKey(k) {
			return fmt.Errorf("%w: key %q contains forbidden sensitive term", ErrSensitiveMetaKey, k)
		}
		if !allowed[k] {
			return fmt.Errorf("%w: key %q not allowed for %q", ErrDisallowedMetaKey, k, e.Type)
		}
	}

	return nil
}
