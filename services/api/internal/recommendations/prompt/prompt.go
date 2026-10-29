// Package prompt holds the versioned system prompt of the recommendations module.
// A change to system.es.md is a change of behaviour: bump the version line at its top.
package prompt

import (
	_ "embed"
	"regexp"
	"strings"
)

//go:embed system.es.md
var systemES string

var versionLine = regexp.MustCompile(`^<!-- version: ([0-9a-z.\-]+) -->\n`)

// Version is the version written on the first line of system.es.md.
func Version() string {
	if m := versionLine.FindStringSubmatch(systemES); m != nil {
		return m[1]
	}
	return "unversioned"
}

// SystemES is the system prompt in Spanish, without the version line.
func SystemES() string {
	return strings.TrimSpace(versionLine.ReplaceAllString(systemES, ""))
}
