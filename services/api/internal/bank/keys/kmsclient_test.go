package keys

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/kms"
)

// fakeKMSEndpoint answers the KMS JSON protocol (X-Amz-Target TrentService.*) and records the
// operation and the body of each request.
func fakeKMSEndpoint(t *testing.T, reply map[string]any, status int) (*kms.Client, *[]map[string]any, *[]string) {
	t.Helper()
	var bodies []map[string]any
	var targets []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		targets = append(targets, r.Header.Get("X-Amz-Target"))
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		bodies = append(bodies, body)
		w.Header().Set("Content-Type", "application/x-amz-json-1.1")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(reply)
	}))
	t.Cleanup(srv.Close)
	c := kms.NewFromConfig(aws.Config{
		Region:     "us-east-1",
		HTTPClient: srv.Client(),
		Credentials: aws.CredentialsProviderFunc(func(context.Context) (aws.Credentials, error) {
			return aws.Credentials{AccessKeyID: "test", SecretAccessKey: "test"}, nil
		}),
		RetryMaxAttempts: 1,
	}, func(o *kms.Options) { o.BaseEndpoint = aws.String(srv.URL) })
	return c, &bodies, &targets
}

func b64(b []byte) string { return base64.StdEncoding.EncodeToString(b) }

func TestAWSKMSSignsTheDigestWithPSS(t *testing.T) {
	c, bodies, targets := fakeKMSEndpoint(t, map[string]any{"Signature": b64([]byte("sig"))}, http.StatusOK)
	sig, err := NewAWSKMS(c).SignDigest(context.Background(), "alias/signer", []byte("digest-32-bytes"))
	if err != nil {
		t.Fatal(err)
	}
	if string(sig) != "sig" {
		t.Fatalf("signature = %q", sig)
	}
	got := (*bodies)[0]
	if (*targets)[0] != "TrentService.Sign" || got["KeyId"] != "alias/signer" ||
		got["MessageType"] != "DIGEST" || got["SigningAlgorithm"] != "RSASSA_PSS_SHA_256" ||
		got["Message"] != b64([]byte("digest-32-bytes")) {
		t.Fatalf("request = %s %v", (*targets)[0], got)
	}
}

func TestAWSKMSGeneratesTheHMAC(t *testing.T) {
	c, bodies, targets := fakeKMSEndpoint(t, map[string]any{"Mac": b64([]byte("mac"))}, http.StatusOK)
	mac, err := NewAWSKMS(c).GenerateMac(context.Background(), "alias/fp", []byte("refresh"))
	if err != nil {
		t.Fatal(err)
	}
	if string(mac) != "mac" {
		t.Fatalf("mac = %q", mac)
	}
	got := (*bodies)[0]
	if (*targets)[0] != "TrentService.GenerateMac" || got["KeyId"] != "alias/fp" ||
		got["MacAlgorithm"] != "HMAC_SHA_256" || got["Message"] != b64([]byte("refresh")) {
		t.Fatalf("request = %s %v", (*targets)[0], got)
	}
}

func TestAWSKMSReportsErrorsAndEmptyAnswers(t *testing.T) {
	c, _, _ := fakeKMSEndpoint(t, map[string]any{"__type": "AccessDeniedException", "message": "no"}, http.StatusBadRequest)
	if _, err := NewAWSKMS(c).SignDigest(context.Background(), "k", []byte("d")); err == nil ||
		!strings.Contains(err.Error(), "AccessDenied") {
		t.Fatalf("err = %v, want AccessDeniedException", err)
	}
	empty, _, _ := fakeKMSEndpoint(t, map[string]any{}, http.StatusOK)
	if _, err := NewAWSKMS(empty).SignDigest(context.Background(), "k", []byte("d")); err == nil {
		t.Fatal("want an error for an empty signature")
	}
	if _, err := NewAWSKMS(empty).GenerateMac(context.Background(), "k", []byte("m")); err == nil {
		t.Fatal("want an error for an empty mac")
	}
}
