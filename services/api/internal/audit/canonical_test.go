package audit

import (
	"bytes"
	"crypto/sha256"
	"testing"
	"time"
)

func TestCanonicalSerializationDeterminism(t *testing.T) {
	at := time.Date(2026, 10, 28, 12, 0, 0, 123456789, time.UTC)

	// Two maps with different key insertion order
	meta1 := map[string]string{
		"status":   "active",
		"platform": "android",
		"version":  "1.0.0",
	}
	meta2 := map[string]string{
		"version":  "1.0.0",
		"platform": "android",
		"status":   "active",
	}

	row1 := BuildCanonicalRow("device.registered", "usr-1", "550e8400-e29b-41d4-a716-446655440000", at, meta1)
	row2 := BuildCanonicalRow("device.registered", "usr-1", "550e8400-e29b-41d4-a716-446655440000", at, meta2)

	bytes1, err := CanonicalJSON(row1)
	if err != nil {
		t.Fatalf("CanonicalJSON row1: %v", err)
	}
	bytes2, err := CanonicalJSON(row2)
	if err != nil {
		t.Fatalf("CanonicalJSON row2: %v", err)
	}

	if !bytes.Equal(bytes1, bytes2) {
		t.Fatalf("expected identical JSON bytes regardless of map insertion order, got:\n%s\nvs\n%s", string(bytes1), string(bytes2))
	}

	// Verify timestamp format is truncated to 6 decimal places (microsecond)
	expectedAt := "2026-10-28T12:00:00.123456Z"
	if row1.At != expectedAt {
		t.Fatalf("expected At %q, got %q", expectedAt, row1.At)
	}
}

func TestComputeHash(t *testing.T) {
	prevHash := make([]byte, 32)
	canonical := []byte(`{"type":"auth.login","user_id":"u1","device_id":"","at":"2026-10-28T12:00:00.000000Z","meta":{}}`)

	expected := sha256.Sum256(append(prevHash, canonical...))
	got := ComputeHash(prevHash, canonical)

	if !bytes.Equal(expected[:], got) {
		t.Fatalf("ComputeHash mismatch: expected %x, got %x", expected, got)
	}
}
