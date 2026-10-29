# Fynk shared contracts

Every module builds against the contracts in this file. M0 creates them in code at Gate A, with stub implementations, so all modules can start in parallel. After Gate A a change here needs a pull request reviewed by every module that uses the contract.

Design source for every screen: the artifact "Diseño App Fynk", page "App azul y verde", https://claude.ai/artifact/8Kd485z9voJE5QjuUJodL7. See `docs/design/README.md`.

## 1. Conventions

| Topic | Rule |
| --- | --- |
| Money | `MoneyMinor`: integer COP centavos. `$12.480.350` is `1248035000`. Never floats. |
| Money display | Shared `formatCop(minor)` prints `$12.480.350` (dot thousands, no decimals). Signed variant prints `+$5.200.000` and `-$184.300`. |
| Dates | ISO 8601. Stored in UTC. Shown in `America/Bogota`. Domain code receives a `Clock`, never calls `Date.now()`. |
| IDs | UUID v7 strings, generated on the side that creates the record. |
| Language | UI copy in Spanish (Colombia) in each module's `strings.es-CO.ts`. Code, identifiers and commits in English. |
| Errors (API) | RFC 9457 `application/problem+json` with `type`, `title`, `status`, `detail` and a stable `code` such as `consent_revoked`. |
| Personal data | Never in URLs, query strings or logs. Bank tokens only in request bodies. |
| Idempotency | Every POST that creates something accepts `Idempotency-Key`. |
| Tracing | Every request carries `X-Request-Id`. The backend generates one when missing. |

## 2. Device domain types

File: `apps/mobile/src/shared/domain/types.ts` (owned by M0).

```ts
export type Id = string
export type IsoDate = string          // '2026-10-25'
export type IsoDateTime = string      // '2026-10-25T14:03:00Z'
export type MoneyMinor = number       // integer COP centavos

export type ProviderId = 'banco-demo' | 'billetera-demo' | 'bancolombia'
export type AccountKind = 'savings' | 'checking' | 'wallet' | 'credit_card' | 'cdt' | 'cash'

export interface Account {
  id: Id
  provider: ProviderId | 'manual'
  providerAccountId: string | null
  linkId: Id | null                   // bank link that produced it, null for manual
  kind: AccountKind
  displayName: string                 // 'Banco Demo · Ahorros'
  last4: string | null                // only the last 4 digits are ever stored
  currency: 'COP'
  balanceMinor: MoneyMinor            // credit_card: amount owed (positive)
  availableMinor: MoneyMinor | null   // credit_card: available credit
  creditLimitMinor: MoneyMinor | null
  paymentDueOn: IsoDate | null        // credit_card only
  status: 'active' | 'closed' | 'revoked'
  isSimulated: boolean
  lastSyncedAt: IsoDateTime | null
  cdt: CdtDetails | null
}

export interface CdtDetails {
  rateEaBps: number                   // effective annual rate in basis points, 1050 = 10,50 % E.A.
  termDays: number
  openedOn: IsoDate
  maturesOn: IsoDate
}

export type CategoryId =
  | 'salary' | 'income_other' | 'rent' | 'utilities' | 'telecom' | 'groceries'
  | 'restaurants' | 'cinema' | 'treats' | 'transport' | 'subscriptions' | 'health'
  | 'education' | 'shopping' | 'gym' | 'transfers' | 'savings' | 'card_payment'
  | 'fees' | 'other'

export interface Transaction {
  id: Id
  accountId: Id
  providerTxId: string | null         // null for manual entries
  source: 'bank' | 'manual'
  bookedAt: IsoDateTime
  amountMinor: MoneyMinor             // negative = money out, positive = money in
  description: string
  merchantRaw: string | null
  merchantKey: string | null          // output of shared normalizeMerchant()
  categoryId: CategoryId
  categorySource: 'rule' | 'user' | 'bank'
  status: 'booked' | 'pending'
  goalId: Id | null                   // set when the movement is a savings contribution
}

export interface Clock { now(): Date }
```

