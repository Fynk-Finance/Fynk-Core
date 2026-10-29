package reset_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/reset"
	identity "github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

var now = time.Date(2026, 10, 29, 12, 0, 0, 0, time.UTC)

// fake is every port of the service over shared state, with one failure switch per step.
type fake struct {
	status    string // caller device status
	getErr    error
	resetAt   time.Time
	hasReset  bool
	resetErr  error
	start     time.Time
	hasSess   bool
	sessErr   error
	deleteErr error
	removeErr error
	actErr    error
	auditErr  error

	deleted, removed, activated int
	events                      []audit.Event
	order                       []string
}

func (f *fake) Get(context.Context, string, string) (identity.DeviceInfo, error) {
	return identity.DeviceInfo{ID: "d-new", Status: f.status}, f.getErr
}
func (f *fake) RemoveOthers(_ context.Context, _, keep string) error {
	f.order = append(f.order, "remove")
	if f.removeErr != nil {
		return f.removeErr
	}
	f.removed++
	return nil
}
func (f *fake) ActivateDevice(context.Context, string) error {
	f.order = append(f.order, "activate")
	if f.actErr != nil {
		return f.actErr
	}
	f.activated++
	f.status = "active"
	return nil
}
func (f *fake) EmailResetAt(context.Context, string) (time.Time, bool, error) {
	return f.resetAt, f.hasReset, f.resetErr
}
func (f *fake) SessionStart(context.Context, string, string) (time.Time, bool, error) {
	return f.start, f.hasSess, f.sessErr
}
func (f *fake) DeleteBackup(context.Context, string) error {
	f.order = append(f.order, "delete")
	if f.deleteErr != nil {
		return f.deleteErr
	}
	f.deleted++
	return nil
}
func (f *fake) Record(_ context.Context, e audit.Event) error {
	f.order = append(f.order, "audit")
	if f.auditErr != nil {
		return f.auditErr
	}
	f.events = append(f.events, e)
	return nil
}

// good is a pending caller with a reset 2 minutes ago and a session that started after it.
func good() *fake {
	return &fake{status: "pending", resetAt: now.Add(-2 * time.Minute), hasReset: true,
		start: now.Add(-time.Minute), hasSess: true}
}

func run(f *fake, u auth.User) error {
	s := reset.NewService(f, f, f, f, f, clock.NewFixed(now), f)
	return s.Reset(context.Background(), u)
}

var caller = auth.User{ID: "u1", DeviceID: "d-new", SessionID: "sid-1"}

func TestNotAllowed(t *testing.T) {
	cases := map[string]func(*fake){
		"never reset":              func(f *fake) { f.hasReset = false },
		"reset 11 minutes ago":     func(f *fake) { f.resetAt = now.Add(-11 * time.Minute); f.start = now.Add(-time.Minute) },
		"reset in the future":      func(f *fake) { f.resetAt = now.Add(2 * time.Minute); f.start = now.Add(3 * time.Minute) },
		"session before reset":     func(f *fake) { f.start = f.resetAt.Add(-2 * time.Minute) },
		"session not found":        func(f *fake) { f.hasSess = false },
		"user missing for reset":   func(f *fake) { f.resetErr = identity.ErrNotFound },
		"user missing for session": func(f *fake) { f.sessErr = identity.ErrNotFound },
	}
	for name, mut := range cases {
		t.Run(name, func(t *testing.T) {
			f := good()
			mut(f)
			if err := run(f, caller); !errors.Is(err, reset.ErrNotAllowed) {
				t.Fatalf("err = %v, want ErrNotAllowed", err)
			}
			if len(f.order) != 0 {
				t.Fatalf("steps ran: %v", f.order)
			}
		})
	}
	t.Run("no session id", func(t *testing.T) {
		f := good()
		if err := run(f, auth.User{ID: "u1", DeviceID: "d-new"}); !errors.Is(err, reset.ErrNotAllowed) {
			t.Fatalf("err = %v", err)
		}
	})
}

