//go:build bedrock

// Live check of the recommendations against the real Bedrock model (SCRUM-38, criterion
// "revisión manual de 20 respuestas en staging"). It is not part of `make test`: it needs AWS
// credentials with bedrock:InvokeModel and costs a few cents. Run it from services/api:
//
//	AWS_REGION=us-east-2 go test -tags bedrock -run TestLiveBedrock -count=1 -v \
//	  ./internal/recommendations/ -args -report=../../docs/qa/bedrock-live-report.md
//
// Every answer goes through the same post checks as POST /recommendations. The report lists,
// for each run, the snapshot fixture, the raw text of the model, whether the checks accepted it
// and the text the phone would show, so a person can read the 20 answers and mark them.
package recommendations

import (
	"bytes"
	"context"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/recommendations/advisor"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/recommendations/bedrock"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/recommendations/prompt"
)

var (
	liveRuns   = flag.Int("runs", 4, "runs per fixture (5 fixtures × 4 = 20 answers)")
	liveModel  = flag.String("model", "amazon.nova-lite-v1:0", "Bedrock model id")
	liveReport = flag.String("report", "", "Markdown file for the report (stdout only when empty)")
)

// recorder keeps the raw text of every model call, also the ones the checks reject.
type recorder struct {
	model advisor.Model
	calls []call
}

type call struct {
	text   string
	err    error
	tokens string
	took   time.Duration
}

func (r *recorder) Generate(ctx context.Context, req advisor.ModelRequest) (advisor.ModelResponse, error) {
	started := time.Now()
	resp, err := r.model.Generate(ctx, req)
	r.calls = append(r.calls, call{
		text:   resp.Text,
		err:    err,
		tokens: fmt.Sprintf("%d in, %d out", resp.InputTokens, resp.OutputTokens),
		took:   time.Since(started),
	})
	return resp, err
}

func TestLiveBedrock(t *testing.T) {
	ctx := context.Background()
	awsCfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		t.Fatalf("AWS credentials: %v (run aws configure first)", err)
	}
	if awsCfg.Region == "" {
		awsCfg.Region = "us-east-2" // the region of the project (infra/terraform/envs/staging)
	}
	fixtures, err := filepath.Glob(filepath.Join("advisor", "testdata", "*.json"))
	if err != nil || len(fixtures) == 0 {
		t.Fatalf("no fixtures in advisor/testdata: %v", err)
	}

	rec := &recorder{model: bedrock.New(bedrockruntime.NewFromConfig(awsCfg), *liveModel)}
	svc := advisor.NewService(rec, nil, advisor.Prompt{Version: prompt.Version(), System: prompt.SystemES()},
		advisor.DefaultConfig(*liveModel), time.Now, slog.New(slog.NewTextHandler(io.Discard, nil)))

	var report strings.Builder
	fmt.Fprintf(&report, "# Bedrock live check, %s\n\n", time.Now().Format("2006-01-02 15:04"))
	fmt.Fprintf(&report, "Model `%s`, region `%s`, prompt `%s`, %d runs per fixture.\n\n",
		*liveModel, awsCfg.Region, prompt.Version(), *liveRuns)
	report.WriteString("Mark each answer: [ ] correct numbers, [ ] clear Spanish, [ ] no product advice.\n\n")

	accepted, total := 0, 0
	for _, path := range fixtures {
		raw, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		req, _, err := advisor.Decode(bytes.NewReader(raw))
		if err != nil {
			t.Fatalf("%s: %v", path, err)
		}
		name := strings.TrimSuffix(filepath.Base(path), ".json")
		for run := 1; run <= *liveRuns; run++ {
			total++
			before := len(rec.calls)
			res, err := svc.Generate(ctx, "live-check", req)
			if err != nil {
				t.Fatalf("%s run %d: %v", name, run, err)
			}
			if !res.Fallback {
				accepted++
			}
			fmt.Fprintf(&report, "## %s, run %d: %s\n\n", name, run, verdict(res.Fallback))
			for i, c := range rec.calls[before:] {
				fmt.Fprintf(&report, "Attempt %d (%s, %s)", i+1, c.took.Round(time.Millisecond), c.tokens)
				if c.err != nil {
					fmt.Fprintf(&report, ": error %v\n\n", c.err)
					continue
				}
				fmt.Fprintf(&report, ":\n\n```json\n%s\n```\n\n", strings.TrimSpace(c.text))
			}
			if !res.Fallback {
				fmt.Fprintf(&report, "Shown on the phone:\n\n> %s\n", res.Summary)
				for _, s := range res.Steps {
					fmt.Fprintf(&report, ">\n> **%s**: %s\n", s.Title, s.Text)
				}
				report.WriteString("\n")
			}
		}
	}
	fmt.Fprintf(&report, "---\n\n%d of %d answers passed the checks; the rest used the phone templates.\n",
		accepted, total)

	failed := 0
	for _, c := range rec.calls {
		if c.err != nil {
			failed++
		}
	}
	if failed == len(rec.calls) {
		t.Fatalf("every call to Bedrock failed, check the credentials, the region and the access to the model: %v",
			rec.calls[0].err)
	}

	t.Log("\n" + report.String())
	if *liveReport != "" {
		if err := os.WriteFile(*liveReport, []byte(report.String()), 0o644); err != nil {
			t.Fatal(err)
		}
		t.Logf("report written to %s", *liveReport)
	}
}

func verdict(fallback bool) string {
	if fallback {
		return "rejected by the checks, the phone shows its templates"
	}
	return "accepted"
}
