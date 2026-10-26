package ports

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"testing"
	"time"

	fynklog "github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/log"
)

func TestLogRecorderWritesOneRedactedLine(t *testing.T) {
	var buf bytes.Buffer
	r := NewLogRecorder(fynklog.New(&buf, slog.LevelInfo))
	var _ Recorder = r

	err := r.Record(context.Background(), Event{
		Type:     ConsentGranted,
		UserID:   "u1",
		DeviceID: "d1",
		At:       time.Date(2026, 10, 26, 15, 0, 0, 0, time.UTC),
		Meta:     map[string]string{"consent_id": "c1", "email": "a@b.co", "amount": "520000000"},
	})
	if err != nil {
		t.Fatalf("Record: %v", err)
	}

	if strings.Count(buf.String(), "\n") != 1 {
		t.Fatalf("want one line, got %q", buf.String())
	}
	if strings.Contains(buf.String(), "a@b.co") || strings.Contains(buf.String(), "520000000") {
		t.Fatalf("line leaks a sensitive value: %s", buf.String())
	}
	var line map[string]any
	if err := json.Unmarshal(buf.Bytes(), &line); err != nil {
		t.Fatalf("not JSON: %v", err)
	}
	if line["msg"] != "audit" || line["type"] != "consent.granted" || line["user_id"] != "u1" {
		t.Fatalf("line = %v", line)
	}
	meta := line["meta"].(map[string]any)
	if meta["consent_id"] != "c1" || meta["email"] != fynklog.Redacted {
		t.Fatalf("meta = %v", meta)
	}
}
