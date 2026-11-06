package bank

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/kms"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/adapters/bancolombia"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/adapters/bankdemo"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/egress"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/keys"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/service"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/store"
	consentports "github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
)

// errNotConfigured: the link settings are missing, so no bank can be reached (fails closed).
var errNotConfigured = errors.New("bank: the bank link is not configured")

// newService builds the link service from the module's Deps. Without a database there is
// nothing to serve (tests of other modules). Without the egress, the keys or any bank's client
// the service still runs, but every link answers provider_unavailable.
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
	if err := installProductCatalog(d.Config); err != nil {
		d.Log.Error("bank CDT catalog disabled", "error", err)
	}
	providers, fingerprints, err := bankProviders(d)
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

// bankProviders builds the adapters whose settings are there, with the keys and the egress they
// share, and installs the revoker M4 uses: Banco Demo and Billetera Demo (one simulator behind
// the egress route banco-demo) and Bancolombia's sandbox (routes bancolombia-auth and
// bancolombia-api). Without the egress or the keys, or with no bank configured, it fails closed.
func bankProviders(d module.Deps) (service.ProviderMap, keys.Fingerprinter, error) {
	c := d.Config
	hasSigner := c.BankSignerKMSKeyID != "" || c.BankSignerKeyFile != ""
	hasFingerprint := c.BankFingerprintKMSKeyID != "" || c.BankFingerprintKeyFile != ""
	bancoDemo := c.BancoDemoClientID != "" && c.BancoDemoIssuer != "" && c.BancoDemoAuthorizeURL != ""
	if c.EgressURL == "" || !hasSigner || !hasFingerprint || (!bancoDemo && c.BancolombiaClientID == "") {
		return nil, nil, errNotConfigured
	}
	k, err := loadBankKeys(d)
	if err != nil {
		return nil, nil, err
	}
	client, err := egress.NewClient(c.EgressCAFile)
	if err != nil {
		return nil, nil, err
	}
	providers := service.ProviderMap{}
	if bancoDemo {
		if err := addBancoDemo(d, k, client, providers); err != nil {
			return nil, nil, err
		}
	}
	ports.Offer()
	if c.BancolombiaClientID != "" {
		// A Bancolombia that cannot be built never takes Banco Demo down with it.
		if err := addBancolombia(d, k, client, providers); err != nil {
			d.Log.Error("Bancolombia not offered", "error", err)
		}
	}
	if len(providers) == 0 {
		return nil, nil, errNotConfigured
	}
	ports.InstallRevoker(revoker{providers})
	return providers, k.fingerprints, nil
}

func addBancoDemo(d module.Deps, k bankKeys, client *http.Client, providers service.ProviderMap) error {
	c := d.Config
	signer, err := k.signer(c.BancoDemoClientID)
	if err != nil {
		return err
	}
	base, err := egress.BaseURL(c.EgressURL, "banco-demo")
	if err != nil {
		return err
	}
	for _, id := range []string{"banco-demo", "billetera-demo"} {
		a, err := bankdemo.New(bankdemo.Config{
			Provider: id, BaseURL: base, ClientID: c.BancoDemoClientID, Audience: c.BancoDemoIssuer,
			AuthorizeURL: c.BancoDemoAuthorizeURL, RedirectURI: c.BankRedirectURI,
			Signer: signer, HTTP: client, Clock: d.Clock,
		})
		if err != nil {
			return fmt.Errorf("bank: %s adapter: %w", id, err)
		}
		providers[id] = a
	}
	return nil
}

