package audit

import (
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
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
	ports.AuthLogin: {
		"ip": true, "user_agent": true, "auth_method": true, "status": true,
	},
	ports.AuthLoginFailed: {
		"ip": true, "user_agent": true, "reason": true, "error_code": true, "status": true,
	},
	ports.AuthPasswordReset: {
		"ip": true, "user_agent": true, "status": true,
	},
	ports.DeviceRegistered: {
		"platform": true, "status": true, "app_version": true, "model": true, "os_version": true,
	},
	ports.DeviceApproved: {
		"approver_device_id": true, "status": true, "method": true,
	},
	ports.DeviceRejected: {
		"reason": true, "status": true,
	},
	ports.DeviceRemoved: {
		"reason": true, "status": true, "self": true, "initiator": true,
	},
	ports.ConsentCreated: {
		"provider": true, "institution_id": true, "scopes": true, "consent_id": true,
	},
	ports.ConsentGranted: {
		"provider": true, "institution_id": true, "scopes": true, "consent_id": true,
	},
	ports.ConsentRevoked: {
		"provider": true, "institution_id": true, "reason": true, "consent_id": true,
	},
	ports.ConsentExpired: {
		"provider": true, "institution_id": true, "consent_id": true,
	},
	ports.BankLinkCreated: {
		"provider": true, "institution_id": true, "link_id": true, "status": true,
	},
	ports.BankSync: {
		"provider": true, "institution_id": true, "accounts_count": true, "tx_count": true, "duration_ms": true, "status": true,
	},
	ports.BankSyncFailed: {
		"provider": true, "institution_id": true, "error_code": true, "reason": true, "duration_ms": true, "status": true,
	},
	ports.BankTokenRefreshed: {
		"provider": true, "institution_id": true, "status": true,
	},
	ports.BackupUploaded: {
		"size_bytes": true, "record_count": true, "version": true, "checksum": true, "status": true,
	},
	ports.BackupRestored: {
		"size_bytes": true, "record_count": true, "version": true, "status": true,
	},
	ports.RecoveryKeySet: {
		"status": true, "key_version": true,
	},
	ports.PrivacyDeletionRequested: {
		"request_id": true, "reason": true, "status": true,
	},
	ports.PrivacyDeletionCompleted: {
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
func ValidateEvent(e ports.Event) error {
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
