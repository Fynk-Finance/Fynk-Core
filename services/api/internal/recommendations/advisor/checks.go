package advisor

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"
)

// Output is what the model must write (JSON).
type Output struct {
	Summary string `json:"summary"`
	Steps   []Step `json:"steps"`
}

// Step is the text of one opportunity, matched by factKey on the phone.
type Step struct {
	FactKey string `json:"factKey"`
	Title   string `json:"title"`
	Text    string `json:"text"`
}

const (
	maxSummaryRunes = 400
	maxTitleRunes   = 40
	maxTextRunes    = 160
)

// ErrUnsafeOutput is returned when the model's text fails a post check.
var ErrUnsafeOutput = errors.New("unsafe model output")

func unsafe(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrUnsafeOutput, fmt.Sprintf(format, args...))
}

var (
	// "$56.800", "$ 1.930.600", "$45.000,50". Thousands with dots, as on screen.
	moneyPattern = regexp.MustCompile(`\$\s?(\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?`)
	// "30 %", "30%", "4,6 %".
	percentPattern = regexp.MustCompile(`(\d+(?:[.,]\d+)?)\s?%`)
	// Ticker-like words: 2 to 5 capital letters, or a $TICKER.
	tickerPattern = regexp.MustCompile(`\$[A-Z]{1,5}\b|\b[A-Z]{2,5}\b`)
	codeFence     = regexp.MustCompile("(?s)^\\s*```(?:json)?\\s*(.*?)\\s*```\\s*$")
)

// Capitalized abbreviations that are not tickers in Spanish text.
var allowedUpper = set("CDT", "CDTS", "COP", "IA", "EA", "E.A", "OK", "PSE", "IVA", "ATM")

// forbidden holds lowercase phrases without accents. They name products, issuers or promises of
// returns, which Fynk must never write (Decreto 2555, CLAUDE.md Regulatory guardrails).
var forbidden = []string{
	"invertir en", "invierte en", "compra acciones", "compre acciones", "comprar acciones",
	"cdt de", "fondo de inversion", "fiducuenta", "etf", "bitcoin", "cripto", "acciones de",
	"rentabilidad garantizada", "garantizado", "garantizada", "garantiza", "sin riesgo",
	"te conviene", "deberias invertir", "mejor inversion",
	// Banks and wallets of Colombia: the model never names an issuer.
	"bancolombia", "davivienda", "bbva", "banco de bogota", "banco popular", "banco de occidente",
	"av villas", "banco caja social", "scotiabank", "colpatria", "itau", "banco agrario",
	"bancoomeva", "banco falabella", "banco pichincha", "gnb sudameris", "banco w", "lulo bank",
	"nubank", "nequi", "daviplata", "rappipay", "banco demo", "billetera demo", "skandia",
	"porvenir", "proteccion", "colfondos", //nolint:misspell // Spanish pension fund name
}

// accents maps the accented letters of Spanish to plain ones (ñ stays).
var accents = strings.NewReplacer("á", "a", "é", "e", "í", "i", "ó", "o", "ú", "u", "ü", "u")

// fold lowercases and strips accents, so "Inversión" and "inversion" compare equal.
func fold(s string) string {
	return accents.Replace(strings.ToLower(s))
}

// ParseOutput reads the model's JSON, with or without a ```json fence.
func ParseOutput(text string) (Output, error) {
	text = strings.TrimSpace(text)
	if m := codeFence.FindStringSubmatch(text); m != nil {
		text = m[1]
	}
	dec := json.NewDecoder(strings.NewReader(text))
	dec.DisallowUnknownFields()
	var out Output
	if err := dec.Decode(&out); err != nil {
		return Output{}, unsafe("not the output schema")
	}
	return out, nil
}

