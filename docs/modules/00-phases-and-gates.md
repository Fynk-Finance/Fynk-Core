# Fynk phases and gates

The MVP is built in 5 phases. Each phase ends with a gate: a short demo that proves the phase works end to end on staging. A module can start work for the next phase early, but its pull requests merge into `develop` only when they do not break the current gate.

Total scope: 17 modules, 54 Jira stories, 235 story points.

| Phase | Goal | Modules | Points |
| --- | --- | --- | --- |
| 0 Foundations | Everyone can build in parallel | M0, M14, M16 | 28 |
| 1 Core security and data | A user can sign in, unlock the vault and sync a bank | M1, M2, M5, M13 (audit store only) | 68 + 5 |
| 2 Seeing the money | The Dashboard shows real accounts and movements | M4, M6, M7, M12, M5 (Bancolombia adapter) | 47 |
| 3 Product features | Savings, subscription killer, analytics and caps work | M8, M9, M10, M3 | 61 |
| 4 Intelligence and compliance | AI, privacy rights and the Inversión tab are ready for the jury | M11, M13 (rest), M15 | 26 |

M13 is split: the audit store (HU-027, 5 points) is built in Phase 1 because Phases 1 and 2 already write audit events. The privacy screens (HU-028, HU-029) come in Phase 4.

## Phase 0. Foundations

Runs in parallel. M0 is the critical path. The other two only need the repository skeleton from M0's first pull request.

| Order | Work | Module | Unblocks |
| --- | --- | --- | --- |
| 1 | Monorepo skeleton, tooling, `develop` and `main` protected | M0 | everything |
| 2 | Shared contracts from `00-shared-contracts.md` in code, with stubs | M0 | all modules |
| 3 | App shell, navigation, design system | M0 | all mobile work |
| 4 | Local stack with `docker compose` (Postgres, Redis, Keycloak, Caddy, bank simulator, API) | M0 with M14 | all backend work |
| 5 | Terraform for staging (network, ECS, RDS, Redis, ALB, Caddy, endpoints, KMS, secrets) | M14 | Gate A |
| 6 | Banco Demo API with seeded 12 month data and the mTLS listener | M16 | M5 sync |
| 7 | CI on every pull request, deploy to staging on merge to `develop` | M0 with M14 | Gate A |

**Gate A checklist**

* [ ] `git clone` plus `make dev` starts the whole stack locally in under 10 minutes.
* [ ] The app opens on Android and iOS with the 4 tabs and placeholder screens built from the design system, in light and dark (following the phone or the Apariencia choice).
* [ ] The tabs switch by tap and by swipe, pushed screens go back with the button and the edge swipe on both platforms, and Reduce Motion turns transitions into fades.
* [ ] `make generate`, `make lint` and `make test` pass in CI on a pull request to `develop`.
* [ ] Staging answers `GET https://api.<domain>/healthz` and Keycloak shows its themed login at `https://auth.<domain>`.
* [ ] The Banco Demo returns 12 months of movements for a seeded user through Caddy with mTLS.
* [ ] `contracts/` and the vault ports are frozen. Tag `v0.1.0-gate-a` on `main`.

## Phase 1. Core security and data

| Order | Work | Module | Depends on |
| --- | --- | --- | --- |
| 1 | Keycloak realm as code, theme, login with PKCE in the app | M1 | Gate A |
| 2 | Vault with SQLCipher, key storage, migrations runner, lock screen | M2 | Gate A |
| 3 | Audit store, append only | M13 | Gate A |
| 4 | Bank port, Banco Demo adapter, link flow, sync engine | M5 | M1 login, M2 vault, M16 API |
| 5 | Biometric unlock | M2 | M1 tokens in Keychain |
| 6 | Recovery code, encrypted backup, device approval | M2 | M1 devices endpoint |
| 7 | Bancolombia sandbox spike (time box: 3 days) | M5 | none |

**Gate B checklist**

