---
date: 2026-11-09
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-96]
branch: fix/lock-screen-login-layout
tool: Claude Code
pr: "#347"
status: done
---

# Give the lock screen the layout of Iniciar sesión and a figure

## Instruction

Daniel asked that the lock screen match the Login layout, and later that it have "a vectorial figure like the ones used across the app".

## What was done

* `LockScreen.tsx`: the gaps, padding and lime layer of the design's `Login`, with the lime layer and the sheet filling the free height. The background squares now cover the full width.
* `LockIllustration.tsx`, new: a padlock in front of a blue card, with the shapes and colors of the Inicio illustration. Static.
* `strings.es-CO.ts`: the figure's accessibility label.
* Tests in `LockScreen.test.tsx` (`layout of Login.html`, `illustration`).

## Result

* Tests: 2,756 pass in the whole mobile suite, `tsc` clean. ESLint and Prettier clean on the changed files.
* On the Android emulator: header, lime layer and figure are correct in light and dark.
* Pull request: #347.

## Decisions and problems

* The design has no lock screen, so this stays marked as "new screen, needs design review".
* The design's shine and sheet-rise animations are not included.
* A `flex: 1` child inside a centered parent measures 0 wide in React Native. The figure's box stretches to avoid it.

## Next step

Design review of the figure and the layout.
