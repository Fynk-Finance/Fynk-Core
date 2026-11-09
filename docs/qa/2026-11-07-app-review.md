# App review findings, 7 Nov 2026

Sofia Ariza tested the app end to end on a phone and listed visual bugs, gesture improvements and functional bugs. Some of them are not in the design, or the design has no screen for them. Each finding is a Jira task (project SCRUM, label `qa-review`).

## Who does the work and who approves

* **Small or visual changes are assigned to Sofia, whatever module they touch.** This was decided by Sofia on 7 Nov 2026 so the polish work moves in one place.
* **The owner of each touched module still approves the pull request.** When Sofia's pull request edits files of another person's module, that person must approve it before merge, as `.github/CODEOWNERS` already asks. The "Approval" column below names them.
* Larger new functionality stays with the module owner (only F4 so far).
* Every pull request for these tasks says in its body: `QA review 2026-11-07, item <ID>` and the Jira key, and lists the approvals it needs.
* States, components or illustrations that the design does not have are listed in the pull request as "new screen state, needs design review" (or "new component", "new illustration"), as `CLAUDE.md` asks.
* Changes to gestures, transitions or copy that differ from the design are written in the screen inventory of `docs/design/README.md` in the same pull request.

## Visual

| ID | Jira | Finding | Module and files | Assignee | Approval in the PR |
| --- | --- | --- | --- | --- | --- |
| V1 | [SCRUM-76](https://fynk-swnt.atlassian.net/browse/SCRUM-76) | The Dashboard + button sits higher than in the design. It should be about 12 px or less above the tab bar. | M6 `accounts/ui/DashboardScreen.tsx` (`fab`, now `bottom: 92`) | Sofia | none (M6 is Sofia's) |
| V2 | [SCRUM-77](https://fynk-swnt.atlassian.net/browse/SCRUM-77) | The Dashboard has no savings goals section, so goals cannot be seen or created from there. Show it, with a skeleton when there are no goals. | M6 `DashboardScreen.tsx`, M8 `savings/ui/GoalsCarousel.tsx` through `savings/index.ts` | Sofia | Karol (M8) if `modules/savings` changes |
| V3 | [SCRUM-78](https://fynk-swnt.atlassian.net/browse/SCRUM-78) | The Detalle de cuentas arrow overlaps the header too much, and when closed it has a different color than the card. When open it has the right color but hides inside the header. | M6 `accounts/ui/AccountsPanel.tsx` (`DetailsTab`) | Sofia | none |
| V4 | [SCRUM-79](https://fynk-swnt.atlassian.net/browse/SCRUM-79) | The Estadísticas icon and the bell must look the same: same size and stroke width as the bell. This differs from the design on purpose. | M0 `shared/ui/icons/paths.ts` (`chartBars`), `HeaderBlue.tsx` | Sofia | none (M0 is Sofia's) |
| V5 | [SCRUM-80](https://fynk-swnt.atlassian.net/browse/SCRUM-80) | With no accounts, show a skeleton of the account card with a button to connect one. | M6 `AccountsPanel.tsx`, `MisCuentas.tsx`; route from M5 `bank/index.ts` | Sofia | Juan Carlos Leal (M5) if `modules/bank` changes |
| V6 | [SCRUM-81](https://fynk-swnt.atlassian.net/browse/SCRUM-81) | With no recurring expenses, show a skeleton of the recurring card. | M9 `recurring/ui/BilleteraScreen.tsx`, `RecurringCard.tsx` | Sofia | Karol (M9) |
| V7 | [SCRUM-82](https://fynk-swnt.atlassian.net/browse/SCRUM-82) | Billetera says "Hola, Invitado" while the other tabs say "Hola, Sofia". | M9 `BilleteraScreen.tsx` passes `name={t.guest}` | Sofia | Karol (M9) |
| V8 | [SCRUM-83](https://fynk-swnt.atlassian.net/browse/SCRUM-83) | Dialogs use the default Android dialog (`Alert.alert`). Build a Fynk dialog: white card (dark in dark mode), title and subtitle. | M0 new `shared/ui` component; callers in M1, M2, M4, M6, M7, M8, M9, M10, M13 | Sofia | Daniel Palacios (M1, M2), Juan Carlos Leal (M4), Karol (M8, M9), Julián Castiblanco (M10), Juan Pablo Contreras (M13), each for the files they own |
| V9 | [SCRUM-84](https://fynk-swnt.atlassian.net/browse/SCRUM-84) | The Estadísticas button, like the bell, must be in all 4 tabs. | M9 `BilleteraScreen.tsx`, M11 `RecommendationsScreen.tsx`, M15 `InvestmentScreen.tsx` | Sofia | Karol (M9), Julián Castiblanco (M10, M11, M15) |
| V10 | [SCRUM-85](https://fynk-swnt.atlassian.net/browse/SCRUM-85) | With no movements, the Dashboard shows only a message. Add a grayscale vector illustration, centered in the free space, above the message. | M7 `transactions/ui/TransactionPreview.tsx`, maybe `shared/ui/components/States.tsx` | Sofia | none |
| V11 | [SCRUM-86](https://fynk-swnt.atlassian.net/browse/SCRUM-86) | Categories show as many chips. Make them a dropdown, with an icon for each category. | M7 `ManualTransactionSheet.tsx`, M9 `RecurringFormFields.tsx`, maybe M8 `GoalFormFields.tsx` and M10 `CapFormScreen.tsx` | Sofia | Karol (M8, M9), Julián Castiblanco (M10) if their forms change |
| V12 | [SCRUM-87](https://fynk-swnt.atlassian.net/browse/SCRUM-87) | In light mode, "Tipo", "Cada cuánto" and similar selectors of the recurring form cannot be seen: the text is white. | M0 `shared/ui/components/SegmentedControl.tsx` (made for the blue header); the fix makes the page look the default, so only M10 `statistics/SummaryCard.tsx` changes to keep the header look | Sofia | Julián Castiblanco (M10) |

## Gestures

| ID | Jira | Finding | Module and files | Assignee | Approval in the PR |
| --- | --- | --- | --- | --- | --- |
| G1 | [SCRUM-88](https://fynk-swnt.atlassian.net/browse/SCRUM-88) | The arrow is too small to open Detalle de cuentas. Make it bigger, and let the user drag the header card down (or up) to open or close the details gradually, following the finger, with a smooth animation. | M6 `DashboardScreen.tsx`, `AccountsPanel.tsx` | Sofia | none |
| G2 | [SCRUM-89](https://fynk-swnt.atlassian.net/browse/SCRUM-89) | All tabs share the blue header. When switching tabs, the header should transform in place, as if the blue card moved up or down, instead of sliding with the page. | M0 `app/navigation/`, `shared/ui/components/HeaderBlue.tsx` | Sofia | Karol (M9), Julián Castiblanco (M11, M15) if their screens change |
| G3 | [SCRUM-90](https://fynk-swnt.atlassian.net/browse/SCRUM-90) | On Dashboard scroll, the balance must shrink to a card of 1/5 of the screen, as in Estadísticas. The movements list never scrolls on its own. | M6 `DashboardScreen.tsx`; reference M10 `analytics/ui/statistics/` | Sofia | Julián Castiblanco (M10) if code moves out of `modules/analytics` |

## Functional

| ID | Jira | Finding | Module and files | Assignee | Approval in the PR |
| --- | --- | --- | --- | --- | --- |
| F1 | [SCRUM-91](https://fynk-swnt.atlassian.net/browse/SCRUM-91) | Stronger password rules: at least one special character. The "Una letra" check reads oddly; it should say the password is alphanumeric. | M1 `services/keycloak/realms/fynk-realm.json` (`passwordPolicy`), `services/keycloak/theme/src/login/strings.es-CO.ts`, `components/FynkPasswordRules.tsx` | Sofia | Daniel Palacios (M1) |
| F2 | [SCRUM-92](https://fynk-swnt.atlassian.net/browse/SCRUM-92) | Onboarding did not show up for a new account. | M3 `onboarding/ui/useOnboardingGate.ts`, `app/startup.ts` | Sofia | Daniel Palacios (M1, M2) if the fix touches identity or the vault |
| F3 | [SCRUM-93](https://fynk-swnt.atlassian.net/browse/SCRUM-93) | Pull down at the top of the Dashboard: everything moves down and a loading indicator grows in size and opacity. Releasing at the maximum syncs with the banks (60 s cooldown still applies). | M6 `DashboardScreen.tsx` (has a `TODO(M5)`), sync from M5 `bank/index.ts` | Sofia | Juan Carlos Leal (M5) if `modules/bank` changes |
| F4 | [SCRUM-94](https://fynk-swnt.atlassian.net/browse/SCRUM-94) | Billetera needs a savings goals section, like the recurring expenses one. | M9 `BilleteraScreen.tsx`, M8 `savings/index.ts` | Karol | Sofia (M0) only if `shared/ui` changes |
| F5 | [SCRUM-95](https://fynk-swnt.atlassian.net/browse/SCRUM-95) | The + button cannot add money when the balance is zero, and if cash was skipped in onboarding there is no way to add money at all. Tapping + offers Ingreso or Gasto, and each opens the existing form. | M6 `DashboardScreen.tsx`, M7 `ManualTransactionSheet.tsx`, M6 cash (HU-054) | Sofia | none (M6 and M7 are Sofia's) |

## Notes

* **F1:** "al menos un caracter" was read as "at least one special character". Sofia confirms it before the work starts.
* **V6:** the list said "cuando no halla cuentas" for recurring expenses. It was read as "when there are no recurring expenses".
* **V2, V5, V6, F4** all need an empty-card skeleton. One shared component in `shared/ui` avoids four copies.
* **G1, G3 and F3** all change how the Dashboard reacts to vertical drags. They should be built in this order (G3, then G1, then F3), stacked if they are open at the same time, so the gestures do not fight each other.
* **V3 and G1** touch the same arrow and can go in one pull request.
