---
date: 2026-11-09
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M9
jira: [SCRUM-81]
branch: feature/billetera-recurring-ghost-card
tool: Claude Code
pr: none
status: done
---

# Empty card for the recurring expenses in Billetera (QA review V6)

## Instruction

Part of "Lets fix all the visual problems at once", every pull request in one stack. V6: with no recurring expenses, show a skeleton of the recurring card.

## What was done

* `modules/recurring/ui/BilleteraScreen.tsx`: without fixed expenses, the shared `GhostCard` ("Agregar gasto", hint "Aún no tienes gastos recurrentes") takes the place of the cards and opens the form. It replaces the old `EmptyState`. The savings banner and "Otros gastos" still show below when there are subscriptions.
* `strings.es-CO.ts`: the old empty message, no longer used, is removed.
* `BilleteraScreen.test.tsx`: the empty card shows without items and opens the form; it also shows when there are only subscriptions.
* `docs/design/README.md`: the Billetera inventory row notes the new empty card.

## Result

* Tests: 2731 of 2731. Typecheck and ESLint clean.
* Pull request: not opened yet (opened with the whole stack). Karol approves (M9).

## Decisions and problems

* The card is full width, not one half of the 2 column grid: a half card next to an empty half looked broken.
* It shows when there are no fixed expenses, not only when there are no items at all: before, an account with only subscriptions had an empty "Gastos recurrentes" with nothing under it.

## Next step

V8: the Fynk dialog that replaces the Android `Alert.alert`.
