---
date: 2026-11-11
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-89]
branch: feature/tab-header-wallet-advice-investment
tool: Claude Code
pr: none
status: done
---

# Billetera, Recomendaciones and Inversión use the shared header (QA review G2)

## Instruction

Part of the G2 plan (SCRUM-89): the blue header stays in place between tabs. After checking it on the emulator: "The animation between billetera, recomendaciones and inversion its perfect".

## What was done

* `modules/recurring/ui/BilleteraScreen.tsx` (M9), `modules/recommendations/ui/RecommendationsScreen.tsx` (M11) and `modules/investment/ui/InvestmentScreen.tsx` (M15): `<HeaderBlue …>` becomes `useTabHeader({ … same props … })`. The pages keep their layout through the spacer it returns.
* `app/navigation/MainTabs.tsx`: the three tabs are turned on in `SHARED_HEADER_TABS`.
* `docs/design/README.md`: the Tab transition row notes the override (G2), and the gestures table gets the header flick, with the tab bar as its button.

## Result

* Tests: 2854 of 2854. The screens' existing tests pass unchanged, because outside the tabs `useTabHeader` draws a plain `HeaderBlue`.
* Pull request: opened in the G2 stack right after this log. Approvals needed: Karol (M9) and Julián Castiblanco (M11, M15).
* Checked on the Android emulator: the header stays, its height follows the finger, the greeting does not move and the content fades.

## Decisions and problems

* The Dashboard is not in the shared header yet. It keeps its own header, and the shared card fades out toward it.

## Next step

Move the Dashboard header into the shared one (`feature/tab-header-dashboard`): its live height from the collapse, Detalle de cuentas below the card, and the pull to sync offset.
