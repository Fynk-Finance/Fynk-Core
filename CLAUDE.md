# Fynk

Fynk is a personal finance app for Colombian users, built as a university project under the Open Finance rules (Decreto 0368 de 2026, Circular Externa 004 de 2024). It helps people save, kill subscriptions they do not use, and understand their money. The MVP is shown to an academic jury, so a production barrier we cannot cross is documented as a finding in `docs/adr/`, never hidden.

Plan and prompts:

* Overview of all modules and decisions: the doc "Fynk Implementation Plan by Modules".
* One prompt per module with every technical detail: `docs/modules/M00-foundations.md` to `docs/modules/M16-banco-demo.md`.
* Shared contracts every module builds on: `docs/modules/00-shared-contracts.md`.
* Phases, order of work and gate checklists: `docs/modules/00-phases-and-gates.md`.

## Before you start a task

1. Know your module and the Jira key (project SCRUM). Every line under "Criterios de Calidad" becomes at least one test.
2. Read the latest session logs of your module in `docs/history/sessions/` to know what was already done and what was left pending.
3. Read this file, your module prompt in `docs/modules/` and `00-shared-contracts.md`.
4. Read the design code of your screens in `docs/design/sources/light/` and `docs/design/sources/dark/`, and their PNGs in `docs/design/screens/light/` and `docs/design/screens/dark/` (see Design source below).
5. Create your branch from the latest `develop` (see Git workflow). Never work on `develop` or `main` directly.
6. Write the tests from the criteria first, then the code.
7. Stay inside your module's folders. Anything another module needs goes through its `index.ts`, a port, or the API contract.
8. If the task touches an open item at the end of this file, stop and ask the team.

## Design source

* **The only visual source is the design artifact "Diseño App Fynk (Copy)", page "App azul y verde", owned by the team: https://claude.ai/artifact/DzjgXy5aVtdYQiTzq6gquk**
* The repository keeps the design's own code for every screen in two themes: `docs/design/sources/light/<Screen>.html` and `docs/design/sources/dark/<Screen>.html`. Both files have the same markup and only the colors differ. Read the code of your screens first and take exact colors, fonts, sizes, SVG illustrations, icons and animations from it. Never guess a value that is in that code. `node scripts/design-color-pairs.mjs '<light color>'` gives the dark value of any color.
* `docs/design/screens/light/` and `docs/design/screens/dark/` keep a PNG of each screen to check that the result looks the same in both themes.
* Every screen works in light and dark. The app follows the phone's setting unless the person picks Claro or Oscuro in the app.
* `docs/design/README.md` maps each screen to its code file, image, module, buttons, gestures and transition, and explains how to turn the design's HTML, SVG, CSS animations and gestures into React Native. Every screen uses the default transition and back gesture of its kind unless its inventory row says otherwise.
* When the design changes, it is edited in the copy artifact and the affected files in `docs/design/` are updated in a `docs/update-design` pull request.
* Colors, fonts, spacing and components come only from `apps/mobile/src/shared/ui/` (built by M0 from the design). Never hardcode a color or invent a style.
* When a screen is missing in the design, build it from existing components and list it in the pull request as "new screen, needs design review".
* Copy changes already decided are listed in the screen inventory of `docs/design/README.md`.

## Architecture rules

These rules are not up for debate inside a task. Changing one needs a team decision.

1. **Two hexagons, one home per rule.** The device (React Native) owns the financial domain. The backend (Go) owns identity, devices, consents, the bank proxy, the encrypted backup store, the merchant catalog, the AI proxy, market data and audit. A business rule is written once, in one of the two.
2. **Zero knowledge.** Movements, balances, goals, recurring expenses, caps, notifications and the bank token live only in the SQLCipher vault on the phone. The backend stores the backup only as ciphertext it cannot decrypt.
3. **Login is Keycloak, the vault key is not the password.** Keycloak handles registration, login, sessions and password reset. The vault key is random, created on the phone and kept in Keychain or Keystore. Biometrics only unlock it on that device. A new phone gets the key from the old phone (approval) or from the recovery code shown once at sign up. Logging in alone never decrypts anything.
4. **Sync only with the app open.** On app open, on pull to refresh, and on return to the foreground after 15 minutes, with at least 60 seconds between syncs. No background sync, no background fetch, no server push.
5. **Code calculates, the LLM writes.** Every number comes from deterministic code in the analytics module. Bedrock only receives the aggregate snapshot and writes text. Raw movements never leave the phone.
6. **Fynk never moves money.** No transfers, payments, investments or cancellations from the app. "Programar" means a reminder. "+ Invertir" opens the Banco Demo portal.
7. **One port for every bank.** All bank access goes through the provider port. Banco Demo, Billetera Demo and Bancolombia are adapters. A new bank or an aggregator must be addable without touching the domain.
8. **Banco Demo is a separate simulated bank.** It has its own login and web portal where money actions happen. Fynk reads it through the same consent, OAuth and mTLS flow as a real bank. Its data is always labeled "Simulado".
9. **Investment is informative only.** The Inversión tab shows the user's own CDTs, a catalog that is the same for every user, and a calculator. Fynk never filters, sorts or highlights products by the user's balance or profile (Decreto 2555, art. 2.40.1.1.2 and 2.40.1.1.3).
10. **No cédula.** It is not asked for and not stored. The bank identifies the user in its own login.

