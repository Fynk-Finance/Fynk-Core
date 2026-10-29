package audit

import (
	"crypto/sha256"
	"encoding/json"
	"time"
)

// TimeFormat is the fixed microsecond-precision UTC format used for canonical event serialization.
const TimeFormat = "2006-01-02T15:04:05.000000Z"

// CanonicalRow represents the deterministic JSON representation of an audit event row.
type CanonicalRow struct {
	Type     string            `json:"type"`
	UserID   string            `json:"user_id"`
	DeviceID string            `json:"device_id"`
	At       string            `json:"at"`
	Meta     map[string]string `json:"meta"`
}

// BuildCanonicalRow constructs a CanonicalRow ensuring non-nil Meta and deterministic timestamp.
func BuildCanonicalRow(eventType, userID, deviceID string, at time.Time, meta map[string]string) CanonicalRow {
	cleanMeta := make(map[string]string, len(meta))
	for k, v := range meta {
		cleanMeta[k] = v
	}
	formattedAt := at.UTC().Truncate(time.Microsecond).Format(TimeFormat)
	return CanonicalRow{
		Type:     eventType,
		UserID:   userID,
		DeviceID: deviceID,
		At:       formattedAt,
		Meta:     cleanMeta,
	}
}

// CanonicalJSON deterministically serializes a CanonicalRow.
// Go's json.Marshal sorts map[string]string keys lexicographically.
func CanonicalJSON(row CanonicalRow) ([]byte, error) {
	if row.Meta == nil {
		row.Meta = map[string]string{}
	}
	return json.Marshal(row)
}

// ComputeHash calculates sha256(prevHash || canonicalJSON).
func ComputeHash(prevHash []byte, canonicalJSON []byte) []byte {
	h := sha256.New()
	h.Write(prevHash)
	h.Write(canonicalJSON)
	return h.Sum(nil)
}
