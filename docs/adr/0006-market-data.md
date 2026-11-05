# ADR 0006: Market data for the Inversión tab

* Status: proposed
* Date: 2026-10-28
* Owner: M15 Investment (Julián Castiblanco / `@JulCR34l`)
* Jira: SCRUM-66 (HU-049)

---

## 1. Context

The Inversión tab informs, it never advises (CLAUDE.md, rule 9; Decreto 2555, art. 2.40.1.1.2 and 2.40.1.1.3). It shows three kinds of market data, all the same for every user:

1. The CDT catalog of the connected banks (Banco Demo, simulated).
2. The weekly average CDT rate at 360 days published by Banco de la República, as a reference.
3. Reference prices of 10 US stocks from Alpaca.

None of the three endpoints reads the user, a balance or a profile. `internal/market/http_test.go` (`TestSameAnswerForEveryUser`) and the phone's Explorar test check it.

## 2. Decisions

### 2.1 Alpaca is non commercial reference data (finding for the jury)

Alpaca's market data API is free on the Basic plan with the IEX feed. Requests must carry `feed=iex`; without it Alpaca answers 403. The data is delayed and covers only the IEX exchange, so it is labeled on screen "Precios de referencia del mercado de EE. UU., con demora".

**Production barrier:** redistributing Alpaca data to third parties in a commercial product requires their Broker API agreement. The MVP shows it to a university jury as non commercial reference data. A commercial launch would need that agreement or another licensed source. This is documented, not hidden.

Other rules:

* The list of symbols is fixed in configuration (`MARKET_SYMBOLS`, 10 symbols by default) and is the same for every user.
* Prices are kept in US cents (integers) and the day change in basis points. Alpaca times are converted to UTC; a time without an offset is read as US Eastern.
* The board is cached for 15 minutes in Redis.
* The keys `ALPACA_API_KEY_ID` and `ALPACA_API_SECRET_KEY` come from Secrets Manager and are never logged. Without them the endpoint answers `503 market_unavailable` and the phone hides the Acciones list.

### 2.2 Banco de la República reference rate

The module downloads the published weekly rates at most once a day, when the tab asks for them (`GET /market/cdt-reference`), and stores them in `market.cdt_reference (week, term_days, rate_ea_bps, source_url, fetched_at)`. If the download fails, the last value stays with its week; the answer is `stale` when that week is more than 14 days old.

**Open point:** we could not confirm from the build environment the exact file Banco de la República publishes (its page is not reachable from there). The parser (`internal/market/reference/parse.go`) reads a CSV with a date column (`fecha`, `semana` or `periodo`) and a `360` column, with `;` or `,` and a decimal comma or point. The URL is configured with `MARKET_BANREP_CDT_CSV_URL`. Before Gate E, someone must download the real file, confirm the format, and adjust the parser and its tests if it differs (for example if it is only published as `.xlsx`). Until the URL is set, the endpoint answers `503` and the phone hides the reference box. No value is ever invented.

### 2.3 CDT catalog through the bank port, calls through the egress

The catalog is built from M5's bank port: `catalog.FromProvider` takes anything with `Products(ctx) ([]bankports.Product, error)`, which every M5 provider adapter has (shared contracts 4.4, rule 7). M5's Banco Demo adapter (`bank/adapters/bankdemo`) already has `Products()`, but the module isolation rule (`depguard` in `services/api/.golangci.yml`) lets `internal/market` import only `internal/bank/ports`, so the market cannot build that adapter itself. Until M5 exposes the catalog through `bank/ports` (for example an installed `ProductLister`, the same way it exposes `InstalledRevoker`), `catalog.BankDemoProducts` reads Banco Demo's public catalog (`GET /open-finance/v1/products/cdt`, no user token) and answers with M5's `bankports.Product`. Then the module passes M5's lister to `FromProvider` and `BankDemoProducts` is deleted. Cached for 1 hour.

Banco Demo and Alpaca are called through the Caddy egress of the shared config (`EGRESS_URL`, `EGRESS_CA_FILE`, M0 #53), at `<EGRESS_URL>/banco-demo` and `<EGRESS_URL>/alpaca`, with the egress CA trusted. Without `EGRESS_URL` both fail closed (503). The Banco de la República file is not behind the egress yet: M14 has to add a route for it, or the download has to come from outside the private subnets.

### 2.4 "+ Invertir"

Fynk never executes an investment (rule 6). "+ Invertir" opens Banco Demo's portal in the system browser. The module prompt names `/portal/cdt`, but the simulator serves CDT opening at `/portal/actions`; the app opens `EXPO_PUBLIC_BANCO_DEMO_PORTAL_URL` + `/portal/actions` until M16 decides the final path.

## 3. Consequences

* Same answer for every user, cached, with no personal data in Redis or Postgres.
* Two production barriers are documented: Alpaca's licensing and the confirmation of Banco de la República's file format.