func TestEdgesOfTheWindowAreAllowed(t *testing.T) {
	for name, mut := range map[string]func(*fake){
		"exactly 10 minutes":      func(f *fake) { f.resetAt = now.Add(-reset.Window); f.start = now.Add(-time.Minute) },
		"reset within skew ahead": func(f *fake) { f.resetAt = now.Add(reset.Skew); f.start = now },
		"session within skew":     func(f *fake) { f.start = f.resetAt.Add(-reset.Skew) },
		"session right at reset":  func(f *fake) { f.start = f.resetAt },
	} {
		t.Run(name, func(t *testing.T) {
			f := good()
			mut(f)
			if err := run(f, caller); err != nil {
				t.Fatalf("err = %v", err)
			}
		})
	}
}

func TestNotActive(t *testing.T) {
	for name, mut := range map[string]func(*fake){
		"removed":    func(f *fake) { f.getErr = identity.ErrRemoved },
		"unknown":    func(f *fake) { f.getErr = identity.ErrNotFound },
		"odd status": func(f *fake) { f.status = "blocked" },
	} {
		t.Run(name, func(t *testing.T) {
			f := good()
			mut(f)
			if err := run(f, caller); !errors.Is(err, reset.ErrNotActive) {
				t.Fatalf("err = %v", err)
			}
			if len(f.order) != 0 {
				t.Fatalf("steps ran: %v", f.order)
			}
		})
	}
	if err := run(good(), auth.User{ID: "u1", SessionID: "s"}); !errors.Is(err, reset.ErrNotActive) {
		t.Fatalf("no device id: %v", err)
	}
}

func TestPendingCallerIsReset(t *testing.T) {
	f := good()
	if err := run(f, caller); err != nil {
		t.Fatal(err)
	}
	if got := strings.Join(f.order, ","); got != "delete,remove,activate,audit" {
		t.Fatalf("order = %s", got)
	}
	if len(f.events) != 1 {
		t.Fatalf("events = %v", f.events)
	}
	e := f.events[0]
	if e.Type != "backup.reset" || e.UserID != "u1" || e.DeviceID != "d-new" || !e.At.Equal(now) ||
		len(e.Meta) != 1 || e.Meta["method"] != "email_code" {
		t.Fatalf("event = %+v", e)
	}
}

func TestActiveCallerIsNotActivatedAgain(t *testing.T) {
	f := good()
	f.status = "active"
	if err := run(f, caller); err != nil {
		t.Fatal(err)
	}
	if f.activated != 0 || f.deleted != 1 || f.removed != 1 || len(f.events) != 1 {
		t.Fatalf("state = %+v", f)
	}
}

func TestEachFailureReturnsTheErrorAndARetryCompletes(t *testing.T) {
	boom := errors.New("boom")
	for name, set := range map[string]func(*fake, error){
		"delete":   func(f *fake, e error) { f.deleteErr = e },
		"remove":   func(f *fake, e error) { f.removeErr = e },
		"activate": func(f *fake, e error) { f.actErr = e },
		"audit":    func(f *fake, e error) { f.auditErr = e },
	} {
		t.Run(name, func(t *testing.T) {
			f := good()
			set(f, boom)
			if err := run(f, caller); !errors.Is(err, boom) {
				t.Fatalf("err = %v, want boom", err)
			}
			set(f, nil)
			if err := run(f, caller); err != nil {
				t.Fatalf("retry: %v", err)
			}
			if len(f.events) != 1 || f.status != "active" || f.deleted < 1 || f.removed < 1 {
				t.Fatalf("after retry: %+v", f)
			}
		})
	}
}

func TestPortErrorsAreReturnedNotMasked(t *testing.T) {
	boom := errors.New("kc down")
	for name, mut := range map[string]func(*fake){
		"device":  func(f *fake) { f.getErr = boom },
		"reset":   func(f *fake) { f.resetErr = boom },
		"session": func(f *fake) { f.sessErr = boom },
	} {
		t.Run(name, func(t *testing.T) {
			f := good()
			mut(f)
			if err := run(f, caller); !errors.Is(err, boom) {
				t.Fatalf("err = %v", err)
			}
		})
	}
}

func TestErrorsCarryNoPersonalData(t *testing.T) {
	f := good()
	f.hasReset = false
	err := run(f, auth.User{ID: "user-secret", DeviceID: "d-new", SessionID: "sid-secret"})
	if err == nil || strings.Contains(err.Error(), "secret") {
		t.Fatalf("err = %v", err)
	}
}
