---
date: 2026-10-29
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23]
branch: feature/bank-account-rows
tool: Claude Code
pr: none
status: done
---

# The connected account rows and "Agregar otra cuenta"

## Instruction

The developer asked to split the last layer of the step 3 stack so it falls inside the 400-line guideline: "you can split layer 5 so that it falls inside the guideline". The two exported components moved to this layer, under the result screen.

## What was done

* `ui/BankLinkList.tsx`: the rows of OnbCuentas.html (logo tile, name, "<tipo> · ✓ Conectada", balance in mono). Colors from `useTheme()`, sizes from the design code.
* `ui/ConnectBankButton.tsx`: OnbCuentas.html's dashed "Agregar otra cuenta", which opens `bank.Connect` (`CONNECT_BANK_ROUTE`).
* `strings.es-CO.ts`: "Conectada", "Agregar otra cuenta" and the account kind labels.
* `index.ts`: exports both for onboarding step 3 (M3) and Billetera (M6).
* Tests: the rows in light and dark (labels, balance, theme colors), and the button's navigation.

## Result

* Tests: bank 13 suites, 74 tests. Typecheck, ESLint and Prettier pass.
* Pull request: not opened yet. About 220 lines.
* Nothing in the app shows them yet. The result screen (next layer) and M3 and M6 will.

## Decisions and problems

* **Split from `feature/connect-bank-result-screen`,** which was about 530 lines. The code is unchanged from that branch; it moved down one layer.
* **Not checked on a phone** against the OnbCuentas PNGs.

## Next step

`feature/connect-bank-result-screen` on top of this layer.
