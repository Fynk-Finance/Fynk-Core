---
date: 2026-11-05
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M3
jira: [SCRUM-69]
branch: feature/onboarding-accounts-step
tool: Claude Code
pr: "#277"
status: done
---

# Build the onboarding Cuentas step with M5's bank links and M6's cash

## Instruction

Sofia asked: "Steps are still PlaceholderStep. These parts are already exported and could be embedded now: BankLinkList and ConnectBankButton (M5), CashInput (M6)." Before coding, Claude Code asked when "Continuar" should be enabled, since the design does not show the empty case. Sofia chose: always enabled.

## What was done

* **`onboarding/ui/AccountsStepScreen.tsx`** (new): step 2 as in `OnbCuentas.html`. "Cuentas bancarias" with "N conectadas", M5's `BankLinkList` and `ConnectBankButton`, "Efectivo" with M6's `CashInput` filled with the saved cash, and "Total registrado" that follows the field as the person types. "Continuar" saves a new cash amount first, then opens Metas.
* **Conectar banco inside the setup:** while the onboarding gate is open, the app's stack holds only the onboarding flow, so `ConnectBankButton` would find no `bank.Connect` route. `OnboardingNavigator` now registers M5's `ConnectBankScreen` under that name; its back button returns to Cuentas.
* **`onboarding/ui/routes.ts`:** `CONNECT_BANK_ROUTE` is typed against M5's constant, so a rename in M5 fails to compile, with no import at run time.
* **`onboarding/index.ts`:** wires the step and the screen. M5 and M6 values are read on render only.
* **`PlaceholderStep.tsx`:** only Metas (M8) and Gastos (M9) are still placeholders; the M5 and M6 TODOs are gone.
* **Strings:** section titles, counts, "Total registrado" and its detail, and a cash save error.
* **Tests:** 9 screen tests on the real navigator and vault, with stand-ins for M5's and M6's parts: the design numbers, the prefilled cash, the live total, saving only a changed amount, going on with nothing, staying on the step when the save fails, the count hidden while loading, and Conectar banco opening and closing inside the setup.

## Result

* Tests: onboarding suites, 118 pass. With accounts and app suites, 265 pass. `tsc`, ESLint and Prettier are clean.
* Loading `@modules/bank` first, then onboarding and accounts, works (checked with a throwaway test).
* Pull request: #277. Stacked on `feature/onboarding-accounts-step-rules`. About 450 changed lines, half of them the screen test.

## Decisions and problems

* **Import cycle.** Onboarding → bank → accounts → onboarding once the name pull request merges. Every value from M5 and M6 is passed as a function read on render, as M6 already does for M7.
* **New states that need design review:** the empty list ("0 conectadas", only the button) and the cash save error.
* **Not tested on a phone yet:** linking Banco Demo from the setup in a dev build.

## Next step

Open the stack. Then Metas and Gastos, once M8 and M9 export their forms (`feature/savings-onboarding-goals` is already on origin), and the Listo screen.
