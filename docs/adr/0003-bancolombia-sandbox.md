# ADR 0003: Bancolombia's Open Finance sandbox

* Status: accepted for the sandbox; live calls blocked until Bancolombia enables Fynk (findings 7, 8, 10, 11); production blocked by the findings below
* Date: 2026-11-05, updated 2026-11-12
* Owner: M5 Bank and sync (Juan Carlos Leal / `@JuanLeal05`)
* Jira: SCRUM-23 (HU-009), SCRUM-24 (HU-010), SCRUM-44 (HU-030), SCRUM-45 (HU-031)

---

## 1. Context

M5 reaches every bank through one `Provider` port (CLAUDE.md, rule 7). Banco Demo is a simulator we control. The M5 prompt asks for a time-boxed spike on a real bank: does Bancolombia's sandbox let a third party read a person's accounts with the person's authorization (authorization code), and can Fynk use it without breaking its own rules?

Juan Carlos got access to Bancolombia's API Market ("CO - Paquete Acceso APISPortalEx - PDN") on 5 Nov 2026. This ADR records what the sandbox offers, what was built, and what blocks production.

## 2. What the sandbox offers

Bancolombia's API Market sandbox (`developer-portal-public-sbx.apps.ambientesbc.com`, section *Soluciones de Open Finance*) follows Circular Externa 004 de 2024 and FAPI 2.0. For account information (AIS) it has two products:

| Product | API | Host (sandbox) | Use |
| --- | --- | --- | --- |
| Open Banking Authorization | Access Token Management `POST /token` | `as1-api-open-finance-sandbox.ambientesbc.com` | client credentials, authorization code with PKCE, refresh; `private_key_jwt` |
| | Pushed Authorization Request `POST /par` | same | PAR with `scope=openid accounts <ConsentId>`, PKCE S256, `private_key_jwt`; `request_uri` lasts 90 s |
| | OpenID Discovery `GET /.well-known/openid-configuration` | `auth1-api-open-finance-sandbox.ambientesbc.com` | issuer, authorization endpoint (`/auth`), PAR, token revocation |
| Account Information | Account Access Consents `POST /accounts/account-access-consent` | `rs1-api-open-finance-sandbox.ambientesbc.com`, base `/open-banking/v1/deposits` | the consent, created with a client credentials token before the PAR |
| | Accounts `GET /accounts`, Balances `GET /accounts/balances` | same | savings (SVGS) and checking (CACC) accounts, available balance (AVLB) |
| | Transactions `GET /accounts/{id}/transactions` | same | movements, 40 a page, `fromValueDate`/`toValueDate` of at most 4 months |

Every call also carries the API Market's `Client-Id` and `Client-Secret` headers. The live discovery document (read on 5 Nov 2026) confirms the issuer, `/auth`, `/token`, `/par`, PKCE S256, PS256 for `private_key_jwt` and certificate-bound tokens (`tls_client_certificate_bound_access_tokens: true`).

**Answer to the spike: yes.** Bancolombia lets a third party read a natural person's accounts, balances and movements after the person authorizes it in Bancolombia's own login, with the same flow M5 already uses for Banco Demo (PAR, PKCE, `private_key_jwt`, mTLS). The only new step is that the consent is created at the bank before the PAR.

## 3. Findings (barriers for production)