Spanish labels for `CategoryId` live in `apps/mobile/src/shared/domain/categories.ts`: Salario, Otros ingresos, Arriendo, Servicios públicos, Internet y celular, Mercado, Restaurantes, Cine, Antojos, Transporte, Suscripciones, Salud, Educación, Compras, Gimnasio, Transferencias, Ahorro, Pago de tarjeta, Comisiones, Otros.

`normalizeMerchant(raw: string): string` lowercases, strips accents, removes digits, card suffixes and city words, and collapses spaces. M7 and M9 both use it, so it lives in `shared/domain`.

## 3. Device ports

Each module exposes its public API only through `apps/mobile/src/modules/<module>/index.ts`. Importing anything else from another module is blocked by ESLint (`eslint-plugin-boundaries`).

### 3.1 Vault (owned by M2)

```ts
export interface VaultDb {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>
  execute(sql: string, params?: unknown[]): Promise<void>
  transaction<T>(fn: (tx: VaultTx) => Promise<T>): Promise<T>
}
export interface VaultTx {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>
  execute(sql: string, params?: unknown[]): Promise<void>
}
export interface VaultMigration { version: number, up: string }
export function registerVaultMigrations(module: ModuleName, migrations: VaultMigration[]): void
export function getVaultDb(): VaultDb          // throws VaultLockedError while locked
```

Rules:

* Each module owns its tables, always prefixed with the module name: `accounts_accounts`, `transactions_transactions`, `savings_goals`, `recurring_items`, `analytics_caps`, `notifications_inbox`, `bank_links`, `bank_tokens`.
* Each module keeps its migrations in `modules/<module>/adapters/vault/migrations.ts`. The runner tracks `vault_migrations(module, version)`, so two modules never collide on a version number.
* A module reads another module's data only through that module's public functions, never with SQL on its tables.

### 3.2 Backup (owned by M2)

```ts
export interface BackupCollection<T> {
  module: ModuleName
  collection: string                  // 'savings.goals'
  exportAll(): Promise<{ id: Id, version: number, deleted: boolean, data: T }[]>
  importAll(records: { id: Id, version: number, deleted: boolean, data: T }[]): Promise<void>
}
export function registerBackupCollection<T>(c: BackupCollection<T>): void
export function markDirty(collection: string, id: Id): void   // call after every local write
```

Collections that must register: `accounts.cash` (M6), `transactions.manual` and `transactions.category_overrides` (M7), `savings.goals` and `savings.contributions` (M8), `recurring.items` and `recurring.usage_marks` (M9), `analytics.caps` (M10), `notifications.settings` (M12). Bank movements and bank tokens are never registered.

### 3.3 App events (owned by M0)

```ts
export type AppEvent =
  | { type: 'sync.completed', at: IsoDateTime, linkIds: Id[], newTransactionIds: Id[], changedAccountIds: Id[] }
  | { type: 'sync.failed', at: IsoDateTime, linkId: Id, code: string }
  | { type: 'transactions.changed', ids: Id[] }
  | { type: 'goal.progress', goalId: Id, percent: number }
  | { type: 'recurring.detected', count: number }
  | { type: 'vault.unlocked' }
  | { type: 'vault.locked' }
export const appEvents: { emit(e: AppEvent): void, on<T extends AppEvent['type']>(type: T, fn: (e: Extract<AppEvent, { type: T }>) => void): () => void }
```

### 3.4 Notifications (owned by M12)

```ts
export type NotificationKind =
  | 'payment_due' | 'income_received' | 'recommendation' | 'goal_milestone'
  | 'sync_result' | 'subscription_renewal' | 'subscription_price_up' | 'cap_warning' | 'cap_reached'
  | 'device_approval'
export interface NotifyInput {
  kind: NotificationKind
  title: string                        // 'Servicios públicos'
  body: string                         // 'Vence en 2 días: $186.000.'
  deepLink: string                     // 'fynk://billetera/recurrentes/<id>'
  dedupeKey: string                    // same key never shows twice
}
export interface ScheduleInput extends NotifyInput { id: string, fireAt: IsoDateTime }
export interface NotificationsPort {
  notify(n: NotifyInput): Promise<void>                // inbox entry now
  schedule(n: ScheduleInput): Promise<void>           // local OS notification + inbox entry when it fires
  cancel(id: string): Promise<void>
  isEnabled(kind: NotificationKind): Promise<boolean>
}
```

