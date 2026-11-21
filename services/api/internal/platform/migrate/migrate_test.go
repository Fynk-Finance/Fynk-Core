package migrate

import (
	"context"
	"net/url"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
)

func TestValidSchema(t *testing.T) {
	for _, ok := range []string{"identity", "audit", "bank_demo", "m2"} {
		if !ValidSchema(ok) {
			t.Errorf("ValidSchema(%q) = false, want true", ok)
		}
	}
	for _, bad := range []string{"", "Identity", "1bank", "bank-demo", `audit"; drop`, "a b"} {
		if ValidSchema(bad) {
			t.Errorf("ValidSchema(%q) = true, want false", bad)
		}
	}
}

func TestHasSQL(t *testing.T) {
	cases := map[string]struct {
		fs   fstest.MapFS
		want bool
	}{
		"empty":         {fstest.MapFS{}, false},
		"other files":   {fstest.MapFS{"README.md": {}}, false},
		"nested only":   {fstest.MapFS{"sql/1_a.up.sql": {}}, false},
		"root sql file": {fstest.MapFS{"1_a.up.sql": {}}, true},
	}
	for name, c := range cases {
		got, err := HasSQL(c.fs)
		if err != nil || got != c.want {
			t.Errorf("%s: HasSQL = %v, %v; want %v", name, got, err, c.want)
		}
	}
	if got, err := HasSQL(module.NoMigrations); got || err != nil {
		t.Errorf("HasSQL(NoMigrations) = %v, %v; want false, nil", got, err)
	}
	if got, err := HasSQL(nil); got || err != nil {
		t.Errorf("HasSQL(nil) = %v, %v; want false, nil", got, err)
	}
}

func TestUpSkipsSourcesWithoutSQL(t *testing.T) {
	// No database is reached: the URL is never dialed when there is nothing to run.
	res, err := Up(context.Background(), "postgres://unused", Source{Schema: "consents", FS: module.NoMigrations})
	if err != nil || !res.Skipped || res.Schema != "consents" {
		t.Fatalf("Up = %+v, %v; want skipped consents", res, err)
	}
}

func TestUpRejectsUnsafeSchema(t *testing.T) {
	_, err := Up(context.Background(), "postgres://unused", Source{Schema: "x; drop", FS: fstest.MapFS{"1_a.up.sql": {}}})
	if err == nil || !strings.Contains(err.Error(), "invalid schema") {
		t.Fatalf("Up error = %v, want invalid schema", err)
	}
}

func TestWithSearchPath(t *testing.T) {
	got, err := withSearchPath("postgres://u:p@db:5432/fynk?sslmode=disable", "identity")
	if err != nil {
		t.Fatal(err)
	}
	u, _ := url.Parse(got)
	if u.Query().Get("search_path") != "identity" || u.Query().Get("sslmode") != "disable" {
		t.Errorf("withSearchPath = %q", got)
	}
	_, err = withSearchPath("mysql://u:secret@db/x", "identity")
	if err == nil || strings.Contains(err.Error(), "secret") {
		t.Errorf("withSearchPath error = %v, want an error that hides the URL", err)
	}
}
