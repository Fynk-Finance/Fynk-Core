package recommendations

import (
	"bytes"
	"io"
)

// newBody gives the generated server the body the middleware already read.
func newBody(raw []byte) io.ReadCloser { return io.NopCloser(bytes.NewReader(raw)) }
