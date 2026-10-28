package identity

import "testing"

func TestMaskEmail(t *testing.T) {
	for in, want := range map[string]string{
		"camila@correo.com":   "ca•••@correo.com",
		"ana@correo.com":      "an•••@correo.com",
		"ab@correo.com":       "a•••@correo.com",
		"a@correo.com":        "a•••@correo.com",
		"ñandú@correo.com.co": "ña•••@correo.com.co",
		"日本語@correo.com":      "日本•••@correo.com",
		"a@b@correo.com":      "a@•••@correo.com",
		"":                    "•••",
		"sin-arroba":          "•••",
		"@correo.com":         "•••",
		"camila@":             "•••",
	} {
		if got := maskEmail(in); got != want {
			t.Errorf("maskEmail(%q) = %q, want %q", in, got, want)
		}
	}
}
