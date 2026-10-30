package link

import (
	"errors"
	"testing"
)

func TestOnlyTheOwnerOnItsDeviceCanUseAnActiveLink(t *testing.T) {
	l := Link{UserID: "user-a", DeviceID: "device-a", Status: StatusActive}
	cases := map[string]struct {
		user, device string
		status       Status
		want         error
	}{
		"owner on its device":   {"user-a", "device-a", StatusActive, nil},
		"another user":          {"user-b", "device-a", StatusActive, ErrNotFound},
		"the owner elsewhere":   {"user-a", "device-b", StatusActive, ErrNotFound},
		"a revoked link":        {"user-a", "device-a", StatusRevoked, ErrRevoked},
		"another user, revoked": {"user-b", "device-a", StatusRevoked, ErrNotFound},
	}
	for name, c := range cases {
		l.Status = c.status
		if err := l.UsableBy(c.user, c.device); !errors.Is(err, c.want) {
			t.Errorf("%s: got %v, want %v", name, err, c.want)
		}
	}
}
