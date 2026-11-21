---
date: 2026-10-30
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M6
jira: [SCRUM-33, SCRUM-34]
branch: feature/mis-cuentas-sections
tool: Claude Code
pr: none
status: done
---

# Mis cuentas sections for Billetera and Mi cuenta, first part of M6 branch 4

## Instruction

Daniel (M1) and Karol (M9) agreed to have "Mis cuentas" on their screens, with one condition: "do not change any logic from their screens and modules. Exclusively the ones related to our module." The plan they approved splits branch 4 in three: this PR with everything inside `modules/accounts`, then one PR per screen with only the import and the render line.

## What was done

* `ui/MisCuentas.tsx`: two components with no props, `MisCuentasBilletera` and `MisCuentasMiCuenta`, exported from `index.ts`.
  * Billetera (design `Billetera.html`): "Mis cuentas" with "+ Conectar" (opens `bank.Connect`, M5) and the 162×104 blue cards with initials, chevron, "Banco Demo · Ahorros" and the amount.
  * Mi cuenta (new section, needs design review): outlined cards with entity, "Activa", "Simulado", "Cuenta de ahorros · •• 4821", "Saldo disponible" and the amount. Credit cards show "Cupo disponible", then "Cupo total $5.000.000 · Pago el 5 nov" (HU-019).
  * A card opens Detalle de cuenta. No CDTs, as in Detalle de cuentas. Loading and empty states.
* Mi cuenta gets its section through the M0 slot `miCuenta.misCuentas` (`feature/shared-screen-slots`): `index.ts` registers `MisCuentasMiCuenta` there. Importing `@modules/accounts` from identity closed an import cycle (vault imports identity) and broke 3 suites in identity, notifications and vault. Billetera keeps the direct import, which has no cycle.
* `rowDetail` now takes only the kind and last 4, so it serves both the panel rows and these cards.
* Tests: 14 in `MisCuentas.test.tsx`.

## Result

* Tests: 1166 of 1166 in the app. Lint, typecheck and Prettier clean.
* Pull request: in stack #168 above the slot PR (`feature/shared-screen-slots`), which sits above #203. 410 changed lines.

## Decisions and problems

* Karol's `BilleteraScreen.test.tsx` has no `QueryClientProvider`. To keep her tests untouched, each section checks `QueryClientContext` and renders nothing without it. The app always has one (`AppRoot`).
* In Billetera a card shows what it adds to the balance total (minus what is owed), as in Detalle de cuentas. The design shows a plain `$200.000` for "Nu Bank · Crédito", so this needs design review. Mi cuenta shows the cupo disponible instead, as HU-019 asks.
* "Simulado" does not fit on the small Billetera card, so it goes into the card's accessibility label.
* Shadow `shadow.balanceCard` stands in for the design's `0 12px 22px -14px` in the same color.

## Next step

`feature/mis-cuentas-in-billetera` (Karol) and `feature/mis-cuentas-in-mi-cuenta` (Daniel): only the import and one render line each.
