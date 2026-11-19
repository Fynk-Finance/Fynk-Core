package authorize

import "testing"

// The portal login goes back only to a portal page, never to another site.
func TestPortalReturn(t *testing.T) {
	cases := map[string]string{
		"/portal":                     "/portal",
		"/portal/actions":             "/portal/actions",
		"/portal/account?id=acc-1":    "/portal/account?id=acc-1",
		"/portal?notice=ok":           "/portal?notice=ok",
		"//evil.example/portal":       "/portal",
		"https://evil.example/portal": "/portal",
		"/oauth/authorize":            "/portal",
		"/portalx":                    "/portal",
		`/portal/\evil.example`:       "/portal",
		"":                            "/portal",
	}
	for in, want := range cases {
		if got := portalReturn(in); got != want {
			t.Errorf("portalReturn(%q) = %q, want %q", in, got, want)
		}
	}
}
