package ports

import (
	"testing"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/token"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

// The checker builds without touching the pool, so a nil pool must not panic.
func TestNewDeviceCheckerBuildsWithoutPool(t *testing.T) {
	if !isChecker(NewDeviceChecker(nil, clock.System{})) {
		t.Fatal("NewDeviceChecker returned nil")
	}
}

func isChecker(c token.DeviceChecker) bool { return c != nil }
