// Package requestid makes sure every request carries an X-Request-Id (shared contracts, section 1).
package requestid

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"regexp"
)

// Header is the request and response header name.
const Header = "X-Request-Id"

// A client id is reused only when it is short and safe to put in logs.
var valid = regexp.MustCompile(`^[A-Za-z0-9._:-]{1,128}$`)

type ctxKey struct{}

// Middleware reuses a valid incoming X-Request-Id or generates a new one, stores it in the
// context and echoes it in the response.
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get(Header)
		if !valid.MatchString(id) {
			id = newID()
		}
		w.Header().Set(Header, id)
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, id)))
	})
}

// From returns the request id stored by Middleware, or "".
func From(ctx context.Context) string {
	id, _ := ctx.Value(ctxKey{}).(string)
	return id
}

func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b) // crypto/rand.Read never fails on supported platforms
	return hex.EncodeToString(b)
}
