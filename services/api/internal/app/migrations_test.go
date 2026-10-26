package app

import (
	"slices"
	"testing"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/migrate"
)

// The schemas of the shared contracts (section 4): one per backend module that stores data.
var contractSchemas = []string{"identity", "backup", "consents", "bank", "catalog", "privacy", "audit", "market"}

func TestMigrationSourcesCoverEverySchemaOnce(t *testing.T) {
	srcs := MigrationSources(All(Deps{}))
	var names []string
	for _, s := range srcs {
		if !migrate.ValidSchema(s.Schema) {
			t.Errorf("schema %q is not a valid schema name", s.Schema)
		}
		if slices.Contains(names, s.Schema) {
			t.Errorf("schema %q listed twice", s.Schema)
		}
		names = append(names, s.Schema)
	}
	for _, want := range contractSchemas {
		if !slices.Contains(names, want) {
			t.Errorf("schema %q of the shared contracts is missing", want)
		}
	}
	// recommendations is a module without a schema (the AI proxy stores nothing).
	extra := slices.DeleteFunc(slices.Clone(names), func(n string) bool { return slices.Contains(contractSchemas, n) })
	if !slices.Equal(extra, []string{"recommendations"}) {
		t.Errorf("sources outside the shared contracts = %v, want [recommendations]", extra)
	}
	for _, s := range srcs {
		if s.Schema != "recommendations" {
			continue
		}
		if ok, _ := migrate.HasSQL(s.FS); ok {
			t.Error("recommendations must not have migrations: the contracts give it no schema")
		}
	}
}