### 3.5 Analytics snapshot (built by M10, sent by M11)

This is the only financial object that leaves the device. It has no merchant names, no account numbers, no individual transactions and no goal names.

```ts
export interface AggregateSnapshot {
  schemaVersion: 1
  periodEnd: IsoDate
  months: 12
  monthlyIncomeMinor: MoneyMinor[]          // oldest first, length 12
  monthlySpendMinor: MoneyMinor[]
  spendByCategory: { categoryId: CategoryId, last30dMinor: MoneyMinor, prev30dMinor: MoneyMinor }[]
  recurringIncome: { kind: 'salary' | 'other', monthlyMinor: MoneyMinor }[]
  fixedExpensesMonthlyMinor: MoneyMinor
  subscriptions: { count: number, monthlyMinor: MoneyMinor, lowUseCount: number, lowUseMonthlyMinor: MoneyMinor }
  goals: { ref: string, categoryId: CategoryId, targetMinor: MoneyMinor, savedMinor: MoneyMinor, monthsLeft: number, onTrack: boolean }[]
  caps: { categoryId: CategoryId, period: 'week' | 'month', capMinor: MoneyMinor, spentMinor: MoneyMinor }[]
  opportunities: { factKey: string, kind: 'subscriptions' | 'category_increase' | 'payday_contribution', categoryId: CategoryId | null, monthlyMinor: MoneyMinor }[]
}
```

### 3.6 Theme and navigation (owned by M0)

Every screen works in light and dark and moves between screens with the same animations and gestures. Modules never pick colors or write navigator options by hand.

```ts
// @shared/ui
export type ThemePreference = 'system' | 'light' | 'dark'   // default 'system': follow the phone
export type ColorScheme = 'light' | 'dark'
export interface Theme { scheme: ColorScheme, colors: Palette, shadow: Shadows }   // Palette: same keys in both schemes
export function useTheme(): Theme
export function useThemedStyles<T>(factory: (theme: Theme) => T): T             // memoized per scheme
export function useThemePreference(): [ThemePreference, (next: ThemePreference) => void]

// @shared/navigation
export type ScreenTransition = 'push' | 'modal' | 'sheet' | 'fade' | 'none'
export type BackGesture = 'default' | 'vertical' | 'off'
export interface ModuleScreen {
  name: `${ModuleName}.${string}`
  component: ComponentType
  path?: string
  transition?: ScreenTransition   // default 'push'
  gesture?: BackGesture           // default: edge swipe for 'push', swipe down for 'modal' and 'sheet'
}
```

* The theme preference is stored on the phone in plain app storage (key `ui.themePreference`), outside the vault, so the lock screen is themed before unlock. It is not personal data and it is not backed up.
* `transition` replaces the earlier `presentation` field. A screen sets `transition` or `gesture` only when its row in the inventory of `docs/design/README.md` says so.
* Reduce Motion turns every transition into `'fade'` and stops loops. Gate flows (sign in, unlock, onboarding) change with a fade and have no gesture back.
* Every gesture inside a screen has a button or an accessibility action that does the same.
* The tabs switch by tap and by horizontal swipe. A horizontal carousel inside a tab scrolls first and hands the swipe to the tabs at its edge.

## 4. Backend contracts (Go)

### 4.1 Module registration (owned by M0)

```go
// services/api/internal/app/module.go
type Module interface {
    Name() string
    Routes(r chi.Router)          // mounted under /v1
    Migrations() fs.FS            // embedded SQL, own Postgres schema
}

type Deps struct {
    DB     *pgxpool.Pool
    Redis  *redis.Client
    Audit  audit.Recorder
    Clock  clock.Clock
    Log    *slog.Logger
    Config config.Config
}

// services/api/internal/app/modules.go is created once by M0 with one line per module.
// Nobody adds lines later, so it never conflicts.
func All(d Deps) []Module {
    return []Module{
        identity.New(d), backup.New(d), consents.New(d), bank.New(d),
        catalog.New(d), recommendations.New(d), privacy.New(d), market.New(d),
    }
}
```