## Repository layout

```
fynk/
  apps/mobile/                     React Native (Expo dev builds), the device hexagon
    src/app/                       root navigation and module registry (M0)
    src/shared/                    design system, domain types, API client, events (M0)
    src/modules/<module>/
      domain/                      pure TypeScript, no React, no I/O
      application/                 use cases that call ports
      adapters/                    vault tables, API calls, OS services
      ui/                          screens, components, strings.es-CO.ts
      index.ts                     the only public entry point of the module
  services/api/                    Go backend, the backend hexagon
    cmd/api/                       entry point (M0)
    internal/app/                  Module interface and the fixed list of modules (M0)
    internal/platform/             config, logs with redaction, db, redis, clock, errors (M0)
    internal/<module>/             domain, ports, adapters, http (generated handlers)
  services/bank-simulator/         Banco Demo API and portal (M16)
  services/keycloak/               realms fynk and banco-demo, themes (M1, M16)
  services/caddy/                  egress with mTLS (M14)
  contracts/openapi.yaml           root file, only references modules/*.yaml (M0)
  contracts/modules/<module>.yaml  one contract file per backend module
  contracts/bank-simulator.yaml    Banco Demo contract (M16)
  infra/terraform/                 AWS infrastructure (M14)
  fixtures/                        shared demo data (M16)
  docs/modules/  docs/design/  docs/adr/  docs/runbooks/
  docs/history/sessions/           one log file per work session (see Project history log)
  scripts/build-history.mjs        joins the session logs into docs/history/PROJECT_HISTORY.md
```

## Modules and ownership

| Module | Mobile folder | Backend folder | Stories |
| --- | --- | --- | --- |
| M0 Foundations | `src/app`, `src/shared` | `cmd`, `internal/app`, `internal/platform`, root files | HU-051 |
| M1 Identity (Keycloak) | `modules/identity` | `internal/identity`, `services/keycloak` (realm fynk) | HU-001, HU-002, HU-005, HU-050 |
| M2 Vault and backup | `modules/vault` | `internal/backup` | HU-003, HU-004, HU-045, HU-046 |
| M3 Onboarding | `modules/onboarding` | none | HU-052 |
| M4 Consents | `modules/consents` | `internal/consents` | HU-006 to HU-008 |
| M5 Bank and sync | `modules/bank` | `internal/bank` | HU-009 to HU-011, HU-030, HU-031 |
| M6 Accounts | `modules/accounts` | none | HU-012 to HU-014, HU-019, HU-020, HU-054 |
| M7 Transactions | `modules/transactions` | none | HU-015 to HU-018 |
| M8 Savings goals | `modules/savings` | none | HU-035 to HU-037 |
| M9 Recurring and subscriptions | `modules/recurring` | `internal/catalog` | HU-038 to HU-042, HU-044 |
| M10 Analytics and caps | `modules/analytics` | none | HU-021 to HU-023, HU-043 |
| M11 AI recommendations | `modules/recommendations` | `internal/recommendations` | HU-024 to HU-026 |
| M12 Notifications | `modules/notifications` | none | HU-053 |
| M13 Compliance and audit | `modules/compliance` | `internal/privacy`, `internal/audit` | HU-027 to HU-029 |
| M14 Infrastructure | none | `infra`, `services/caddy`, deploy workflows | HU-032 to HU-034 |
| M15 Investment | `modules/investment` | `internal/market` | HU-049 |
| M16 Banco Demo | none | `services/bank-simulator`, realm banco-demo | HU-047, HU-048 |

`.github/CODEOWNERS` maps these folders to their owners, so every pull request asks the right person for review.

## Team

