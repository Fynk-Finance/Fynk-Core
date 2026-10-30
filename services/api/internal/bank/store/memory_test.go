package store

import (
	"fmt"
	"testing"
)

func TestMemoryStore(t *testing.T) {
	testStore(t, NewMemory(), func(n int) string { return fmt.Sprintf("id-%d", n) })
}
