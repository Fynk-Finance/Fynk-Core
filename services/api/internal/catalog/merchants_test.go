package catalog

import (
	"context"
	"testing"
	"time"
)

type fakeStore struct {
	merchants []Merchant
	err       error
}

func (f fakeStore) List(context.Context) ([]Merchant, error) { return f.merchants, f.err }

func url(s string) *string { return &s }

func sample() []Merchant {
	return []Merchant{
		{Key: "netflix", DisplayName: "Netflix", Category: "subscriptions", IsSubscription: true,
			MatchPatterns: []string{"netflix"}, CancelURL: url("https://www.netflix.com/cancelplan"),
			CancelSteps: []string{"Entra a netflix.com e inicia sesión."},
			UpdatedAt:   time.Date(2026, 11, 5, 15, 0, 0, 0, time.UTC)},
		{Key: "empresa de servicios", DisplayName: "Servicios públicos", Category: "utilities",
			UpdatedAt: time.Date(2026, 11, 1, 15, 0, 0, 0, time.UTC)},
	}
}

func TestTheETagFollowsTheContent(t *testing.T) {
	a, err := Load(context.Background(), fakeStore{merchants: sample()})
	if err != nil {
		t.Fatal(err)
	}
	b, _ := Load(context.Background(), fakeStore{merchants: sample()})
	if a.ETag == "" || a.ETag != b.ETag {
		t.Fatalf("same content, different ETag: %q %q", a.ETag, b.ETag)
	}
	changed := sample()
	changed[0].CancelSteps = []string{"Otro paso."}
	c, _ := Load(context.Background(), fakeStore{merchants: changed})
	if c.ETag == a.ETag {
		t.Fatal("a changed merchant must give a new ETag")
	}
	if !a.UpdatedAt.Equal(time.Date(2026, 11, 5, 15, 0, 0, 0, time.UTC)) {
		t.Fatalf("updatedAt is the newest merchant, got %v", a.UpdatedAt)
	}
}

func TestIfNoneMatch(t *testing.T) {
	etag := `"abc"`
	for header, want := range map[string]bool{
		``:           false,
		`"abc"`:      true,
		`W/"abc"`:    true,
		`"x", "abc"`: true,
		`*`:          true,
		`"other"`:    false,
	} {
		if got := Matches(header, etag); got != want {
			t.Errorf("Matches(%q) = %v, want %v", header, got, want)
		}
	}
}