| Person | GitHub | Modules | Points |
| --- | --- | --- | --- |
| Daniel Palacios | `@Komi-yes` | M1 Identity, M2 Vault and backup | 39 |
| Sofia Nicolle Ariza | `@sofia-ariza-783` | M0 Foundations, M3 Onboarding, M6 Accounts, M7 Transactions | 42 |
| Juan Carlos Leal | `@JuanLeal05` | M4 Consents, M5 Bank and sync | 41 |
| Juan Pablo Contreras | `@juancontrerasp` | M13 Compliance and audit, M14 Infrastructure, M16 Banco Demo | 35 |
| Karol | `@Karol2905` | M8 Savings goals, M9 Recurring and subscriptions, M12 Notifications | 36 |
| Julián Castiblanco | `@JulCR34l` | M10 Analytics and caps, M11 AI recommendations, M15 Investment | 42 |

Each person reviews the pull requests of their modules (see `.github/CODEOWNERS`). A change to another person's module needs that person's approval.

## Where data lives

| Data | Where |
| --- | --- |
| Login, password, sessions, email verification, profile name | Keycloak (its own database) |
| Devices with public keys | Cloud, PostgreSQL schema `identity` |
| Consent metadata and acceptance evidence | Cloud, in clear, because it must be auditable |
| Bank link record with a KMS HMAC fingerprint of the token | Cloud, never the token |
| Bank token | Phone vault |
| Accounts, balances, 12 months of movements, categories | Phone vault |
| Goals, contributions, recurring items, usage marks, caps, cash, manual movements | Phone vault, plus the encrypted backup |
| Encrypted backup records and the recovery wrapped key | Cloud, ciphertext only |
| Merchant catalog with cancellation links | Cloud, shared, no personal data |
| Aggregate snapshot for the AI | In transit only, never stored |
| Audit events | Cloud, append only, hash chained |
| Nonces, refresh rate limits, caches | Redis |
| Theme preference (Sistema, Claro, Oscuro) | Phone, plain app storage outside the vault, not backed up |
| Banco Demo customers and their simulated data | Its own schema `bankdemo` |

If you are about to store something that is not in this table, ask before you do it.

## Security rules

* Never log tokens, passwords, codes, amounts, account numbers, cédulas or emails. Logs go through the redacting logger of M0.
* Never put personal or sensitive data in a URL or query string. Bank tokens travel only in request bodies.
* No secret in the repository. Use Secrets Manager in AWS and `.env.example` with fake values locally.
* JWTs are signed with PS256. HS256 and RS256 are rejected. Client authentication to banks is `private_key_jwt` signed with KMS.
* TLS on every hop. Outbound calls to banks use mTLS through the Caddy egress.
* OAuth with Keycloak and with banks uses PKCE in the system browser with a deep link return. Never a webview, never a bank password inside Fynk.
* Replay protection with nonces in Redis, 5 minute TTL.
* Show account and card numbers only as the last 4 digits.
* Every consent change, sync, backup restore and device approval writes an audit event.

## Regulatory guardrails

* A consent screen names the receiver, the data, the purpose and the term. No general or open consents. A product is never conditioned on accepting one.
* Revoking a consent takes effect at once. The next sync must fail with `consent_revoked`.
* The AI and the Inversión tab never recommend a specific investment product. Every AI result and the Inversión tab show the disclaimer that the information is not financial advice.
* User data deletion follows Ley 1581 and keeps only the evidence the law requires.

## Coding conventions

* **Money:** integers in COP centavos, never floating point. Shown with the shared formatter as `$12.480.350`.
* **Dates:** ISO 8601, stored in UTC, shown in America/Bogota. Domain code receives a clock.
* **Language:** user facing copy in Spanish (Colombia), in each module's `ui/strings.es-CO.ts`. Code, identifiers, comments, commits and pull requests in English.
* **Domain code is pure:** no network, storage, `Date.now()` or random inside `domain/`. Same input, same output.
* **TypeScript** strict, ESLint and Prettier. **Go** with `gofmt`, `go vet` and golangci-lint.
* **Tests:** unit tests for every domain function on fixed data, contract tests for every adapter, `fixtures/demo-user.json` as the shared dataset.
* **Contract first:** change `contracts/modules/<module>.yaml`, run `make generate`, then code.

## Git workflow

### Branches

* `main`: what the jury sees. Only release and hotfix merges. Tagged at each gate (`v0.1.0-gate-a` ... `v1.0.0`).
* `develop`: integration branch. Every work branch starts here and returns here by pull request.
* Work branches: `<type>/<short-description>`, lowercase words joined by hyphens, describing the task in plain English.

