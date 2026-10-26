# M16 Banco Demo (simulated bank)

| Item | Value |
| --- | --- |
| Phase | 0 (API and data), 1 (OAuth with consent), 2 (portal) |
| Stories | HU-047 SCRUM-64 (8), HU-048 SCRUM-65 (5) |
| Points | 13 |
| Owner | Juan Pablo Contreras |
| Owns | `services/bank-simulator/`, `contracts/bank-simulator.yaml`, `fixtures/demo-user.json`, the `banco-demo` realm and theme inside `services/keycloak/` (coordinate the shared Keycloak image with M1) |
| Depends on | M0, M14 (hosting and mTLS listener) |
| Used by | M5 (main client), M15 (CDT products), every module's tests (fixture) |

How to use: open Claude Code at the repository root on a fresh branch from `develop` and paste everything below the line.

---

You are building module M16 of Fynk: a simulated bank, "Banco Demo", that behaves like a real Open Finance data provider. It lets the team demo every feature with realistic data, because only Bancolombia has a sandbox in Colombia today. Fynk only reads from it. All money actions happen in the Banco Demo's own web portal, never in the Fynk app.

## Read first

1. `CLAUDE.md`, `docs/modules/00-shared-contracts.md` sections 2, 4.4 and 7.
2. `docs/modules/M05-bank.md` (how Fynk calls you) and `docs/modules/M14-infrastructure.md` (Caddy egress, hosts).
3. Jira SCRUM-64 and SCRUM-65.

## Stories and criteria

**HU-047 Servicio simulado (SCRUM-64)**
* Mismo flujo que el adaptador de Bancolombia: consentimiento, OAuth 2.0 con PKCE y PAR, private_key_jwt y mTLS.
* Las cuentas se crean cuando el usuario otorga el consentimiento, nunca al registrarse en Fynk.
* Al primer consentimiento genera 12 meses de historial: salario, arriendo, 4 suscripciones, servicios públicos y gastos diarios.
* Cuenta de ahorros, billetera digital, tarjeta de crédito y CDT.
* Nombres ficticios ("Banco Demo", "Billetera Demo") y datos marcados como simulados.
* Identifica al usuario por su cuenta en el Banco Demo, sin cédula.
* Permite revocar el consentimiento y rechaza las consultas posteriores.

**HU-048 Portal web (SCRUM-65)**
* Independiente de Fynk, con su propio inicio de sesión.
* Pago con comercio y categoría, abono, transferencia entre cuentas propias, pago de tarjeta, abrir o cancelar CDT.
* Crear suscripciones simuladas y cambiar su precio.
* Las operaciones aparecen en la API de inmediato.
* Muestra la pantalla de autorización que Fynk abre durante la vinculación.
* Fynk nunca ejecuta operaciones en el Banco Demo.

## Architecture

```
bank-simulator (Go, one binary, two listeners)
  public listener 8443 (behind the ALB, host bancodemo.<domain>)
    /portal/*            web portal, Go html/template plus htmx, login through Keycloak realm banco-demo (OIDC)
    /consent/*           consent screen shown inside the authorization flow
  internal listener 9443 (mTLS, RequireAndVerifyClientCert, only the Caddy egress can reach it)
    /oauth/par           validates private_key_jwt, forwards to Keycloak banco-demo PAR endpoint
    /oauth/token         validates private_key_jwt, forwards to Keycloak banco-demo token endpoint
    /oauth/revoke
    /open-finance/v1/... resource API, validates access tokens issued by the banco-demo realm
Keycloak realm banco-demo (same Keycloak service as M1, separate realm)
  users: Banco Demo customers (self registration allowed, plus seeded demo users)
  client fynk: confidential, private_key_jwt with Fynk's public key, PAR required, PKCE S256 required,
               FAPI 2.0 security profile client policy, redirect fynk://bank/callback, consent required
  theme banco-demo: plain look in grey and green, logo "Banco Demo", banner "Banco simulado para pruebas"
Database: schema bankdemo in the same RDS instance (its own role, no access to Fynk schemas)
```

* The authorization endpoint is Keycloak's (`auth.<domain>/realms/banco-demo/...`), opened in the phone's browser. The consent page lists the scopes requested in the PAR (saldos, movimientos 12 meses, datos de la cuenta), the receiver "Fynk", the purpose and the term sent by Fynk. Keycloak's consent screen with the custom theme is enough. The consent id is created by the simulator when the PAR arrives and returned in the token response as `consent_id`.
* mTLS: the internal listener trusts only the CA that signed Fynk's client certificate. Log the client certificate serial for every connection (evidence for HU-031).

## Resource API (`contracts/bank-simulator.yaml`)