// allowedNumbers lists every peso amount and percent the text may mention: the values of the
// snapshot, and percents that follow directly from them (a category's change, a goal's progress,
// a cap's use). Anything else is a number the model made up.
func allowedNumbers(s Snapshot) (pesos map[int64]bool, percents map[int64]bool) {
	pesos = map[int64]bool{}
	percents = map[int64]bool{}
	addMinor := func(minor int64) {
		if minor < 0 {
			minor = -minor
		}
		// Whole pesos, half away from zero, like formatCop on the phone.
		pesos[(minor+50)/100] = true
	}
	addPercent := func(num, den int64, floor bool) {
		if den <= 0 {
			return
		}
		p := num * 100
		if floor {
			percents[abs(p/den)] = true
			return
		}
		percents[abs(roundDiv(p, den))] = true
	}
	for _, v := range s.MonthlyIncomeMinor {
		addMinor(v)
	}
	for _, v := range s.MonthlySpendMinor {
		addMinor(v)
	}
	for i := 1; i < len(s.MonthlySpendMinor); i++ {
		addPercent(s.MonthlySpendMinor[i]-s.MonthlySpendMinor[i-1], s.MonthlySpendMinor[i-1], false)
	}
	for _, c := range s.SpendByCategory {
		addMinor(c.Last30dMinor)
		addMinor(c.Prev30dMinor)
		addMinor(c.Last30dMinor - c.Prev30dMinor)
		addPercent(c.Last30dMinor-c.Prev30dMinor, c.Prev30dMinor, false)
	}
	for _, r := range s.RecurringIncome {
		addMinor(r.MonthlyMinor)
	}
	addMinor(s.FixedExpensesMonthlyMinor)
	addMinor(s.Subscriptions.MonthlyMinor)
	addMinor(s.Subscriptions.LowUseMonthlyMinor)
	for _, g := range s.Goals {
		addMinor(g.TargetMinor)
		addMinor(g.SavedMinor)
		addMinor(g.TargetMinor - g.SavedMinor)
		addPercent(g.SavedMinor, g.TargetMinor, false)
	}
	for _, c := range s.Caps {
		addMinor(c.CapMinor)
		addMinor(c.SpentMinor)
		addPercent(c.SpentMinor, c.CapMinor, true)
	}
	for _, o := range s.Opportunities {
		addMinor(o.MonthlyMinor)
	}
	return pesos, percents
}

func abs(v int64) int64 {
	if v < 0 {
		return -v
	}
	return v
}

// roundDiv divides rounding half away from zero.
func roundDiv(num, den int64) int64 {
	if (num < 0) != (den < 0) {
		return -((abs(num) + abs(den)/2) / abs(den))
	}
	return (abs(num) + abs(den)/2) / abs(den)
}

func checkText(field, text string, maxRunes int, pesos, percents map[int64]bool) error {
	if strings.TrimSpace(text) == "" {
		return unsafe("%s is empty", field)
	}
	if utf8.RuneCountInString(text) > maxRunes {
		return unsafe("%s is too long", field)
	}
	folded := fold(text)
	for _, phrase := range forbidden {
		if containsWord(folded, phrase) {
			return unsafe("%s names a product, issuer or promise", field)
		}
	}
	for _, word := range tickerPattern.FindAllString(text, -1) {
		if !allowedUpper[strings.TrimPrefix(word, "$")] {
			return unsafe("%s has a ticker-like word", field)
		}
	}
	for _, m := range moneyPattern.FindAllStringSubmatch(text, -1) {
		v, err := strconv.ParseInt(strings.ReplaceAll(m[1], ".", ""), 10, 64)
		if err != nil || !pesos[v] {
			return unsafe("%s mentions an amount that is not in the snapshot", field)
		}
	}
	for _, m := range percentPattern.FindAllStringSubmatch(text, -1) {
		if strings.ContainsAny(m[1], ".,") {
			return unsafe("%s mentions a percent that is not in the snapshot", field)
		}
		v, err := strconv.ParseInt(m[1], 10, 64)
		if err != nil || !percents[v] {
			return unsafe("%s mentions a percent that is not in the snapshot", field)
		}
	}
	return nil
}

// containsWord reports whether phrase appears in s on word boundaries.
func containsWord(s, phrase string) bool {
	for i := 0; ; {
		j := strings.Index(s[i:], phrase)
		if j < 0 {
			return false
		}
		start, end := i+j, i+j+len(phrase)
		before := start == 0 || !isWordByte(s[start-1])
		after := end == len(s) || !isWordByte(s[end])
		if before && after {
			return true
		}
		i = start + 1
	}
}

func isWordByte(b byte) bool {
	return b == '_' || (b >= 'a' && b <= 'z') || (b >= '0' && b <= '9') || b >= 0x80
}

// Check runs every post check on the model's output: schema, known factKeys, numbers that exist
// in the snapshot, and no product, issuer, ticker or promise of returns.
func Check(out Output, req Request) error {
	pesos, percents := allowedNumbers(req.Snapshot)
	if err := checkText("summary", out.Summary, maxSummaryRunes, pesos, percents); err != nil {
		return err
	}
	wanted := set(req.FactKeys...)
	seen := map[string]bool{}
	for _, st := range out.Steps {
		if !wanted[st.FactKey] {
			return unsafe("unknown factKey")
		}
		if seen[st.FactKey] {
			return unsafe("repeated factKey")
		}
		seen[st.FactKey] = true
		if err := checkText("title", st.Title, maxTitleRunes, pesos, percents); err != nil {
			return err
		}
		if err := checkText("text", st.Text, maxTextRunes, pesos, percents); err != nil {
			return err
		}
	}
	return nil
}