| Type | Use | Example |
| --- | --- | --- |
| `feature/` | New behavior | `feature/savings-goal-creation` |
| `fix/` | Bug fix | `fix/sync-cooldown-ignored` |
| `refactor/` | Same behavior, better code | `refactor/split-sync-engine` |
| `test/` | Only tests | `test/recurring-detection-fixtures` |
| `docs/` | Only documentation | `docs/bancolombia-finding` |
| `chore/` | Tooling, dependencies, config | `chore/upgrade-expo-sdk` |
| `infra/` | Terraform, Caddy, deploy | `infra/caddy-egress` |
| `spike/` | Time boxed research, never merged as product code | `spike/bancolombia-sandbox` |
| `release/` | Gate stabilization | `release/gate-b` |
| `hotfix/` | Urgent fix on `main` | `hotfix/login-redirect` |

Git cannot have a branch named `develop` and also branches named `develop/...`, so work branches never start with `develop/`.

### Commits

* Format: `<type>(<module folder>): <JIRA KEY> <what changed, imperative>`. Example: `feat(savings): SCRUM-51 add goal creation form`. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`, `perf`.
* The Jira key in the commit links it to the story automatically.
* Small commits, each one passing lint and tests for the code it touches.

### Pull requests

* Base branch `develop`. Title like the main commit. Fill `.github/pull_request_template.md`: Jira link, criteria and the test that covers each, screenshots next to the design PNG, contract changes.
* At least 1 approval from the module owner in CODEOWNERS, plus the owner of any shared file touched. CI must be green.
* Squash merge, then delete the branch.
* Keep pull requests under about 400 changed lines (generated files do not count). Split bigger work into several branches.

### Steps Claude Code follows for every task

```
git fetch origin
git switch develop
git pull --ff-only
git switch -c feature/<short-description>
# write tests, code, run checks
make lint test            # or the module's narrower commands
git add <only the files of this task>
git commit -m "feat(<module>): SCRUM-NN <summary>"
git fetch origin
git rebase origin/develop # resolve conflicts only inside your module, otherwise stop and ask
make lint test
# write the session log in docs/history/sessions/ and commit it
git commit -m "docs(<module>): SCRUM-NN add session log"
git push -u origin feature/<short-description>
gh pr create --base develop --fill   # then complete the template
```

Claude Code never pushes to `develop` or `main`, never force pushes (only `git push --force-with-lease` on its own branch after a rebase), never merges pull requests, never runs `terraform apply` or `destroy`, and never edits a file outside the module without asking. These limits are also enforced in `.claude/settings.json`.

## Project history log

The jury will ask how the project was built. So every work session leaves a short record of what was asked and what came out of it. At the end, `node scripts/build-history.mjs` joins all records into `docs/history/PROJECT_HISTORY.md`, grouped by module, by developer and by date.

**Rules**

* **One file per session, never a shared file.** Each session creates `docs/history/sessions/<YYYY-MM-DD>-<github-user>-<module>-<short-topic>.md` from `docs/history/_template.md`. Example: `2026-11-03-komi-yes-m2-sqlcipher-vault.md`. Because nobody edits another person's file, the log never causes merge conflicts.
* **Every session counts:** Claude Code sessions, claude.ai sessions (planning, design, research) and work done by hand. A session that changes no file still gets a record if it made a decision.
* **Claude Code writes it** at the end of the session, before the last commit, and shows it to the developer to confirm. The developer can correct it.
* **What it records:** who, which module and Jira keys, the branch, the instruction given in plain words (a faithful summary, quoting the key sentence), what was done, the result (tests, pull request, what works and what does not), decisions taken and why, problems found, and the next step.
* **What it never records:** secrets, tokens, passwords, personal data of real people, or amounts from real accounts.
* **Same branch as the work.** The record goes in the same branch and pull request as the code, in its own commit: `docs(<module>): SCRUM-NN add session log`.
* **Several sessions on one branch** create several files, one per session.
* **Corrections.** A wrong record is fixed in a new commit, never deleted, so the history stays honest.

## Conflict rules

These rules let 17 modules work in parallel without stepping on each other.

* **Own folders only.** Each module edits only its folders in the ownership table. Shared files are edited only by their owner (mostly M0) through a dedicated pull request. `.claude/settings.json` makes Claude Code ask before editing them.
* **Registries are created once.** M0 creates `apps/mobile/src/app/registry.ts`, `apps/mobile/src/app/linking.ts` and `services/api/internal/app/modules.go` with every module already listed. Nobody adds lines later.
* **Contracts split by module.** Each backend module has its own `contracts/modules/<module>.yaml`. The root `openapi.yaml` only references them.
* **Generated code is not committed.** `make generate` creates it locally and in CI. On a conflict in a generated file, regenerate, never merge by hand.
* **Migrations are namespaced.** Vault tables are prefixed with the module name and tracked per module. Postgres uses one schema and one migrations table per module. Two modules never share a version sequence.
* **Strings per module.** Each module has its own `strings.es-CO.ts`. There is no global strings file.
* **Dependencies.** Adding a library is its own small pull request (`chore/add-<library>`), reviewed by M0. On a lockfile conflict, take `develop`'s lockfile and run the install again, never merge it by hand.
* **Rebase often.** Rebase your branch on `origin/develop` at least once a day and before opening the pull request.
* **Formatting only on your files.** Never run a formatter over the whole repository in a feature branch.
* **Frozen contracts.** After Gate A, `00-shared-contracts.md`, the vault ports and the API conventions change only through a pull request reviewed by every affected module.

## Decisions taken (25 Oct 2026)

| Topic | Decision |
| --- | --- |
| Inversión | Own CDTs, a catalog that is the same for everyone with filters the user chooses, a calculator, Banrep reference rate, "+ Invertir" opens the Banco Demo portal |
| Login and recovery | Keycloak for login and password reset. Vault key separate from the password. New phone: approval from the old phone or recovery code |
| Cédula | Not asked, not stored |
| Sync | On open, pull to refresh, foreground after 15 minutes, 60 second cooldown, incremental |
| Simulated bank | Banco Demo with its own portal for money actions, fictional names, accounts created at consent |
| Caps | Weekly or monthly caps per category, "Antojos" under $20.000 by default, alerts at 80 % and 100 % |
| Ver plan | Removed |
| Subscriptions | User marks usage, sees the account or card of each subscription, price increase alerts |
| Biometrics | Button only where enabled, password always available, invalidated on new fingerprint or face |
| Mi cuenta | "Mis tarjetas" renamed "Mis cuentas", lists accounts and credit cards |
| Backup | Manual data encrypted on the phone and stored in the cloud as ciphertext. Replaces the WebRTC transfer between phones |
| Branches | Natural names by task type, created from `develop` |
| Project history | One log file per session in `docs/history/sessions/`, joined at the end into the project history |
| Team | Modules assigned on 26 Oct 2026, see Team |
| Dark mode (27 Oct) | Every screen in light and dark. Follows the phone by default, the person can pick Claro or Oscuro in Mi cuenta › Apariencia |
| Navigation and gestures (27 Oct) | One default transition and back gesture per kind of screen (push, modal, sheet, tab, flow change), changed only when the design inventory says so. Every gesture has a button. Tabs switch by tap and by swipe |
| Email codes (27 Oct) | Email verification at sign up and password reset use a 6 digit code sent by email, as in the design, instead of Keycloak's links. A Keycloak extension in `services/keycloak/extensions/email-code` does it: 10 minutes, 5 attempts per code, a new code every 60 s, 10 wrong codes in 12 h per user. See `docs/adr/0007-email-codes.md` |
| Offline sessions (27 Oct) | No `offline_access`. The app keeps a normal refresh session (30 days idle, 90 days max) |

## Open items (ask the team, do not decide in code)

1. Egress cost: without a NAT Gateway, the required VPC endpoints cost about USD 51 a month against about 33 for a NAT Gateway (see `docs/modules/M14-infrastructure.md`).
2. Whether the Bancolombia sandbox allows delegated access to personal accounts (spike in M5).
3. Audit retention periods (M13).
4. The design has 6 Fynk Plus subscription screens (`Sub*.html` in `docs/design/sources/`) that are not in Jira or in any module yet. Do not build them until the team plans them.
5. "Privacidad y datos" in the design has a "Mejorar Fynk" switch that shares anonymous usage statistics. That data is not in "Where data lives". Hidden until the team decides.
6. "Centro de ayuda" in the design offers support by WhatsApp. The team has to decide the channel and who answers it.

## Glossary

| Spanish term | Meaning in code |
| --- | --- |
| Bóveda | Vault |
| Consentimiento | Consent |
| Movimiento | Transaction |
| Meta, plan de ahorro | Savings goal |
| Aporte | Contribution |
| Gasto recurrente, gasto fijo | Recurring item, kind `fixed` |
| Suscripción | Recurring item, kind `subscription` |
| Tope | Spending cap |
| Antojos | Category `treats` |
| Billetera | Wallet tab, or a digital wallet account |
| Efectivo | Manual cash account |
| Código de recuperación | Recovery code |
| Banco Demo, cuentas falsas | Simulated bank (M16) |
