package clock

import (
	"testing"
	"time"
)

func TestSystemIsUTC(t *testing.T) {
	if loc := (System{}).Now().Location(); loc != time.UTC {
		t.Fatalf("location = %v, want UTC", loc)
	}
}

func TestFixedMovesOnlyWhenTold(t *testing.T) {
	start := time.Date(2026, 10, 26, 15, 0, 0, 0, time.UTC)
	c := NewFixed(start)
	if !c.Now().Equal(start) {
		t.Fatalf("Now = %v", c.Now())
	}
	c.Advance(time.Minute)
	if !c.Now().Equal(start.Add(time.Minute)) {
		t.Fatalf("after Advance, Now = %v", c.Now())
	}
	later := time.Date(2027, 6, 30, 0, 0, 0, 0, time.UTC)
	c.Set(later)
	if !c.Now().Equal(later) {
		t.Fatalf("after Set, Now = %v", c.Now())
	}
}
