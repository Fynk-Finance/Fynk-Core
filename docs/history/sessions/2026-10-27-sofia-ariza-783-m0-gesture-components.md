---
date: 2026-10-27
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: feature/gesture-components
tool: Claude Code
pr: #32
status: partial
---

# Shared controls of the new screens

## Instruction

Same session as #11 to #15 and #29. Sofia asked to "review the current design tokens and components to follow the new screen specifications", and noted that "several screens have two navigation methods: buttons and gestures". This branch is M0 Step 7.4. It is stacked on `feature/navigation-transitions-and-gestures`.

## What was done

* New components in `src/shared/ui/components/`, with values copied from the design CSS in both themes:
  * `Switch` (`.sw`): 48 by 28, a 22 px knob, `.2s cubic-bezier(.34,1.56,.64,1)`.
  * `SegmentedControl` (`.seg` of Estadísticas): the period control on blue.
  * `Fab` (`.fab`): round on Dashboard and extended on Metas. The plus turns 45° when its menu is open.
  * `PageDots` (`.dot` of Detalle de cuenta): the buttons behind the account swipe.
  * `SearchField` (Movimientos).
* Tokens:
  * `primaryText` (`#1F7FA8`, dark `#62C8F0`), also in the README table;
  * `onPrimaryFaint`, `onPrimaryPressed`, `onPrimaryDot` and `fabShadow`;
  * the `fab` shadow and sizes for the new controls.
* A `search` icon from Movimientos.
* A story for each component, snapshot-tested in light and dark (16 new snapshots).
* `controls.test.tsx` (10 tests): every control works by tap and reports its state to screen readers, and the selected segment has the right blue in each theme.

## Result

* Tests: 20 suites, 400 tests and 116 snapshots pass. ESLint, `tsc` and Prettier are clean.
* Spot checks of the snapshots against the design:
  * switch track `#CFDBE3`, `#344755` in dark;
  * knob, selected segment and current dot white in light, `#13212D` in dark.
* Pull request: #32.

## Decisions and problems

* **Not built: `BottomSheet`, `Toast`, `PullTab`, `Accordion` and `CollapsingHeader`.** The export draws the sheets and the toast only closed. Their animations are in the CSS, but not their open layout, scrim or colors, and the rules forbid guessing a design value. Screens shown as sheets can already use `transition: 'sheet'` (#29). The pull tab, the accordions and the collapsing card belong to one screen each (M6, M8, M10, M13). Their values are in the README "Gestures inside screens" table, so their owners build them.
* In dark, white controls on blue become the page color `#13212D`, not white. The palette's `background` already covers that.
* About 710 changed lines without snapshots, about 300 of them tests and stories. It stays one PR because the five controls share the stories index, the snapshot file and the tokens.

## Next step

Ask the team to export the open states of the Dashboard FAB sheet, the Metas "Abonar" sheet and the toast. Then `feature/appearance-setting` (M0 Step 7.5).
