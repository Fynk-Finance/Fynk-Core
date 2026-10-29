---
date: 2026-10-27
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: feature/appearance-setting
tool: Claude Code
pr: #34
status: done
---

# Apariencia screen: Sistema, Claro or Oscuro

## Instruction

Same session as #11 to #32. Sofia asked to "manage a default and allow specifications when the user indicates them" for dark mode. This branch is M0 Step 7.5: the place where the person picks the theme. It is stacked on `feature/gesture-components`.

## What was done

* `src/app/settings/AppearanceScreen.tsx`:
  * a back button, the title "Apariencia", a subtitle, and an outlined card;
  * option chips for Sistema, Claro and Oscuro, wired to `useThemePreference()`.
  * Copy is in `src/app/settings/strings.es-CO.ts`.
* `APPEARANCE_ROUTE` (`app.Appearance`) exported from `@shared/navigation`, and the screen registered in `RootNavigator` with the default push transition.
* `AppearanceScreen.test.tsx` (3 tests): Sistema is the default, Oscuro applies at once and is saved, and the saved choice shows on open.

## Result

* Tests: 21 suites, 403 tests and 116 snapshots pass. ESLint, `tsc` and Prettier are clean.
* Pull request: #34.

## Decisions and problems

* The design has no Apariencia screen. It is built from the layout of Ajustes de notificaciones and the shared `Chip`. The design's option chips there are rounded rectangles with a blue fill, while `Chip` is the pill filter chip, so the design review should say which one to use.
* The screen belongs to the app shell (M0), because the theme is M0's. M1 adds the "Apariencia" row in Mi cuenta and opens `APPEARANCE_ROUTE`.

## Next step

When #11 and #13 merge, rebase the stack (#14, #15, #29, #32 and this one) onto `develop` and take #14 out of draft. Ask the team to export the open states of the sheets and the toast. M1 adds the Apariencia row.
