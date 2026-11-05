---
date: 2026-11-05
developer: Karol
github: Karol2905
module: M9
jira: [SCRUM-56]
branch: fix/billetera-low-use-filter
tool: Claude Code
pr: none
status: done
---

# Billetera honours the low use filter of Recomendaciones

## Instruction

"sigue con lo que falta".

## What was done

* **Review.**
  * SCRUM-58 needs a contract and a Go backend together: the strict server of `internal/catalog` would stop compiling if the contract gained an endpoint without its handler. Go 1.27 still cannot be downloaded in this session (`proxy.golang.org` does not resolve), so that is left for a machine with Go.
  * Looking for what can be done without Go, a gap showed up: M11's "Revisar" opens Billetera with `{ filter: 'low_use' }`, and Billetera ignored it.
* **`ui/BilleteraScreen.tsx`:**
  * with `filter: 'low_use'`, "Otros gastos" shows only the subscriptions marked "Casi nunca";
  * above them, a selected "Solo poco uso" chip with "Toca para ver todas". Tapping it clears the param and shows them all again.
  * New exported type `BilleteraParams`.
* **Tests:** one more in `ui/BilleteraScreen.test.tsx`: with the filter only Streaming de series and Almacenamiento show (the design's low use pair), and the chip clears it.

## Result

* 207 suites and 2432 tests pass. ESLint, tsc and Prettier are clean.

## Next step

SCRUM-58 (catalog contract, Go backend and the app's "Cómo cancelarla" steps and link), on a machine with Go 1.27.
