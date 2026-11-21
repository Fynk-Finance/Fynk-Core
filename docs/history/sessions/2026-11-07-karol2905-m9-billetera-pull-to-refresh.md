---
date: 2026-11-07
developer: Karol
github: Karol2905
module: M9
jira: [SCRUM-56]
branch: feature/billetera-pull-to-refresh
tool: Claude Code
pr: none
status: done
---

# Pull to refresh in Billetera (HU-011)

## Instruction

Karol shared the review note of M4 and M5 (Juan Carlos, on `develop` at de81f3d): "Deslizar para actualizar en Billetera. Falta el RefreshControl. Hay que llamar syncNow() de M5, igual que en Movimientos." The 60 second cooldown is M5's, so Billetera does not manage it.

## What was done

* **`ui/BilleteraScreen.tsx`:**
  * New optional dependency `refresh` and a `RefreshControl` with the theme's primary color, as in Movimientos (`AllTransactionsScreen`).
  * Pulling down calls it and then reloads the items. A failed sync (cooldown, offline) still ends the spinner.
  * The shared `Screen` takes no `refreshControl`, so Billetera keeps `Screen` for the header and puts its own `ScrollView` inside, with the same padding `Screen` gives a scroll above the tab bar. No M0 file is touched.
* **`index.ts`:** `refresh: () => syncNow()` from `@modules/bank`.
* **Tests in `ui/BilleteraScreen.test.tsx` (3):**
  * the pull calls the sync and shows what it wrote;
  * a failed sync ends the refresh;
  * there is no RefreshControl when M5 is not wired.

## Result

* 235 suites and 2628 tests pass. ESLint, tsc and Prettier are clean.
* Not tried on a device; Juan Carlos will run his end to end test again.

## Decisions and problems

* **A local ScrollView instead of a `refreshControl` prop on `Screen`.** That would touch M0's shared component. If Sofia adds the prop, Billetera can go back to `Screen scroll`.

## Next step

Tell Juan Carlos to run the M4/M5 test again on Billetera.
