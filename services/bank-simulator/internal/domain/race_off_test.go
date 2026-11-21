//go:build !race

package domain

// raceEnabled is true when the tests run with -race, which slows the generator about tenfold.
const raceEnabled = false
