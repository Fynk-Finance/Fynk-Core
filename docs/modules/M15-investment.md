# M15 Inversión tab (informative, not advice)

| Item | Value |
| --- | --- |
| Phase | 4 |
| Stories | HU-049 SCRUM-66 (5) |
| Points | 5 |
| Owner | Julián Castiblanco (`@JulCR34l`) |
| Owns | `apps/mobile/src/modules/investment/`, `services/api/internal/market/`, `contracts/modules/market.yaml` |
| Depends on | M5 (`Products()` port, Caddy route to Alpaca), M6 (`getCdtAccounts()`), M16 (CDT products and the portal) |
| Used by | Inversión tab |

How to use: open Claude Code at the repository root on a fresh branch from `develop` and paste everything below the line.

---

You are building module M15 of Fynk: the Inversión tab. It informs, it never advises. Under Decreto 2555 (art. 2.40.1.1.2 and 2.40.1.1.3) a personalized recommendation is advice, which only supervised entities may give, and general content must not suggest that a product suits the user. So the rule for every line of code here: **the user chooses the filters and the order, Fynk never chooses based on the user's balance, income or profile.**

## Read first

1. `CLAUDE.md` (Architecture rule 8, Regulatory guardrails).
2. Design screen `Inversion` (lower part) and the change notes in `docs/design/README.md`. Read the code of these screens in `docs/design/sources/light/` and `docs/design/sources/dark/` first (inventory, gestures and transitions in `docs/design/README.md`) and take exact values, SVGs and animations from it. The PNGs in `docs/design/screens/light/` and `docs/design/screens/dark/` are for checking the result. Every screen works in light and dark (colors only from `useTheme()`), and uses the default transition and back gesture of its kind unless the inventory says otherwise.
3. Jira SCRUM-66.

## Story HU-049 (SCRUM-66), criteria

* "Tus inversiones" muestra los CDT que el usuario tiene en el Banco Demo con monto, tasa, plazo y fecha de vencimiento.
* "Explorar" muestra la misma lista para todos los usuarios: CDT del Banco Demo y precios de mercado de Alpaca.
* El usuario elige el orden y los filtros (tasa, plazo, riesgo). Fynk no filtra ni ordena según el saldo o el perfil del usuario.
* Una calculadora recibe monto y plazo escritos por el usuario y muestra el rendimiento estimado.
* Muestra la tasa promedio del mercado publicada por el Banco de la República como referencia.
* "+ Invertir" abre el portal del Banco Demo. Fynk no ejecuta inversiones.
* Debe mostrarse el descargo de que la información no constituye asesoría financiera.
* No debe usar lenguaje que sugiera que un producto es adecuado para el usuario.

## Screen (adapted from the PNG)

* Header "Inversión · Tus CDT", total of the user's own CDTs (sum of `balanceMinor` of `cdt` accounts from M6), and the line chart of that total over time (from M6 balance history) with period chips 1M, 3M, 1A, Todo.
* Tiles: "Intereses estimados 2026" and "Tasa promedio de tus CDT" (weighted by amount), "Próximo vencimiento". Remove "Aporte mensual" (it was a placeholder `[MONTO]`).
* "Tus inversiones": rows with "CDT Banco Demo", "6 meses · vence 15 mar", amount, "10,50 % E.A.". Empty state: "Aún no tienes CDT en tus cuentas conectadas."
* "Explorar": segmented control CDT and Acciones. Filter chips the user sets: plazo (90, 180, 360, 540 días), riesgo (Bajo, Moderado, Alto). Sort selector: Tasa, Plazo, Nombre. Default sort: Nombre (neutral). Each CDT product row: name, term, rate, risk bars as in the design, "Simulado" badge. Acciones shows a fixed list of 10 symbols (the same for every user, defined in config) with last price and day change from Alpaca, labeled "Precios de referencia del mercado de EE. UU., con demora".
* "Calculadora": amount and term typed by the user, rate picked from a product or typed, shows "Recibirías aproximadamente $X en intereses" using compound effective annual interest: `interest = amount * ((1 + ea) ^ (days / 365) - 1)`, rounded down to the peso. Never prefill the amount from the user's balance.
* Reference box: "Tasa promedio CDT a 360 días en Colombia: X % E.A. (Banco de la República, semana del <fecha>)."
* "+ Invertir" opens `https://bancodemo.<domain>/portal/cdt` in the browser.
* Disclaimer always visible at the bottom: "La información de esta sección es general e informativa. No es una recomendación ni asesoría de inversión. Las decisiones de inversión son tuyas."

**Forbidden wording** (add a unit test that scans `strings.es-CO.ts`): "recomendado", "ideal para ti", "te conviene", "según tu perfil", "puedes invertir", "deberías", "mejor opción".

## Technical design

* Backend `internal/market/`:
  * `GET /market/cdt-products`: from M5 `Products()` for Banco Demo, cached 1 hour in Redis. Same response for every user.
  * `GET /market/cdt-reference`: weekly average CDT rates by term published by Banco de la República (https://www.banrep.gov.co/es/tasas-captacion-semanales-y-mensuales). A daily job downloads the published file, parses the 360 day rate and stores it in `market.cdt_reference (week, term_days, rate_ea_bps, source_url, fetched_at)`. If the download fails, keep the last value and show its date.
  * `POST /market/quotes` with the fixed symbols from config: calls Alpaca market data through the Caddy egress with `feed=iex` (required, otherwise Alpaca answers 403), cached 15 minutes. Convert Alpaca timestamps (US Eastern) to UTC before storing and to Bogotá time on screen.
  * Note for the jury in `docs/adr/0006-market-data.md`: showing Alpaca data to third parties commercially would require their Broker API tier. The MVP uses it as non commercial reference data.
* Mobile: reads M6 `getCdtAccounts()`. The filters and sort live only in component state. There is no code path that reads balances to filter or sort the catalog (add a test that renders Explorar with two users of different balances and asserts the same list).

## Work plan (one branch each, from `develop`)

1. `feature/market-backend`: CDT products, Banrep reference job, Alpaca quotes with caching.
2. `feature/investment-own-cdts`: header, tiles, Tus inversiones.
3. `feature/investment-explore-and-calculator`: Explorar, filters, calculator, disclaimer, wording test.

## Tests

* Calculator: 1.000.000 at 10,50 % E.A. for 180 days gives `$50.471` (rounded down to the peso).
* Same catalog for two different users. Wording scan passes.
* Alpaca request always includes `feed=iex`.

## Done when

* All criteria pass and Gate E's Inversión item passes.

## Ask before

* Any feature that uses the user's money data to choose, rank or highlight a product.