| Endpoint | Notes |
| --- | --- |
| `GET /open-finance/v1/accounts` | Accounts covered by the consent. Fields: id, type (`SAVINGS`, `WALLET`, `CREDIT_CARD`, `CDT`), name, maskedNumber (`****4821`), currency, balance (decimal string), available, creditLimit, paymentDueDate, cdt (rate EA, term days, opened, maturity) |
| `GET /open-finance/v1/accounts/{id}/transactions?fromBookingDate&cursor&pageSize` | Booked and pending movements, newest first, page size max 200, cursor based. Fields: id, bookingDateTime, amount (signed decimal string), status, description, merchantName, category (bank's own, optional) |
| `DELETE /open-finance/v1/consents/{id}` | Client credentials token. After this every resource call with tokens of that consent returns `403 consent_revoked` |
| `GET /open-finance/v1/products/cdt` | Public, no user token: product name, term days, rate EA, minimum amount, risk level |

Errors follow RFC 9457 like the Fynk API. Add `Retry-After` and `429` after 60 requests per minute per consent, to test M5's handling.

## Data model (schema `bankdemo`)

`customers (id = keycloak sub, display_name, created_at)`, `consents (id, customer_id, client_id, scopes, purpose, term_days, status, created_at, granted_at, revoked_at)`, `accounts (id, customer_id, type, name, masked_number, balance_minor, available_minor, credit_limit_minor, payment_due_day, cdt_rate_ea_bps, cdt_term_days, cdt_opened_on, cdt_matures_on, status)`, `transactions (id, account_id, booked_at, amount_minor, status, description, merchant_name, category)`, `subscriptions (id, customer_id, account_id, merchant_name, amount_minor, periodicity, anchor_day, active)`, `cdt_products (id, name, term_days, rate_ea_bps, min_amount_minor, risk)`.

## Seeded history (generated at first consent, deterministic per customer)

Use a seeded random generator (seed = hash of the customer id) so the same customer always gets the same data. 12 full months back from today plus the current month:

| Item | Account | Pattern |
| --- | --- | --- |
| Salario "NOMINA EMPRESA DEMO SAS" | Ahorros | +5.200.000 on the 30th (or last business day) |
| Arriendo "ARRIENDO INMOBILIARIA DEMO" | Ahorros | -1.400.000 on day 1 |
| Servicios públicos "EMPRESA DE SERVICIOS DEMO" | Ahorros | -186.000 on day 26 in the latest month, earlier months vary ± 20 % |
| Streaming de video | Tarjeta de crédito | -38.900 monthly on day 28 |
| Streaming de series | Tarjeta de crédito | -32.900 monthly on day 2 |
| Música | Billetera | -16.900 monthly on day 7 |
| Almacenamiento en la nube | Billetera | -23.900 monthly on day 15 |
| Gimnasio "GIMNASIO DEMO" | Billetera | -22.250 every Monday |
| Transporte "TRANSPORTE URBANO DEMO" | Billetera | -6.500 every weekday |
| Mercado | Ahorros or card | 4 to 6 purchases a month, 60.000 to 250.000 |
| Restaurantes | Card | 6 to 10 a month, 25.000 to 90.000, the current month about 30 % higher than the previous |
| Antojos | Billetera | 10 to 20 a month under 20.000 |
| Pago de tarjeta | Ahorros to card | full balance on day 5 |
| One off purchases | Card | 3 to 5 a year, 300.000 to 1.500.000 |
| CDT | CDT account | 2.000.000 at 10,50 % E.A., 180 days |

Final balances for the main seeded demo user must be: Ahorros 3.200.000, Billetera 4.600.000, card owed 500.000, CDT 2.000.000 (so the Fynk fixtures in the shared contracts hold). Export this user's data as `fixtures/demo-user.json` in the shared domain shape, so every module tests against the same data.

## Portal (HU-048)

Simple pages in Spanish with the banner "Banco simulado para pruebas. No es un banco real.":

* Inicio de sesión (Keycloak banco-demo), Resumen (accounts with balances), Movimientos per account.
* Acciones: "Registrar un pago" (account, merchant, category, amount), "Recibir dinero", "Transferir entre mis cuentas", "Pagar tarjeta", "Abrir CDT" (product, amount, from account), "Cancelar CDT".
* Suscripciones: list, "Nueva suscripción" (merchant, amount, periodicity, day, account), "Cambiar precio", "Cancelar". A daily job (and a "Cobrar ahora" button for demos) books the charges.
* Consentimientos: list of consents given to Fynk with "Revocar" (same effect as revoking from Fynk).
* Admin page `/portal/admin` (only users with the `demo-admin` role): reset a customer to the seeded state, advance time by N days for demos.

## Work plan (one branch each, from `develop`)

1. `feature/bank-simulator-api-and-seed` (Phase 0): schema, generator, resource API with a static test token, `fixtures/demo-user.json`.
2. `feature/bank-simulator-mtls-listener` (Phase 0): internal listener with client certificate verification, works through the local Caddy.
3. `feature/banco-demo-oauth-and-consent` (Phase 1): realm `banco-demo`, client policies, PAR and token proxies with private_key_jwt validation, consent creation and revocation.
4. `feature/banco-demo-portal` (Phase 2): portal pages, subscriptions, admin tools.

## Tests

* The generator gives identical data for the same customer and the balances listed above for the main demo user.
* A call to 9443 without a client certificate fails the handshake. A token from another consent gets `403`. After revocation every call gets `403 consent_revoked`.
* A payment created in the portal appears in `GET .../transactions` immediately.
* Fixture check: running M9's detection on `fixtures/demo-user.json` finds the 8 recurring items above (shared test in `fixtures/README.md`).

## Done when

* Gate A Banco Demo item passes, M5 links and syncs against it at Gate B, and the portal demo works at Gate D.

## Ask before

* Using real bank names or logos, or adding any operation that Fynk itself could trigger.
