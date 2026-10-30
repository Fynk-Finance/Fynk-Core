package bank

import (
	"context"
	"errors"
	"fmt"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/kms"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/adapters/bankdemo"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/egress"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/keys"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/service"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/store"
	consentports "github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
)

// errNotConfigured: the link settings are missing, so no bank can be reached (fails closed).
var errNotConfigured = errors.New("bank: the bank link is not configured")

// newService builds the link service from the module's Deps. Without a database there is
// nothing to serve (tests of other modules). Without the egress, the keys or Banco Demo's
// client the service still runs, but every link answers provider_unavailable.
func newService(d module.Deps) *service.Service {
	if d.DB == nil {
		return nil
	}
	var auths store.Authorizations = store.NewMemoryAuthorizations(d.Clock)
	var limits interface {
		store.Limiter
		store.Nonces
	} = store.NewMemoryLimits(d.Clock)
	if d.Redis != nil {
		auths = store.NewRedisAuthorizations(d.Redis)
		limits = store.NewRedisLimits(d.Redis)
	}
	providers, fingerprints, err := bankDemoProviders(d)
	if err != nil {
		// Logged without the setting values; the paths and ids are not secrets but stay out.
		d.Log.Error("bank link disabled", "error", err)
	}
	return service.New(service.Deps{
		Providers:      providers,
		Pending:        consentports.NewPendingReader(d),
		Consents:       consentports.New(d),
		Links:          store.New(d.DB),
		Authorizations: auths,
		Fingerprints:   fingerprints,
		Limiter:        limits,
		Nonces:         limits,
		Audit:          d.Audit,
		Clock:          d.Clock,
		Log:            d.Log,
		RedirectURI:    d.Config.BankRedirectURI,
	})
}

// bankDemoProviders builds the Banco Demo and Billetera Demo adapters (one simulator behind
// the egress route banco-demo) when every setting is there, and installs the revoker M4 uses.
func bankDemoProviders(d module.Deps) (service.ProviderMap, keys.Fingerprinter, error) {
	c := d.Config
	hasSigner := c.BankSignerKMSKeyID != "" || c.BankSignerKeyFile != ""
	hasFingerprint := c.BankFingerprintKMSKeyID != "" || c.BankFingerprintKeyFile != ""
	if c.EgressURL == "" || !hasSigner || !hasFingerprint ||
		c.BancoDemoClientID == "" || c.BancoDemoIssuer == "" || c.BancoDemoAuthorizeURL == "" {
		return nil, nil, errNotConfigured
	}
	signer, fingerprints, err := bankKeys(d)
	if err != nil {
		return nil, nil, err
	}
	client, err := egress.NewClient(c.EgressCAFile)
	if err != nil {
		return nil, nil, err
	}
	base, err := egress.BaseURL(c.EgressURL, "banco-demo")
	if err != nil {
		return nil, nil, err
	}
	providers := service.ProviderMap{}
	for _, id := range []string{"banco-demo", "billetera-demo"} {
		a, err := bankdemo.New(bankdemo.Config{
			Provider: id, BaseURL: base, ClientID: c.BancoDemoClientID, Audience: c.BancoDemoIssuer,
			AuthorizeURL: c.BancoDemoAuthorizeURL, RedirectURI: c.BankRedirectURI,
			Signer: signer, HTTP: client, Clock: d.Clock,
		})
		if err != nil {
			return nil, nil, fmt.Errorf("bank: %s adapter: %w", id, err)
		}
		providers[id] = a
	}
	ports.InstallRevoker(revoker{providers})
	return providers, fingerprints, nil
}

// loadKMS builds the AWS KMS client from the default chain (AWS_REGION and the ECS task
// role). Tests replace it.
var loadKMS = func(ctx context.Context) (keys.KMS, error) {
	cfg, err := awsconfig.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("bank: AWS config for KMS: %w", err)
	}
	return keys.NewAWSKMS(kms.NewFromConfig(cfg)), nil
}

// bankKeys picks each key: the KMS key when its id is set (AWS), else its local file.
func bankKeys(d module.Deps) (ports.AssertionSigner, keys.Fingerprinter, error) {
	c := d.Config
	var client keys.KMS
	if c.BankSignerKMSKeyID != "" || c.BankFingerprintKMSKeyID != "" {
		var err error
		if client, err = loadKMS(context.Background()); err != nil {
			return nil, nil, err
		}
	}
	var signer ports.AssertionSigner
	var err error
	if c.BankSignerKMSKeyID != "" {
		signer, err = keys.NewKMSSigner(client, c.BankSignerKMSKeyID, c.BancoDemoClientID, d.Clock)
	} else {
		signer, err = keys.LoadLocalSigner(c.BankSignerKeyFile, c.BancoDemoClientID, d.Clock)
	}
	if err != nil {
		return nil, nil, err
	}
	var fingerprints keys.Fingerprinter
	if c.BankFingerprintKMSKeyID != "" {
		fingerprints, err = keys.NewKMSFingerprinter(client, c.BankFingerprintKMSKeyID)
	} else {
		fingerprints, err = keys.LoadLocalHMAC(c.BankFingerprintKeyFile)
	}
	if err != nil {
		return nil, nil, err
	}
	return signer, fingerprints, nil
}

// revoker is the ports.Revoker M4 calls after a revocation: client credentials at the bank.
type revoker struct{ providers service.ProviderMap }

func (r revoker) RevokeConsent(ctx context.Context, provider, providerConsentID string) error {
	p, ok := r.providers.Provider(provider)
	if !ok {
		return ports.ErrProviderUnavailable
	}
	return p.RevokeConsent(ctx, providerConsentID)
}
