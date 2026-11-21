package identity

import "strings"

const maskDots = "•••"

// maskEmail hides most of the local part: "camila@correo.com" becomes "ca•••@correo.com".
// It keeps min(2, len(local)-1) characters, at least 1, counted in runes, and the whole domain.
// Anything that is not local@domain gives just the dots.
func maskEmail(email string) string {
	at := strings.LastIndex(email, "@")
	if at <= 0 || at == len(email)-1 {
		return maskDots
	}
	local, domain := []rune(email[:at]), email[at+1:]
	keep := max(1, min(2, len(local)-1))
	return string(local[:keep]) + maskDots + "@" + domain
}
