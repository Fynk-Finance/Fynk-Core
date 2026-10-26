package ports

import (
	"context"
	"errors"
	"testing"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
)

func TestLocalCheckerIsAlwaysActiveInLocal(t *testing.T) {
	var c ConsentChecker = LocalChecker{Env: config.EnvLocal}
	ok, err := c.Active(context.Background(), "u1", "c1")
	if err != nil || !ok {
		t.Fatalf("Active = %v, %v", ok, err)
	}
	if err := c.MarkGranted(context.Background(), "c1", "p1"); err != nil {
		t.Fatalf("MarkGranted: %v", err)
	}
}

func TestLocalCheckerFailsClosedOutsideLocal(t *testing.T) {
	for _, env := range []config.Env{config.EnvStaging, config.EnvProd} {
		c := LocalChecker{Env: env}
		ok, err := c.Active(context.Background(), "u1", "c1")
		if ok || !errors.Is(err, ErrNotImplemented) {
			t.Fatalf("%s: Active = %v, %v", env, ok, err)
		}
		if err := c.MarkGranted(context.Background(), "c1", "p1"); !errors.Is(err, ErrNotImplemented) {
			t.Fatalf("%s: MarkGranted err = %v", env, err)
		}
	}
}
