package audit

import "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"

// The rules live in the audit port (ports.ValidateEvent) so other modules can run the same
// check in their tests. These names keep the store and the importer unchanged.
var (
	ErrUnknownEventType  = ports.ErrUnknownEventType
	ErrSensitiveMetaKey  = ports.ErrSensitiveMetaKey
	ErrDisallowedMetaKey = ports.ErrDisallowedMetaKey
	ErrInvalidDeviceID   = ports.ErrInvalidDeviceID
)

// ValidateEvent checks an event against the audit rules. See ports.ValidateEvent.
func ValidateEvent(e ports.Event) error { return ports.ValidateEvent(e) }
