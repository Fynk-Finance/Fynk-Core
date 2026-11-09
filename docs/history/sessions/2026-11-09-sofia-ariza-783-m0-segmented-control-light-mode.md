---
date: 2026-11-09
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-87]
branch: fix/segmented-control-light-mode
tool: Claude Code
pr: none
status: done
---

# Make the selectors readable on the page in light mode (QA review V12)

## Instruction

Sofia asked to list the findings of the 7 Nov app review that were still open and then: "Lets fix all the visual problems at once", with every pull request in one stack ("Stack all the prs"). This session is the bottom of that stack, V12: in light mode "Tipo", "Cada cuánto" and similar selectors of the recurring form cannot be seen because the text is white.

## What was done

* `shared/ui/components/SegmentedControl.tsx`: new `onPrimary` prop, like `GhostCard`. Without it (page or sheet) the control takes the `Chip` colors: soft blue track with a blue border, the selected option in dark blue with white text, the others in the text color. With it, the old look of the blue header.
* `modules/analytics/ui/statistics/SummaryCard.tsx`: the Estadísticas period control passes `onPrimary`. It is the only one on a blue header, so the recurring form, the movement sheet, the filters, the cap form and Inversión's "CDT / Acciones" are fixed without touching them.
* `controls.test.tsx`: tests for the page look in light and dark and for the header look. Catalog story "OnPage" and its snapshots.
* `docs/design/README.md` and the QA review doc: the page look is noted as needing design review, and V12 now needs Julián's approval (M10) instead of Karol's.

## Result

* Tests: 2719 of 2719. Typecheck and ESLint clean.
* Pull request: not opened yet (opened with the whole stack).

## Decisions and problems

* Making the page look the default changes one caller instead of five, and the five on the page were the ones broken.
* The design has no selector on a white background, so the colors come from `Chip`: new component state, needs design review.

## Next step

V4: the Estadísticas icon with the size and stroke of the bell.
