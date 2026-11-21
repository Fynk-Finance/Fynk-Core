---
date: 2026-11-09
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-86]
branch: feature/category-dropdown-forms
tool: Claude Code
pr: "#360"
status: done
---

# The category dropdown in the forms (QA review V11, part 2 of 2)

## Instruction

Part of "Lets fix all the visual problems at once", every pull request in one stack. V11 part 2: use the dropdown of part 1 in the forms that showed the categories as chips. This is the top of the stack.

## What was done

* M7 `ManualTransactionSheet.tsx`: every category plus "Automática" as the clearing row.
* M9 `RecurringFormFields.tsx` (form and onboarding step): the recurring categories.
* M8 `GoalFormFields.tsx` (form and onboarding step): the goal categories with the icons of `goalIcons.ts`.
* M10 `CapFormScreen.tsx`: the capped categories, with the new placeholder "Elige una categoría".
* Unused chip styles and imports removed.
* Tests: the six tests that picked a category open the dropdown first; a new movement sheet test checks the categories stay folded until it is opened.

## Result

* Tests: 2756 of 2756. Typecheck and ESLint clean.
* Pull request: #360, in stack #361 (#352 → #360). Approvals: Karol (M8, M9), Julián (M10).

## Decisions and problems

* The rows keep the old test ids (`<form>.category.<id>`), so the tests only needed one extra tap.
* The Movimientos filters keep their chips: they choose several categories at once, which a dropdown of one choice does not do.

## Next step

Open the 9 pull requests of the stack and check every screen on a phone in light and dark, next to the design PNGs.
