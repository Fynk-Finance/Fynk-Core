package log

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"strings"
	"testing"
)

func logged(t *testing.T, write func(l *slog.Logger)) (map[string]any, string) {
	t.Helper()
	var buf bytes.Buffer
	write(New(&buf, slog.LevelDebug))
	var line map[string]any
	if err := json.Unmarshal(buf.Bytes(), &line); err != nil {
		t.Fatalf("not one JSON line: %q: %v", buf.String(), err)
	}
	return line, buf.String()
}

func TestRedactsEverySensitiveKey(t *testing.T) {
	keys := []string{
		"token", "access_token", "refresh_token", "password", "code",
		"email", "cedula", "amount", "account_number", "authorization",
	}
	for _, k := range keys {
		t.Run(k, func(t *testing.T) {
			line, raw := logged(t, func(l *slog.Logger) { l.Info("msg", k, "secret-value-123") })
			if line[k] != Redacted {
				t.Fatalf("%s = %v, want %s", k, line[k], Redacted)
			}
			if strings.Contains(raw, "secret-value-123") {
				t.Fatalf("raw line leaks the value: %s", raw)
			}
		})
	}
}

func TestMatchesKeysIgnoringCaseAndDashes(t *testing.T) {
	line, _ := logged(t, func(l *slog.Logger) {
		l.Info("msg", "Authorization", "Bearer x", "ACCESS-TOKEN", "y", "Email", "a@b.co")
	})
	for _, k := range []string{"Authorization", "ACCESS-TOKEN", "Email"} {
		if line[k] != Redacted {
			t.Errorf("%s = %v, want %s", k, line[k], Redacted)
		}
	}
}

func TestKeepsOtherKeys(t *testing.T) {
	line, _ := logged(t, func(l *slog.Logger) { l.Info("msg", "request_id", "r1", "status", 200) })
	if line["request_id"] != "r1" || line["status"] != float64(200) {
		t.Fatalf("unexpected line %v", line)
	}
	if line["msg"] != "msg" {
		t.Fatalf("msg = %v", line["msg"])
	}
}

func TestRedactsInsideGroups(t *testing.T) {
	line, raw := logged(t, func(l *slog.Logger) {
		l.Info("msg", slog.Group("user", "id", "u1", "email", "a@b.co",
			slog.Group("bank", "account_number", "123456789")))
	})
	user := line["user"].(map[string]any)
	if user["id"] != "u1" || user["email"] != Redacted {
		t.Fatalf("user = %v", user)
	}
	if user["bank"].(map[string]any)["account_number"] != Redacted {
		t.Fatalf("bank = %v", user["bank"])
	}
	if strings.Contains(raw, "a@b.co") || strings.Contains(raw, "123456789") {
		t.Fatalf("raw line leaks a value: %s", raw)
	}
}

func TestRedactsAWholeGroupNamedLikeASensitiveKey(t *testing.T) {
	line, _ := logged(t, func(l *slog.Logger) { l.Info("msg", slog.Group("token", "value", "abc")) })
	if line["token"] != Redacted {
		t.Fatalf("token = %v", line["token"])
	}
}

func TestRedactsWithAttrsAndWithGroup(t *testing.T) {
	line, raw := logged(t, func(l *slog.Logger) {
		l.With("password", "p4ss").WithGroup("req").Info("msg", "code", "123456", "path", "/v1/me")
	})
	if line["password"] != Redacted {
		t.Fatalf("password = %v", line["password"])
	}
	req := line["req"].(map[string]any)
	if req["code"] != Redacted || req["path"] != "/v1/me" {
		t.Fatalf("req = %v", req)
	}
	if strings.Contains(raw, "p4ss") || strings.Contains(raw, "123456") {
		t.Fatalf("raw line leaks a value: %s", raw)
	}
}

type account struct{ number string }

func (a account) LogValue() slog.Value {
	return slog.GroupValue(slog.String("account_number", a.number), slog.String("kind", "savings"))
}

func TestRedactsLogValuers(t *testing.T) {
	line, raw := logged(t, func(l *slog.Logger) { l.Info("msg", "account", account{"987654321"}) })
	acc := line["account"].(map[string]any)
	if acc["account_number"] != Redacted || acc["kind"] != "savings" {
		t.Fatalf("account = %v", acc)
	}
	if strings.Contains(raw, "987654321") {
		t.Fatalf("raw line leaks the account number: %s", raw)
	}
}

func TestRespectsTheLevel(t *testing.T) {
	var buf bytes.Buffer
	New(&buf, slog.LevelWarn).Info("hidden")
	if buf.Len() != 0 {
		t.Fatalf("info logged at warn level: %s", buf.String())
	}
}
