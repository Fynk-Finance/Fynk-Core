package requestid

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func serve(header string) (string, string) {
	var seen string
	h := Middleware(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		seen = From(r.Context())
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	if header != "" {
		req.Header.Set(Header, header)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return seen, rec.Header().Get(Header)
}

func TestReusesAValidIncomingID(t *testing.T) {
	seen, echoed := serve("abc-123")
	if seen != "abc-123" || echoed != "abc-123" {
		t.Fatalf("seen %q, echoed %q", seen, echoed)
	}
}

func TestGeneratesAnIDWhenMissingOrUnsafe(t *testing.T) {
	for _, in := range []string{"", "has spaces", "line\nbreak", strings.Repeat("a", 129)} {
		seen, echoed := serve(in)
		if len(seen) != 32 || seen != echoed || seen == in {
			t.Fatalf("input %q: seen %q, echoed %q", in, seen, echoed)
		}
	}
}

func TestGeneratedIDsAreUnique(t *testing.T) {
	a, _ := serve("")
	b, _ := serve("")
	if a == b {
		t.Fatal("two requests got the same id")
	}
}

func TestFromWithoutMiddleware(t *testing.T) {
	if got := From(httptest.NewRequest(http.MethodGet, "/", nil).Context()); got != "" {
		t.Fatalf("From = %q, want empty", got)
	}
}
