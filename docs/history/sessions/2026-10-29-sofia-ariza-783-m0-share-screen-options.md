---
date: 2026-10-29
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: refactor/share-screen-options
tool: Claude Code
pr: none
status: done
---

# Share the screen options and finish the onboarding step bar

## Instruction

Sofia gave Claude Code the M3 onboarding prompt ("You are building module M3 Guided onboarding of Fynk. This module owns the wizard and its navigation only.") and approved a plan that starts with this small M0 branch. The onboarding flow needs things only M0 can change.

## What was done

* `src/app/navigation/screenOptions.ts` and its test moved to `src/shared/navigation/`. `screenOptionsFor`, `flowOptions` and `MotionSettings` are exported from `@shared/navigation`, and `RootNavigator.tsx` imports them from there. Reason: the onboarding flow is a nested stack inside its gate, and modules cannot import `src/app`, so without this M3 would have to copy the transition rules.
* `src/shared/ui/components/StepBurst.tsx` (new): the `pb-pop` burst of `OnbNombre.html`, left pending by the M0 UI session.
  * It has the 18 stars and squares with the design's positions, delays, durations, rotations and scales, eased with `cubic-bezier(.15,.7,.3,1)`.
  * Colors come from the theme (`onPrimary`, `accent`, `accentSoft`). It renders nothing with Reduce Motion.
* `StepProgress.tsx`:
  * Each segment now has a clipped track for the fill, with the burst drawn outside it on the current segment.
  * The gap between segments is 8 px, as in the design (it was 6).
* `motion.test.tsx`: two new tests. The burst shows once on the current segment, and Reduce Motion removes it while the bar stays.
* `catalog.test.tsx.snap`: the four StepProgress snapshots (light and dark) were updated for the new track and gap.

## Result

* Tests:
  * Navigation and app shell: 5 suites, 31 tests pass.
  * Shared components: 3 suites, 39 tests pass. Catalog: 119 tests, 4 snapshots updated.
  * ESLint and `tsc` are clean.
* Pull request: not opened yet. It goes at the bottom of the onboarding stack.

## Decisions and problems

* The dark export of the design turns the white squares of the burst navy (`#13212d`), while the white stars stay white. This looks like an export bug, so the squares stay white in both themes.
* `git fetch` failed with an SSL certificate error under Git's openssl backend. It works with `git -c http.sslBackend=schannel`. The global config was not changed.
* `make` and `pnpm` are not on the PATH of this machine. `corepack pnpm` and the Makefile commands run by hand worked for the install and `generate-ts`.

## Next step

Build the onboarding wizard shell (M3) on top of this branch.
