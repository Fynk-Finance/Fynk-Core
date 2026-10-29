package prompt

import (
	"strings"
	"testing"
)

func TestPromptIsVersionedAndStatesTheRules(t *testing.T) {
	if v := Version(); v == "unversioned" || v == "" {
		t.Fatalf("system.es.md must start with a version line, got %q", v)
	}
	s := SystemES()
	if strings.Contains(s, "<!-- version") {
		t.Fatal("the version line must not reach the model")
	}
	for _, rule := range []string{"no calculas", "Prohibido", "productos de inversión", "Prometer rentabilidad", "Responde solo con el JSON"} {
		if !strings.Contains(s, rule) {
			t.Errorf("prompt is missing %q", rule)
		}
	}
}
