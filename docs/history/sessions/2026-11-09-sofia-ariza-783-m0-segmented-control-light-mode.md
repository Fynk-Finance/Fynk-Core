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

* `shared/ui/components/SegmentedControl.tsx`: new `onPrimary` prop, like `GhostCard`. Without it (page or sheet): soft blue track with a blue border, the selected option in the page color with a stronger blue border and blue text, the others in the text color. With it, the old look of the blue header.
* `modules/analytics/ui/statistics/SummaryCard.tsx`: the Estadísticas period control passes `onPrimary`. It is the only one on a blue header, so the recurring form, the movement sheet, the filters, the cap form and Inversión's "CDT / Acciones" are fixed without touching them.
* `controls.test.tsx`: tests for the page look in light and dark, for the header look, and for AA contrast (4.5:1) of the page look in both themes. Catalog story "OnPage" and its snapshots.
* `docs/design/README.md` and the QA review doc: the page look is noted as needing design review, and V12 now needs Julián's approval (M10) instead of Karol's.

## Result

* Tests: 2719 of 2719. Typecheck and ESLint clean.
* Pull request: not opened yet (opened with the whole stack).

## Decisions and problems

* Making the page look the default changes one caller instead of five, and the five on the page were the ones broken.
* The design has no selector on a white background: new component state, needs design review.
* A first try used the `Chip` colors (white text on dark blue). Checked against the Jira criteria it failed AA contrast: 3.5:1 in light and 1.9:1 in dark. The selected option now turns the header look around (page color, blue text): 4.5:1 in light and 8.6:1 in dark.

## Next step

V4: the Estadísticas icon with the size and stroke of the bell.
