---
date: 2026-11-11
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M6
jira: [SCRUM-28]
branch: fix/dashboard-accounts-panel-height
tool: Claude Code
pr: none
status: done
---

# Detalle de cuentas shows cash, or a line when there is nothing

## Instruction

"Dashboard header dont show anything when is not any account connected. Show cash if there is any cash or a message is there are not any account or cash." Then: "do not show the skeleton from add account in the header. Do not add any button to connect an account here."

## What was done

* `modules/accounts/ui/DashboardScreen.tsx`:
  * The panel content is laid out out of the flow of its frame (absolute, top, left and right 0). The frame still clips it.
  * The Conectar banco route is no longer used.
* `modules/accounts/ui/AccountsPanel.tsx`:
  * No ghost card and no button to connect a bank.
  * Cash shows as its row.
  * With no account and no cash, the line "Aún no tienes cuentas conectadas ni efectivo registrado." shows.
* `modules/accounts/index.ts` and `strings.es-CO.ts`: the unused route and string are removed.
* `DashboardScreen.test.tsx`: the cash row without the connect button, the empty line, and the panel laid out out of the flow.
* `docs/design/README.md`: the Dashboard row says Detalle de cuentas has no ghost card.

## Result

* Tests: 2854 of 2854 on the whole stack. Typecheck and ESLint clean.
* Pull request: opened at the top of the G2 stack right after this log.
* Checked on the Android emulator: with $500.000 in cash and no bank, Detalle de cuentas shows the Efectivo row.

## Decisions and problems

* Cause found with a log on the emulator: the panel sat in its frame, whose height animates from 0 with clipping, so Android measured the content 0 and the panel opened empty. The measure fired once, at mount, and never again.
* The empty line is new copy and needs design review.
* Mis cuentas keeps its own "Conectar" ghost card: connecting a bank lives there.
* It sits at the top of the G2 stack because the next Dashboard branch changes the same file.

## Next step

`feature/tab-header-dashboard`, on top of this branch.
