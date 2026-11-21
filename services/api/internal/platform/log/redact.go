// Package log builds the API logger: JSON lines through a handler that redacts sensitive keys.
// Every log line goes through it (CLAUDE.md, Security rules).
package log

import (
	"context"
	"io"
	"log/slog"
	"strings"
)

// Redacted replaces the value of every sensitive key.
const Redacted = "[REDACTED]"

// sensitiveKeys are compared after lowercasing and turning '-' into '_',
// so "Authorization", "access-token" and "ACCOUNT_NUMBER" all match.
var sensitiveKeys = map[string]struct{}{
	"token":          {},
	"access_token":   {},
	"refresh_token":  {},
	"password":       {},
	"code":           {},
	"email":          {},
	"cedula":         {},
	"amount":         {},
	"account_number": {},
	"authorization":  {},
}

// IsSensitive reports whether a log key must be redacted.
func IsSensitive(key string) bool {
	_, ok := sensitiveKeys[strings.ReplaceAll(strings.ToLower(key), "-", "_")]
	return ok
}

// RedactingHandler wraps another slog.Handler and masks the values of sensitive keys,
// including keys inside groups and values produced by slog.LogValuer.
type RedactingHandler struct {
	next slog.Handler
}

// NewRedactingHandler wraps next.
func NewRedactingHandler(next slog.Handler) *RedactingHandler {
	return &RedactingHandler{next: next}
}

// New returns the API logger: JSON to w, redacted, at the given level.
func New(w io.Writer, level slog.Level) *slog.Logger {
	return slog.New(NewRedactingHandler(slog.NewJSONHandler(w, &slog.HandlerOptions{Level: level})))
}

// Enabled implements slog.Handler.
func (h *RedactingHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.next.Enabled(ctx, level)
}

// Handle implements slog.Handler.
func (h *RedactingHandler) Handle(ctx context.Context, r slog.Record) error {
	clean := slog.NewRecord(r.Time, r.Level, r.Message, r.PC)
	r.Attrs(func(a slog.Attr) bool {
		clean.AddAttrs(redact(a))
		return true
	})
	return h.next.Handle(ctx, clean)
}

// WithAttrs implements slog.Handler.
func (h *RedactingHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	clean := make([]slog.Attr, len(attrs))
	for i, a := range attrs {
		clean[i] = redact(a)
	}
	return &RedactingHandler{next: h.next.WithAttrs(clean)}
}

// WithGroup implements slog.Handler.
func (h *RedactingHandler) WithGroup(name string) slog.Handler {
	return &RedactingHandler{next: h.next.WithGroup(name)}
}

func redact(a slog.Attr) slog.Attr {
	if IsSensitive(a.Key) {
		return slog.String(a.Key, Redacted)
	}
	v := a.Value.Resolve()
	if v.Kind() != slog.KindGroup {
		return slog.Attr{Key: a.Key, Value: v}
	}
	group := v.Group()
	clean := make([]slog.Attr, len(group))
	for i, g := range group {
		clean[i] = redact(g)
	}
	return slog.Attr{Key: a.Key, Value: slog.GroupValue(clean...)}
}
