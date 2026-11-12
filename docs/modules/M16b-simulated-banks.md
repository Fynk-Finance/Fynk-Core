# M16b Simulated banks (demo accounts at sign-up)

| Item | Value |
| --- | --- |
| Phase | Extension of M16, after Gate B |
| Stories | HU-056 SCRUM-73 (5), HU-057 SCRUM-74 (5), HU-058 SCRUM-75 (5) |
| Points | 15 |
| Owner | Daniel Palacios (`@Komi-yes`), agreed with the team on 6 Nov 2026 |
| Touches | M16 `services/bank-simulator/`, `contracts/bank-simulator.yaml`, realm `banco-demo` (reviewer Juan Pablo Contreras); M5 `services/api/internal/bank/`, `contracts/modules/bank.yaml`, `apps/mobile/src/modules/bank/` (reviewer Juan Carlos Leal); M1 `services/api/internal/identity/`, realm `fynk` (Daniel) |
| Depends on | M16 HU-047, M5 link and sync, M1 device registration |
| Used by | M3 onboarding Cuentas step (PR #277), M6 Mis cuentas, every demo for the jury |

How to use: open Claude Code at the repository root on a fresh branch from `develop` (or on top of the stack, see Work plan) and paste everything below the line.

---

You are extending the simulated bank of Fynk. Today the simulator has one customer type: every customer gets the same four accounts with the same balances. After this work, every new Fynk user gets accounts in several fictional Colombian financial entities, with random but realistic balances. The accounts are created during the first part of the Fynk sign-up, so that the onboarding Cuentas step already lists the user's entities. Fynk still reads them only through consent, OAuth and mTLS, as with a real bank. Bancolombia stays the only real bank, still in its sandbox, and it is not part of this work (Juan Carlos, M5).

## Read first

1. `CLAUDE.md`, mainly rules 7, 8 and 10, "Security rules" and "Where data lives".
2. `docs/modules/M16-banco-demo.md` (the simulator as designed) and `docs/modules/M05-bank.md` (how Fynk calls it).
3. `docs/modules/00-shared-contracts.md` sections 2, 4.4 and 7.
4. Jira SCRUM-73, SCRUM-74, SCRUM-75 and SCRUM-64.
5. The latest M16 and M5 session logs in `docs/history/sessions/`.

## Decisions already taken (6 Nov 2026, do not reopen)

* Several fictional entities instead of one Banco Demo. Names are fictional, never a real bank's name or logo.
* Accounts are created during the first part of the Fynk sign-up, not at the first consent. This replaces the HU-047 criterion "Las cuentas se crean cuando el usuario otorga el consentimiento, nunca al registrarse en Fynk".
* Fynk sends the simulator only the user's Keycloak `sub`, an opaque identifier. It never sends the email, the name or a cédula.
* Balances are random and never negative. Credit cards keep a random debt below their limit.
* Fynk does not store the list of the user's entities. It asks the simulator each time.
* This is an exception to rule 8, for the demo only. It is recorded in `docs/adr/0008-simulated-bank-provisioning.md`.

## Stories and criteria

**HU-056 Cuentas de demostración en varias entidades ficticias (SCRUM-73)**
* El simulador ofrece varias entidades ficticias, cada una con su propio identificador: Banco Demo, Billetera Demo, Banco Digital Demo y Cooperativa Demo. Ningún nombre ni logo es de una entidad real.
* Cada usuario tiene cuentas en Banco Demo y en al menos otra entidad, elegidas al azar entre las demás.
* Las cuentas de cada entidad son realistas para Colombia y hay máximo una de cada tipo por entidad.
* Los saldos se eligen al azar dentro de rangos realistas y nunca son negativos. La tarjeta de crédito tiene una deuda aleatoria menor que su cupo.
* El historial de 12 meses de cada cuenta termina exactamente en su saldo.
* Los datos son deterministas por usuario, aunque el simulador se reinicie.
* El usuario demo sembrado conserva sus saldos y `fixtures/demo-user.json` no cambia.
* Un endpoint solo de demostración crea el cliente a partir del `sub`, es idempotente y solo acepta llamadas de Fynk con private_key_jwt por mTLS.
* Un consentimiento cubre solo las cuentas de la entidad que lo recibió.
* Todos los datos siguen marcados como simulados.
* La excepción a la regla 8 queda documentada en un ADR como "solo demostración".

**HU-057 Ingresar con la cuenta de Fynk y autorizar el consentimiento (SCRUM-74)**
* El inicio de sesión del Banco Demo ofrece "Ingresar con Fynk".
* El simulador reconoce al cliente creado al registrarse y muestra solo sus cuentas.
* La autorización nombra la entidad, los datos, el receptor Fynk, el propósito y el plazo, y liga el consentimiento a ese cliente y a esa entidad.
* Después del primer ingreso, conectar otra entidad solo pide aceptar el consentimiento.
* Fynk nunca ve la contraseña: navegador del sistema, PKCE, PAR y regreso por `fynk://bank/callback`.
* Si el usuario no tiene cuentas en esa entidad, la pantalla lo dice y no se crea el consentimiento.
* Los usuarios propios del Banco Demo siguen pudiendo ingresar y autorizar.

**HU-058 Crear las cuentas al registrarse y mostrarlas en el paso Cuentas (SCRUM-75)**
* Al registrar el primer dispositivo del usuario, el backend de Fynk le pide al simulador crear sus cuentas, enviando solo el `sub`.
* Si el simulador no responde, el registro no falla y la creación se reintenta cuando la app pide la lista de entidades.
* Cada entidad ficticia es un proveedor más del puerto de bancos, servido por el adaptador del simulador, sin cambiar el dominio.
* Un endpoint nuevo devuelve las entidades simuladas donde el usuario tiene cuentas, sin guardarlas en Fynk.
* El paso Cuentas y Conectar banco muestran esas entidades con "Simulado", más Bancolombia cuando esté disponible.
* El sync funciona con varios enlaces simulados a la vez: intervalo mínimo de 60 s, y revocar una entidad no afecta a las otras.
* Las cuentas solo se crean cuando el simulador está configurado (local y staging).

## State on `develop` (3646c9f), check it again before you start

* `services/bank-simulator/internal/domain/generator.go`: `GenerateCustomerData` targets the same balances for every customer ($3.200.000 / $4.600.000 / card -$500.000 / CDT $2.000.000). Only the history depends on the seed.
* `internal/store/store.go`: the store is in memory, with no `bankdemo` schema. `GetCustomer` creates a customer the first time it is read.
* `internal/oauth/oauth.go`: `HandlePAR` binds every consent to `cliente.demo@bancodemo.local`. `CompleteAuthorization` exists but nothing calls it. There is no authorization page.
* `internal/portal/portal.go`: the portal uses the same banco-demo realm login and session as the authorization page, so it shows the logged in customer (the Fynk `sub` for "Ingresar con Fynk"). Its forms carry the session's CSRF token. Only when the realm login is not configured (local runs without Keycloak, unit tests) it falls back to `?user=` or the demo user.
* `services/api/internal/bank/ports/providers.go`: a static catalog of `banco-demo` and `billetera-demo`, the same for every user. Bancolombia joins through `Offer`.
* `services/api/internal/bank/wiring.go` (`addBancoDemo`): builds the two simulated adapters with one shared client, issuer and authorize URL.
* `services/api/internal/bank/adapters/bankdemo/bankdemo.go`: splits Billetera Demo from Banco Demo by account type (`WALLET`).
* `services/api/internal/identity/devices/service.go` (`Register`): where the backend first learns that a new user exists. depguard lets `internal/identity` import `internal/bank/ports`.

## The entities

All entities live in the one simulator binary and share its client, issuer and mTLS listener. Each one is a separate provider id for Fynk.

| Provider id | Name | Kind | Present | Accounts |
| --- | --- | --- | --- | --- |
| `banco-demo` | Banco Demo | bank, traditional | always | Ahorros (always), Tarjeta de crédito (always), CDT (about half of the users) |
| `billetera-demo` | Billetera Demo | wallet | about 80 % | one wallet account |
| `banco-digital-demo` | Banco Digital Demo | bank, digital only | about 50 % | Ahorros (always), Tarjeta de crédito (about 40 %) |
| `cooperativa-demo` | Cooperativa Demo | bank, cooperative | about 25 % | Ahorros |

If none of the optional entities comes out, add Billetera Demo, so every user has at least two entities. The probabilities are a starting point. Keep them as named constants in one place.

Balance ranges, in COP (store them in centavos):

| Account | Range |
| --- | --- |
| Banco Demo Ahorros (payroll) | $500.000 to $8.000.000 |
| Billetera | $20.000 to $1.500.000 |
| Banco Digital Ahorros | $100.000 to $5.000.000 |
| Cooperativa Ahorros | $200.000 to $3.000.000 |
| Tarjeta de crédito | limit $2.000.000 to $10.000.000 in steps of $500.000, debt 0 % to 40 % of the limit |
| CDT | $1.000.000 to $10.000.000 in steps of $500.000, a term and rate taken from the CDT catalog |

Round balances to whole pesos. The seeded demo user `cliente.demo@bancodemo.local` keeps exactly the balances in M16 (Banco Demo Ahorros, Tarjeta and CDT, plus Billetera Demo $4.600.000), so `fixtures/demo-user.json` and every module test stay as they are.

## Generator

* Seed: the hash of the customer id plus the provider id, so adding an entity later does not change the others.
* Choose the final balance first, then build the 12 months of history backwards. The opening balance is the final balance minus the sum of the movements. A deposit account's running balance never goes below zero on any day. When it would, lower the variable spending of that month, never the fixed items.
* The fixed items of M16 (salary, rent, utilities, subscriptions, transport, card payment) go to the accounts the user has. Salary and rent always go to Banco Demo Ahorros. Wallet items go to the card when the user has no wallet. Each user keeps at least 4 subscriptions, so M9 still detects them.
* Every account and transaction carries its provider id and `simulated: true`.

## Simulator changes (`services/bank-simulator`, `contracts/bank-simulator.yaml`)

| Endpoint | Listener | Notes |
| --- | --- | --- |
| `POST /demo/v1/customers` | internal 9443, mTLS | Body `{ "customerRef": "<fynk sub>" }`. Client credentials token with private_key_jwt and scope `demo:provision`. Creates the customer if missing and returns `{ "entities": [{ "providerId", "displayName", "kind", "accountCount" }] }`. Idempotent: the same call returns the same answer. The `sub` travels in the body, never in the URL. |
| `POST /oauth/par` | internal 9443 | Takes a new `entity` parameter (the provider id). The consent is created without a customer. The customer is set when the person authorizes. |
| `GET /oauth/authorize?request_uri=&client_id=` | public 8443 | New page. Asks for a banco-demo login (session cookie), then shows the consent screen. "Autorizar" calls `CompleteAuthorization` with the customer and redirects to `fynk://bank/callback`. "Cancelar" returns `access_denied`. When the customer has no accounts at that entity, it shows "No tienes productos en <entidad>" and creates nothing. |
| `GET /open-finance/v1/accounts` and transactions | internal 9443 | Return only the accounts of the consent's entity and customer. |

* The customer id is the Fynk `sub` for brokered users and the banco-demo `sub` for the bank's own users.
* A customer that is missing after a restart is generated again from the seed, so the same user gets the same entities and balances. Movements made in the portal before the restart are lost, as they are today.
* Copy for the screens, in Spanish: the banner "Banco simulado para pruebas. No es un banco real." on every page, plus the entity's name.

## "Ingresar con Fynk" (realms `banco-demo` and `fynk`)

* In the `fynk` realm (M1), add a confidential client `banco-demo-broker` with the standard flow and PKCE, redirecting to the banco-demo broker endpoint.
* In the `banco-demo` realm, add an OIDC identity provider `fynk` with the button label "Ingresar con Fynk". Its first-broker-login flow creates the user without a review-profile form.
* An attribute importer stores the Fynk `sub` as the user attribute `fynk_sub`. A protocol mapper puts `fynk_sub` in the ID token the simulator's authorization page receives.
* The browser keeps both Keycloak sessions, so after the first entity the person only sees the consent screen.
* Realm changes go in the realm JSON files in `services/keycloak/realms/`, never by hand in the admin console.

## Fynk changes

**M1 (`internal/identity`)**
* In `devices.Service.Register`, when the user had no device before, call the demo provisioner from `internal/bank/ports` with the user's `sub`. Use a short timeout.
* A failure is logged through the redacting logger without the `sub`, and the registration still succeeds.

**M5 backend (`internal/bank`, `contracts/modules/bank.yaml`)**
* `ports`: a `DemoProvisioner` interface and an `InstallDemoProvisioner` function, following the pattern of `InstallRevoker`. It does nothing when the simulator is not configured.
* `ports/providers.go`: the catalog lists the four simulated entities.
* `wiring.go`: one `bankdemo` adapter per simulated entity, with the shared simulator config. No new environment variables, so M0's `platform/config` does not change.
* `adapters/bankdemo`: the adapter sends `entity` in the PAR and stops splitting accounts by type.
* New endpoint `GET /bank/simulated-entities`: calls `POST /demo/v1/customers` (which also retries a failed sign-up provisioning) and returns the provider ids where the user has accounts. Nothing is stored.
* Contract first: change `contracts/modules/bank.yaml`, run `make generate`, then code.

**M5 mobile (`modules/bank`)**
* `providersApi.ts` and `useProviders.ts`: show the simulated entities the user has accounts in, plus every real provider offered (Bancolombia).
* When the call fails, show every simulated entity, so the step never blocks.
* The onboarding Cuentas step (#277) and Conectar banco get the list through M5's components without changes of their own.

**M13 (ask first)**
* Whether provisioning writes an audit event (for example `bank.demo_provisioned`). It would be a new action in Juan Pablo's allow-list. Do not add it without his answer.

## Work plan (a stack, bottom first)

1. `docs/simulated-banks-adr`: ADR 0008. In `CLAUDE.md`, a row in "Decisions taken", the "Where data lives" note that the simulator stores the Fynk `sub`, and the Team table change. Every module owner reviews.
2. `feature/simulated-banks-contract`: `contracts/bank-simulator.yaml` (provision endpoint, `entity` in the PAR, authorize page) and `contracts/modules/bank.yaml` (`GET /bank/simulated-entities`).
3. `feature/simulated-banks-generator`: entities, random balances, backwards history, fixture unchanged.
4. `feature/simulated-banks-provisioning`: `POST /demo/v1/customers`, consent per entity, regeneration after a restart.
5. `feature/simulated-banks-authorize`: the authorization page, plus "Ingresar con Fynk" in both realms.
6. `feature/simulated-banks-fynk-providers`: M5 catalog, adapters, `DemoProvisioner`, the new endpoint, the mobile list.
7. `feature/simulated-banks-signup-hook`: the M1 call in `devices.Service.Register`.

Keep each pull request under about 400 changed lines. Steps 3 to 5 touch the simulator and the `banco-demo` realm, so Juan Pablo reviews them. Step 6 needs Juan Carlos's review.

## Tests

* The generator gives the same entities, accounts and balances for the same customer, and different ones for different customers.
* Over 1.000 random customers: no deposit account ever has a negative running balance, every card debt is below its limit, every user has Banco Demo and at least one more entity, and no entity has two accounts of the same type.
* The seeded demo user still matches `fixtures/demo-user.json` byte for byte, and M9's fixture test still finds its 8 recurring items.
* `POST /demo/v1/customers` twice returns the same answer. It fails without a client certificate, without a token, or with a token lacking `demo:provision`.
* A consent for `banco-digital-demo` returns only that entity's accounts. A token of another customer gets `403`. Revoking one entity's consent leaves the others working.
* The authorization page with a customer who has no account at that entity shows the message and creates no consent.
* M1: registering the first device calls the provisioner once, and a second device does not call it. A provisioner error still returns the device as registered.
* M5: `GET /bank/simulated-entities` returns what the simulator returns, and the app lists those plus Bancolombia when offered.
* Maestro, locally: sign up, reach the Cuentas step, see at least two simulated entities, connect two of them, and see both entities' accounts in Mis cuentas.
* No log line contains a `sub`, an email or an amount. Capture the log output in the M1 and M5 tests and check it.

## Done when

* A new user in the local stack and on staging signs up, sees their own simulated entities in the Cuentas step, connects them, and sees different balances from another new user.
* The demo user and every existing module test are unchanged.
* SCRUM-73, SCRUM-74 and SCRUM-75 move to "En revisión" with their pull requests, and to "Finalizado" after review.

## Ask before

* Adding a database to the simulator, an entity with a real bank's name, or a new environment variable in M0's config.
* Changing `GET /providers` (M4 uses it to check consent scopes), or any screen of M3.
* Adding an audit action (M13), or any money movement that Fynk itself could trigger.