* [ ] A new user registers in Keycloak, verifies the email and signs in from the app.
* [ ] The vault file cannot be opened with `sqlite3`, and the app unlocks it after login or with biometrics.
* [ ] The user links Banco Demo, gives consent in the Banco Demo login, and 12 months of movements land in the vault.
* [ ] Pull to refresh brings a payment made in the Banco Demo portal within 60 seconds.
* [ ] A second phone restores the manual data with the recovery code, and also through approval from the first phone.
* [ ] Audit rows exist for login, consent, link and sync, and the app's database role cannot update or delete them.
* [ ] The Bancolombia spike result is written in `docs/adr/0003-bancolombia-sandbox.md`. Tag `v0.2.0-gate-b`.

## Phase 2. Seeing the money

| Order | Work | Module | Depends on |
| --- | --- | --- | --- |
| 1 | Consent screens, list, revoke, evidence | M4 | Gate B |
| 2 | Accounts list, detail, net worth, cards, wallets, cash | M6 | M5 data |
| 3 | Transactions list, filters, search, categories | M7 | M5 data |
| 4 | Notifications inbox and local scheduling | M12 | Gate A |
| 5 | Bancolombia adapter with FAPI 2.0, or the gap documented as a finding | M5 | spike result |

**Gate C checklist**

* [ ] The Dashboard shows the total balance, income, spending, accounts and the latest movements from the vault.
* [ ] Revoking the Banco Demo consent stops the next sync with `consent_revoked` and is audited.
* [ ] Search finds a movement by partial text in under 300 ms with 12 months of data.
* [ ] A test notification fires with the app closed. Tag `v0.3.0-gate-c`.

## Phase 3. Product features

| Order | Work | Module | Depends on |
| --- | --- | --- | --- |
| 1 | Analytics engine: income, spending, categories, trends, recurring income | M10 | M7 |
| 2 | Recurring expenses and subscriptions, detection, usage, reminders, price alert, cancellation guide | M9 | M7, M12 |
| 3 | Savings goals and contributions | M8 | M7, M12 |
| 4 | Spending caps | M10 | M7, M12 |
| 5 | Guided onboarding wiring all the above | M3 | M1, M5, M6, M8, M9 |

**Gate D checklist**

* [ ] On the demo fixture, Billetera shows `4 activas · $112.600/mes`, `Ahorra $56.800 al mes` and `$1.930.600` fixed expenses.
* [ ] Detection finds every recurring charge in the fixture and flags none of the one off purchases.
* [ ] A price increase made in the Banco Demo portal produces the alert after refresh.
* [ ] A goal of $5.000.000 for Jun 2027 suggests $625.000 a month in October 2026.
* [ ] A new user can finish or skip onboarding and lands on the Dashboard. Tag `v0.4.0-gate-d`.

## Phase 4. Intelligence and compliance

| Order | Work | Module | Depends on |
| --- | --- | --- | --- |
| 1 | Bedrock proxy and Recomendaciones screen | M11 | M10 snapshot |
| 2 | Privacy policy, my data, account deletion | M13 | Gate B |
| 3 | Inversión tab: own CDTs, catalog, calculator | M15 | M5 products, M6 CDT accounts |
| 4 | Full demo rehearsal, findings document for the jury | all | everything |

**Gate E checklist**

* [ ] The same snapshot always gives the same numbers in Recomendaciones, and the disclaimer is always visible.
* [ ] Deleting the account wipes the vault, revokes consents, removes the backup and keeps only the deletion evidence.
* [ ] The Inversión tab never filters or sorts by the user's balance or profile.
* [ ] The full demo script runs in under 10 minutes on staging. Tag `v1.0.0` on `main`.

## Integration rules for every phase

* Work branches start from `develop` and merge back into `develop` by pull request (see CLAUDE.md, Git workflow).
* At each gate, the gate owner opens `release/gate-<letter>` from `develop`, fixes only blockers there, merges it into `main` and back into `develop`, and tags `main`.
* A module that needs something not ready yet codes against the stub or the Prism mock, never against another module's internals.
