---
date: 2026-10-26
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: feature/ui-components
tool: Claude Code
pr: none
status: done
---

# M0 Step 4, part 2 of 3: design system components and catalog

## Instruction

Same session and instruction as part 1 ("continue with step 4"). This part covers the components of the M0 prompt: "each with a story file in `src/shared/ui/__catalog__/` and a snapshot test".

## What was done

* Components in `src/shared/ui/components/`, built from the design code (screen named in each file):
  * `Screen`, `HeaderBlue` (avatar initials, "Hola,", bell with lime unread dot);
  * `Card` (outlined, soft, primary with decorative squares and shine), `AmountText` (IBM Plex Mono; income blue with "+", spending with the typographic minus "−");
  * `PrimaryButton`, `AccentButton`, `GhostButton` (default, neutral and danger), `BackButton`;
  * `TextField` (icon, focus border, password eye toggle), `Chip`, `Badge` (neutral, info, accent, success, onPrimary);
  * `ProgressBar`, `StepProgress` ("Paso 1 de 5", "Omitir", 5 segments, fill animation);
  * `ListRow`, `IconTile`, `SectionHeader`, `Avatar`;
  * `Donut`, `LineChart`;
  * `EmptyState`, `ErrorState`, `Skeleton`, and `Shine` (the moving light of the design).
* The animations follow the conversion table of `docs/design/README.md` (Reanimated, same durations and easing) and stop when the system asks to reduce motion.
* `__catalog__/`: one story file per component, a `CatalogScreen` for development builds instead of Storybook, and a snapshot test of every story.
* Behavior tests:
  * the typographic minus and its accessibility label;
  * the password toggle, the unread dot, progress clamping;
  * the step label and Omitir, the donut arc math, initials;
  * disabled and loading buttons;
  * the animations with reduced motion on and off.

## Result

* Jest: 240 tests and 50 snapshots pass on this branch, stable across repeated runs. `make lint test` passes.
* Pull request: opened right after this log, based on `feature/design-tokens-and-icons`.

## Decisions and problems

* The donut is drawn with react-native-svg like the design (rounded arcs separated by a gap), because react-native-gifted-charts' pie cannot draw that. The line chart uses gifted-charts, as decided.
* Problems found while testing, all fixed:
  * Testing Library v14 makes `render` and `fireEvent` async and replaced `toHaveAccessibilityState` with `toBeSelected` and `toBeBusy`.
  * The first snapshots were all `null`. They now use `screen.toJSON()` and fail if empty.
  * gifted-charts schedules timers even when not animated. `animateTogether` makes them immediate.
  * The snapshot test replaces gifted-charts with a stub that records the props Fynk passes. Otherwise the snapshot holds hundreds of the library's internal views and changes on every upgrade.
  * The Skeleton snapshot changed between runs because its animation moved. Snapshots now render with reduced motion, and `motion.test.tsx` checks the animations themselves.
  * The progress bars were missing `accessible`, so screen readers did not read them as one element. Fixed.
* The full icon grid is shown in the catalog but left out of the snapshot (83 KB). A sample is snapshotted instead.
* `EmptyState`, `ErrorState` and `Skeleton` have no screen in the design. They are built from its pieces and need design review.
* Not done yet: the sparkle particles of the onboarding step bar (`pb-pop`), which M3 can add. No phone or emulator screenshots: this Windows machine has no Android SDK and cannot build iOS.

## Next step

Merge part 1, then this pull request, then part 3 (`feature/app-shell-navigation`).