Each module owns one Postgres schema with the same name (`identity`, `backup`, `consents`, `bank`, `catalog`, `privacy`, `audit`, `market`) and its own migrations table through golang-migrate `x-migrations-table=<module>_migrations`.

### 4.2 Authentication (implemented by M1)

```go
// Middleware validates the Keycloak access token (PS256, JWKS cached, iss and aud checked).
func Require(next http.Handler) http.Handler
func UserFrom(ctx context.Context) (User, bool)

type User struct {
    ID            string   // Keycloak sub
    EmailVerified bool
    DeviceID      string   // from X-Device-Id, checked against identity.devices
    SessionID     string   // Keycloak sid claim; M1 revokes it when the device is removed
}
```

Until M1 lands, M0 ships a stub that accepts the token `dev-token` only when `APP_ENV=local`.

### 4.3 Audit (implemented by M13, stub by M0)

```go
type Recorder interface {
    Record(ctx context.Context, e Event) error
}
type Event struct {
    Type     string            // 'consent.granted', 'bank.sync', 'backup.restored'
    UserID   string
    DeviceID string
    At       time.Time
    Meta     map[string]string // never amounts, tokens, emails or account numbers
}
```

Required event types: `auth.login`, `auth.login_failed`, `auth.password_reset`, `device.registered`, `device.approved`, `device.rejected`, `device.removed`, `consent.created`, `consent.granted`, `consent.revoked`, `consent.expired`, `bank.link_created`, `bank.sync`, `bank.sync_failed`, `bank.token_refreshed`, `backup.uploaded`, `backup.restored`, `recovery_key.set`, `privacy.deletion_requested`, `privacy.deletion_completed`.

### 4.4 Bank provider port (owned by M5)

```go
type Provider interface {
    ID() string                                                       // 'banco-demo', 'bancolombia'
    PushAuthorization(ctx context.Context, r PARRequest) (PARResult, error)
    ExchangeCode(ctx context.Context, r CodeExchange) (TokenSet, error)
    Refresh(ctx context.Context, refreshToken string) (TokenSet, error)
    Accounts(ctx context.Context, accessToken string) ([]Account, error)
    Transactions(ctx context.Context, accessToken, accountID string, since time.Time, cursor string) (TxPage, error)
    RevokeConsent(ctx context.Context, providerConsentID string) error // client credentials, no user token
    Products(ctx context.Context) ([]Product, error)                   // public catalog, used by M15
}
```

Both adapters (`bankdemo`, `bancolombia`) call the bank through the Caddy egress, which adds the Fynk mTLS client certificate.

### 4.5 Consent check (owned by M4)

```go
type ConsentChecker interface {
    Active(ctx context.Context, userID, consentID string) (bool, error)
    MarkGranted(ctx context.Context, consentID, providerConsentID string) error
}
```

M5 calls `Active` before every request to a bank and returns `409 consent_revoked` when it is false.

## 5. API surface

The contract lives in `contracts/openapi.yaml`, which only references `contracts/modules/<module>.yaml`. Each module edits only its own file. `make generate` bundles it with Redocly and generates:

* Go: one package per module with oapi-codegen (`include-tags: [<module>]`, strict server) at `services/api/internal/<module>/http/api.gen.go`.
* TypeScript: `apps/mobile/src/shared/api/schema.gen.ts` with openapi-typescript, used through openapi-fetch.

Generated files are gitignored and rebuilt by `make generate` and by CI, so they never cause merge conflicts.