// addBancolombia builds Bancolombia's adapter and offers it in GET /providers. It only runs in
// the sandbox, with the sandbox's fictional customer (ADR 0003, CLAUDE.md rule 10).
func addBancolombia(d module.Deps, k bankKeys, client *http.Client, providers service.ProviderMap) error {
	c := d.Config
	signer, err := k.signer(c.BancolombiaClientID)
	if err != nil {
		return err
	}
	auth, err := egress.BaseURL(c.EgressURL, "bancolombia-auth")
	if err != nil {
		return err
	}
	api, err := egress.BaseURL(c.EgressURL, "bancolombia-api")
	if err != nil {
		return err
	}
	a, err := bancolombia.New(bancolombia.Config{
		AuthBaseURL: auth, ResourceBaseURL: api,
		ClientID: c.BancolombiaClientID, ClientSecret: c.BancolombiaClientSecret,
		Audience: c.BancolombiaIssuer, AuthorizeURL: c.BancolombiaAuthorizeURL,
		Owner: bancolombia.Owner{
			IDType: c.BancolombiaSandboxOwnerIDType, ID: c.BancolombiaSandboxOwnerID, Name: c.BancolombiaSandboxOwnerName,
		},
		Sandbox: c.BancolombiaSandbox, Signer: signer, HTTP: client, Clock: d.Clock,
	})
	if err != nil {
		return err
	}
	providers[bancolombia.ID] = a
	ports.Offer(ports.Info{
		ID: bancolombia.ID, DisplayName: "Bancolombia", Kind: ports.KindBank, IsSimulated: c.BancolombiaSandbox,
		LogoKey: bancolombia.ID, Scopes: []ports.Scope{ports.ScopeBalances, ports.ScopeTransactions, ports.ScopeAccountDetails},
	})
	return nil
}

// installProductCatalog installs the public CDT catalog M15 reads through ports.ProductsOf.
// Only Banco Demo has CDTs. It needs only the egress: no user, no token and no client
// assertion, so the Inversión tab has its catalog even while the link settings are missing.
func installProductCatalog(c config.Config) error {
	if c.EgressURL == "" {
		return errNotConfigured
	}
	client, err := egress.NewClient(c.EgressCAFile)
	if err != nil {
		return err
	}
	base, err := egress.BaseURL(c.EgressURL, "banco-demo")
	if err != nil {
		return err
	}
	a, err := bankdemo.New(bankdemo.Config{Provider: "banco-demo", BaseURL: base, HTTP: client})
	if err != nil {
		return err
	}
	ports.InstallProductCatalog(productCatalog{"banco-demo": a})
	return nil
}

// productCatalog is the ports.ProductCatalog of the providers that publish CDTs.
type productCatalog map[string]ports.ProductLister

func (p productCatalog) Products(ctx context.Context, provider string) ([]ports.Product, error) {
	l, ok := p[provider]
	if !ok {
		return nil, ports.ErrProviderUnavailable
	}
	return l.Products(ctx)
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

// bankKeys are the keys every bank adapter shares: the KMS key when its id is set (AWS), else
// its local file.
type bankKeys struct {
	d            module.Deps
	kms          keys.KMS
	fingerprints keys.Fingerprinter
}

func loadBankKeys(d module.Deps) (bankKeys, error) {
	c := d.Config
	k := bankKeys{d: d}
	if c.BankSignerKMSKeyID != "" || c.BankFingerprintKMSKeyID != "" {
		var err error
		if k.kms, err = loadKMS(context.Background()); err != nil {
			return bankKeys{}, err
		}
	}
	var err error
	if c.BankFingerprintKMSKeyID != "" {
		k.fingerprints, err = keys.NewKMSFingerprinter(k.kms, c.BankFingerprintKMSKeyID)
	} else {
		k.fingerprints, err = keys.LoadLocalHMAC(c.BankFingerprintKeyFile)
	}
	if err != nil {
		return bankKeys{}, err
	}
	return k, nil
}

// signer is the private_key_jwt signer for Fynk's client at one bank.
func (k bankKeys) signer(clientID string) (ports.AssertionSigner, error) {
	c := k.d.Config
	if c.BankSignerKMSKeyID != "" {
		return keys.NewKMSSigner(k.kms, c.BankSignerKMSKeyID, clientID, k.d.Clock)
	}
	return keys.LoadLocalSigner(c.BankSignerKeyFile, clientID, k.d.Clock)
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
