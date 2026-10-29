package reference

import (
	"bytes"
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ErrFormat means the published file did not have a date column and a 360 day column.
var ErrFormat = errors.New("unexpected reference file format")

// ParseCSV reads a Banrep weekly rates table: a header with a date column ("fecha", "semana" or
// "periodo") and one column per term ("CDT 360 días"), separated by ";" or ",", with a decimal
// comma or point. It returns the last row with a value for the term.
func ParseCSV(data []byte, termDays int) (Rate, error) {
	data = bytes.TrimPrefix(data, []byte("\xef\xbb\xbf"))
	firstLine, _, _ := bytes.Cut(data, []byte("\n"))
	sep := ','
	if bytes.Count(firstLine, []byte(";")) > bytes.Count(firstLine, []byte(",")) {
		sep = ';'
	}
	r := csv.NewReader(bytes.NewReader(data))
	r.Comma = sep
	r.FieldsPerRecord = -1
	rows, err := r.ReadAll()
	if err != nil || len(rows) < 2 {
		return Rate{}, ErrFormat
	}
	dateCol, termCol := -1, -1
	term := fmt.Sprint(termDays)
	for i, h := range rows[0] {
		h = strings.ToLower(strings.TrimSpace(h))
		switch {
		case dateCol < 0 && (strings.Contains(h, "fecha") || strings.Contains(h, "semana") || strings.Contains(h, "periodo")):
			dateCol = i
		case termCol < 0 && strings.Contains(h, term):
			termCol = i
		}
	}
	if dateCol < 0 || termCol < 0 {
		return Rate{}, ErrFormat
	}
	var best Rate
	found := false
	for _, row := range rows[1:] {
		if len(row) <= dateCol || len(row) <= termCol {
			continue
		}
		week, err := parseDate(row[dateCol])
		if err != nil {
			continue
		}
		bps, err := PercentToBps(row[termCol])
		if err != nil {
			continue
		}
		if !found || week.After(best.Week) {
			best = Rate{Week: week, TermDays: termDays, RateEaBps: bps}
			found = true
		}
	}
	if !found {
		return Rate{}, ErrFormat
	}
	return best, nil
}

func parseDate(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	for _, layout := range []string{"2006-01-02", "02/01/2006", "2/1/2006", "2006/01/02"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, ErrFormat
}

// PercentToBps turns "10,85", "10.85" or "10,85 %" into 1085 without floating point.
func PercentToBps(s string) (int, error) {
	s = strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(s), "%"))
	s = strings.ReplaceAll(s, ",", ".")
	whole, frac, _ := strings.Cut(s, ".")
	if whole == "" || len(whole) > 3 {
		return 0, ErrFormat
	}
	frac = (frac + "00")[:2]
	n := 0
	for _, c := range whole + frac {
		if c < '0' || c > '9' {
			return 0, ErrFormat
		}
		n = n*10 + int(c-'0')
	}
	if n <= 0 || n > 10000 {
		return 0, ErrFormat
	}
	return n, nil
}

// HTTPFetcher downloads the published CSV.
type HTTPFetcher struct {
	URL    string
	Client *http.Client
}

// Fetch implements Fetcher.
func (f HTTPFetcher) Fetch(ctx context.Context, termDays int) (Rate, error) {
	if f.URL == "" {
		return Rate{}, ErrUnavailable
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, f.URL, nil)
	if err != nil {
		return Rate{}, err
	}
	client := f.Client
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return Rate{}, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return Rate{}, fmt.Errorf("banrep: status %d", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return Rate{}, err
	}
	rate, err := ParseCSV(data, termDays)
	if err != nil {
		return Rate{}, err
	}
	rate.SourceURL = f.URL
	return rate, nil
}