1. **The consent asks for the customer's ID document.** `AccountOwner` with `SchemeName` (CC, CE, PA...) and `Identification` is required to create the consent, before the person logs in at Bancolombia. Fynk never asks for or stores the cédula (CLAUDE.md, rule 10; HU-009 "No se solicita ni se almacena la cédula"). With a real customer, Fynk would have to ask for it.
2. **90 days of history, not 12 months.** The consent allows movements from at most 90 days back, and each query at most 4 months. HU-010 asks for 12 months. With Bancolombia the first sync brings 90 days.
3. **No consent revocation for third parties.** The sandbox documents creating and reading a consent, but not revoking it. The discovery has a token revocation endpoint, which needs the person's token, kept only on the phone. When the person revokes in Fynk, the consent ends in Fynk at once (no more syncs), and the person revokes it at Bancolombia too.
4. **Manual onboarding with Colombian certificates.** There is no dynamic client registration. Each third party is enabled by Bancolombia with a consumer id and certificates from a Colombian certification authority, for both mTLS and `private_key_jwt`.
5. **The sandbox is a set of mocks.** Each API answers its documented examples, chosen by the exact request, the `authorization` header value or the account id (for example the token `4uth0r1z4t100n`, the account `abcd1234ok`). The consent creation only succeeds for its documented fictional customer. A full chain (a real login at `/auth` that returns a code for a real consent) cannot be shown in the sandbox.
6. **The docs disagree on the token scope.** The token API lists `account`; the PAR, discovery and resource docs say `accounts`. The adapter uses `account` (the token API's own list), and the sandbox test settles it once Fynk's credentials are in place.
7. **Even the sandbox needs mTLS with a certificate from its own test CA.** With Fynk's API Market credentials the discovery answers, but every resource call answers `401 invalid_client`: "Client certificate not recieved. MTLS connection not established". A self-signed certificate is refused ("not issued by a trusted CA"). The TLS handshake of `rs1-api-open-finance-sandbox.ambientesbc.com` only accepts the CAs "Ozone Unsecured Certificates 2021/2026" (`OU=NON-PROD-ONLY`), the test CA of the Ozone platform the sandbox runs on. Fynk cannot make such a certificate: Bancolombia has to issue it or say how to get it. Checked on 5 Nov 2026 with `curl` and the sandbox tests.
8. **The Open Finance products are not in Fynk's access package.** Bancolombia approved "CO - Paquete Acceso APISPortalEx - PDN". In the sandbox portal, creating an application lists only corporate and partner products; searching `account`, `information`, `open`, `banking`, `consent` and `finance` finds neither Open Banking Authorization nor Account Information. The application "Fynk" was created without a product and without a certificate, and the portal does not let a certificate be added afterwards. Both were requested from Bancolombia's developer support on 6 Nov 2026 (an earlier version of this ADR said 5 Nov; the request went out the next day).
9. **The redirect URL must be `http://` or `https://`.** The portal refuses Fynk's deep link `fynk://bank/callback` (`BANK_REDIRECT_URI`), so the application holds a placeholder `https://` URL. A real login would need an `https://` return link that opens the app (Universal Links on iOS, App Links on Android), which needs a domain Fynk controls and changes `linking.ts` (M0) and the bank settings. A team decision, not taken here. The contract tests do not use it.
10. **The Open Finance products are documentation only.** Checked again on 12 Nov 2026, signed in as Juan Carlos. The portal moved to `api-portal-external.apps.bancolombia.com` (the old sandbox address redirects there). The application "Fynk" (Sandbox) still has 0 products. Its subscription list offers 93 products and none of them is Open Finance. The catalog's "Open Finance" filter shows four products (Account Information, Open Banking Authorization, Domestic Payment Initiation, Variable Recurring Payment), but none carries the "Sandbox" tag the subscribable products have. For production their page says "Según cotización · Solicita más información", which opens the same support form. The closest subscribable names (Deposit Account Operations And Services, Deposit Account Ownership, Transactional Information, Customer Functional Event History) are Bancolombia's own partner and corporate APIs, not a person's data shared by consent, so they cannot replace Account Information.
11. **No answer from support, and the request cannot be followed online.** By 12 Nov 2026 the 6 Nov request had no answer. "Gestiona tus tickets" signs in through Bancolombia's Microsoft app "CO - Zendesk - PDN", which rejects the university account (`AADSTS50105`: the user is not assigned to the application). Answers only arrive by email.
12. **The application's certificate is the `private_key_jwt` key, not the mTLS one.** Bancolombia's help center says the certificate uploaded to an application is the public key that checks the signature of the client assertion, and that the `kid` is provided with the credentials and registered in a JWKS. So uploading a certificate there would not open the mTLS connection of finding 7. The help center's example signs with RS256; the live discovery also accepts PS256, which Fynk uses (CLAUDE.md, Security rules).

## 4. Decision

Juan Carlos decided (5 Nov 2026):

* Build the Bancolombia adapter (`services/api/internal/bank/adapters/bancolombia`) exactly as the sandbox documents it, behind the same `Provider` port. No other module changes.
* Run it **only in the sandbox**, with the sandbox's fictional customer taken from the settings (`BANCOLOMBIA_SANDBOX_OWNER_*`). Fynk never asks a person for a document. The settings refuse an owner unless `BANCOLOMBIA_SANDBOX=true`, the adapter refuses to start without the sandbox, and the app shows Bancolombia as "Simulado".
* Outside the sandbox Bancolombia is not offered. Whether Fynk may ask for the cédula for Bancolombia (changing rule 10 and HU-009) is a team decision, not taken here.
* `RevokeConsent` answers `revocation_not_supported`, and M4 stops retrying the notice at once instead of retrying for 24 hours.
* Movements are read from at most 90 days back.

## 5. How to link Bancolombia's sandbox

Who does what, in order. Nothing here goes in the repository: credentials live in `.env` locally and in AWS Secrets Manager in staging.

1. **Juan Carlos (M5): credentials.** From the API Market, take Fynk's application Client Id and Client Secret and put them in `.env` (and later in Secrets Manager for staging):

   ```
   BANCOLOMBIA_CLIENT_ID=<API Market Client Id>
   BANCOLOMBIA_CLIENT_SECRET=<API Market Client Secret>
   BANCOLOMBIA_ISSUER=https://auth1-api-open-finance-sandbox.ambientesbc.com
   BANCOLOMBIA_AUTHORIZE_URL=https://auth1-api-open-finance-sandbox.ambientesbc.com/auth
   BANCOLOMBIA_SANDBOX=true
   BANCOLOMBIA_SANDBOX_OWNER_ID_TYPE=CC
   BANCOLOMBIA_SANDBOX_OWNER_ID=<the documented sandbox customer's number>
   BANCOLOMBIA_SANDBOX_OWNER_NAME=<the documented sandbox customer's name>
   ```

2. **Juan Carlos (M5): check the sandbox.** Run the contract tests against the real sandbox; they print the issuer and authorization endpoint they find:

   ```
   cd services/api
   BANCOLOMBIA_CLIENT_ID=... BANCOLOMBIA_CLIENT_SECRET=... \
   BANCOLOMBIA_SANDBOX_CERT_FILE=../../certs/bancolombia-sandbox.crt \
   BANCOLOMBIA_SANDBOX_KEY_FILE=../../certs/bancolombia-sandbox.key \
     go test -tags integration -count=1 -v -run Sandbox ./internal/bank/adapters/bancolombia/
   ```

   The certificate files are the ones Bancolombia issues (finding 7), kept in `certs/`, which git ignores. **Result on 5 Nov 2026:** the discovery test passed with Fynk's credentials; the accounts, transactions and revoked consent tests got `401 invalid_client` because there is no sandbox certificate yet. The adapter reports that answer as `provider_unavailable`, not `invalid_grant`, so a certificate problem never asks a person to reconnect.

3. **Juan Carlos (M5): register Fynk's keys at Bancolombia.** Still pending Bancolombia's support on 12 Nov 2026 (findings 7, 8, 10 and 11): the sandbox mTLS client certificate from the Ozone test CA, the Open Finance products for the application "Fynk", and a way to register the `private_key_jwt` key (finding 12). Then, in the API Market application, register the public key or certificate of Fynk's `private_key_jwt` signer (the same key as Banco Demo: `BANK_SIGNER_KEY_FILE` locally, the KMS key `BANK_SIGNER_KMS_KEY_ID` in staging) and the egress's mTLS client certificate. Production requires certificates from a Colombian certification authority (finding 4).

4. **Juan Pablo (M14): egress routes.** Done in #326 (7 Nov 2026). The placeholder `/bancolombia/*` route to `api.sandbox.bancolombia.com` was replaced by the two routes the adapter calls:

   ```
   handle_path /bancolombia-auth/* {
       reverse_proxy https://as1-api-open-finance-sandbox.ambientesbc.com {
           header_up Host {upstream_hostport}
           transport http {
               tls_client_auth /run/secrets/fynk-client.crt /run/secrets/fynk-client.key
           }
       }
   }
   handle_path /bancolombia-api/* {
       reverse_proxy https://rs1-api-open-finance-sandbox.ambientesbc.com {
           header_up Host {upstream_hostport}
           transport http {
               tls_client_auth /run/secrets/fynk-client.crt /run/secrets/fynk-client.key
           }
       }
   }
   ```

   The same two routes go in `Caddyfile.local`, and the staging task gets the `BANCOLOMBIA_*` settings from Secrets Manager.

5. **Sofia (M0): local stack.** The bank settings (`BANK_SIGNER_KEY_FILE`, `BANK_FINGERPRINT_KEY_FILE`, `BANCO_DEMO_*`) are in `docker-compose.yml` since `a5bd451`. The `BANCOLOMBIA_*` settings go next to them once Bancolombia enables Fynk.

6. **Then, on the phone.** Conectar banco lists "Bancolombia" with the "Simulado" badge. Choosing it creates the consent at Bancolombia, sends the PAR and opens Bancolombia's `/auth` page in the system browser. Because the sandbox is a set of mocks (finding 5), the login there may not return a code; the accounts and movements mapping is proven by the contract tests instead.

## 6. How to present it to the jury

If Bancolombia does not enable Fynk before the presentation, the demo does not depend on it. CLAUDE.md asks for exactly this: a production barrier we cannot cross is documented as a finding, never hidden.

1. **The working demo uses the simulated banks.** Banco Demo, Billetera Demo, Banco Digital Demo and Cooperativa Demo go through the same consent, PAR, PKCE, `private_key_jwt` and mTLS flow as a real bank (CLAUDE.md, rule 8). On 10 Nov 2026 that flow passed 14 of 14 end-to-end checks on the local stack.
2. **Bancolombia is shown as an integration that reaches the bank and stops at its onboarding.**
   * The adapter sits behind the same `Provider` port as the simulated banks (rule 7), with tests built from Bancolombia's own documented examples (`services/api/internal/bank/adapters/bancolombia/*_test.go`).
   * A live run of the sandbox tests (section 5, step 2) shows the discovery answering with Fynk's credentials, then the gateway refusing the account calls with `invalid_client` because the Ozone certificate is missing. It proves the call reaches Bancolombia and names the exact missing piece.
   * The findings above explain what production would need: Bancolombia's onboarding and certificates (4, 7, 8, 10, 11, 12), the cédula (1), 90 days of history (2) and revocation (3).
3. **No fake Bancolombia in the app.** The app offers Bancolombia only when its settings are present. A mock with Bancolombia's name, even labelled "Simulado", could look like a real connection.

If Bancolombia answers in time: put the certificate in `certs/`, run section 5, step 2 again, and set the `BANCOLOMBIA_*` settings.

## 7. Consequences

* M5's port and domain did not change for a new bank, only one optional field (`PARResult.ProviderConsentID`) and one error (`ErrRevocationNotSupported`). Rule 7 holds.
* The jury sees a working adapter against the real sandbox, and these findings explain why production would need a team decision (rule 10) and Bancolombia's onboarding.
* If the team later accepts asking for the document for Bancolombia only, Conectar banco would ask it, pass it through to the consent and never store it; `AccountOwner` would then come from the request instead of the settings.

## 8. Sources

* Bancolombia API Market sandbox, *Soluciones de Open Finance*: Open Banking Authorization (Access Token Management, Pushed Authorization Request, OpenID Discovery) and Account Information (Account Access Consents, Accounts, Balances, Transactions), read on 5 Nov 2026 at `developer-portal-public-sbx.apps.ambientesbc.com/documentacion`.
* Live discovery: `https://auth1-api-open-finance-sandbox.ambientesbc.com/.well-known/openid-configuration`, 5 Nov 2026.
* TLS handshake and `401 invalid_client` answers of `https://rs1-api-open-finance-sandbox.ambientesbc.com`, and the application form of the sandbox portal (`/mis-apps/crear-app`), 5 Nov 2026.
* Bancolombia developer support: the account ownership API does not cover balances or movements (`soportedevs.bancolombia.com`, articles updated 2023 and 2025).
* API Market portal, signed in, 12 Nov 2026: `api-portal-external.apps.bancolombia.com` (`/my-apps`, the subscription list of the application "Fynk", `/products` with the "Open Finance" filter, `/documentacion/categorizacion/publicos/open-finance/account-information`).
* Bancolombia help center, 12 Nov 2026: "¿Qué debo enviar cuando me solicitan el certificado de la aplicación?" (2024), "Utilidad: Prepare private key JWT" (2026), "¿Que es JWKS?" (2024), and the "Gestiona tus tickets" sign-in.
* Live sandbox, 12 Nov 2026: discovery answers 200; `rs1-api-open-finance-sandbox.ambientesbc.com` still answers `401 invalid_client` without the Ozone certificate.