| Module | Endpoints (all under `/v1`) |
| --- | --- |
| M1 identity | `GET /me`, `PATCH /me`, `POST /devices`, `GET /devices`, `GET /devices/current`, `DELETE /devices/{id}`, `POST /devices/sign-out-others` |
| M2 backup | `PUT /backup/records`, `GET /backup/records`, `PUT /backup/recovery-key`, `GET /backup/recovery-key`, `POST /device-approvals`, `GET /device-approvals/pending`, `GET /device-approvals/{id}`, `POST /device-approvals/{id}/approve`, `POST /device-approvals/{id}/reject` |
| M4 consents | `GET /consent-texts/current`, `POST /consents`, `GET /consents`, `GET /consents/{id}`, `POST /consents/{id}/revoke` |
| M5 bank | `GET /providers`, `POST /bank/authorizations`, `POST /bank/authorizations/{id}/exchange`, `POST /bank/accounts/query`, `POST /bank/transactions/query`, `POST /bank/tokens/refresh` |
| M9 catalog | `GET /catalog/merchants` (ETag) |
| M11 recommendations | `POST /recommendations` |
| M13 privacy | `GET /privacy/policy`, `GET /privacy/my-data`, `POST /privacy/deletion-requests`, `GET /privacy/deletion-requests/{id}` |
| M15 market | `GET /market/cdt-products`, `GET /market/cdt-reference`, `POST /market/quotes` |

The Banco Demo has its own contract in `contracts/bank-simulator.yaml`, owned by M16.

## 6. Parallel work without waiting

* Mobile modules run against a mock of the whole API with Prism: `make mock-api` serves the bundled contract on port 4010 with example responses. Every endpoint in a module file needs at least one example.
* Backend modules use the stubs from M0 (auth, audit, consent check) until the real ones land.
* The shared fixture `fixtures/demo-user.json` (owned by M16) holds the 12 month dataset every module tests against. Its numbers match the design (section 7).

## 7. Reference numbers from the design

These values come from the design screens. Unit tests use them as fixtures.

| What | Inputs | Expected |
| --- | --- | --- |
| Subscriptions total (Billetera) | 38.900 + 32.900 + 16.900 + 23.900 | `4 activas · $112.600/mes` |
| Low use saving (Billetera) | Streaming de series 32.900 + Almacenamiento 23.900 marked low | `Ahorra $56.800 al mes` |
| Fixed expenses this month (Billetera) | Arriendo 1.400.000 + Servicios 186.000 + Gimnasio 22.250 weekly (4 Mondays) + Transporte 6.500 daily (22 weekdays) + subscriptions 112.600 | `$1.930.600` in a month with 4 Mondays and 22 weekdays (September or October 2026) |
| Onboarding recurring total | 1.200.000 + 95.000 + 38.900 + 120.000 | `$1.453.900` |
| Suggested monthly contribution | 5.000.000 target, deadline Jun 2027, today Oct 2026 | 8 months, `$625.000` |
| Suggested monthly contribution | 3.000.000 target, 14 months | `$215.000` (rounded up to the next $1.000) |
| Onboarding goals total | 625.000 + 215.000 | `2 metas $840.000/mes` |
| Goal progress | 3.200.000 of 5.000.000 | `64 %` |
| Onboarding accounts total | 3.200.000 + 4.600.000 + 600.000 cash | `$8.400.000` |
| Suggested monthly contribution (Metas) | 800.000 target, 520.000 saved, deadline Dec 2026, today Oct 2026 | `Faltan 2 meses`, `$140.000/mes`, `Te falta $280.000`, `65%` |
| Share of income to goals (Metas) | 1.309.000 a month of 5.580.000 income | `23 %` (rounded to the nearest whole number) |
| Spending by category (Estadísticas) | Hogar 1.400.000, Comida 627.000, Transporte 418.000, Entretenimiento 313.400, Servicios 278.600, Otros 445.400 | Total `$3.482.400`; `40 %`, `18 %`, `12 %`, `9 %`, `8 %`, `13 %` |
| Daily average (Estadísticas) | 3.482.400 over the last 30 days | `$116.080` |
| Balance of the period (Estadísticas) | 5.580.000 income − 3.482.400 spending | `Balance +$2.097.600` |

The Dashboard mock shows `$12.480.350` next to accounts that add up to `$8.600.000`. That mock is not consistent, so tests use the formula (sum of active balances plus cash), not that number.
