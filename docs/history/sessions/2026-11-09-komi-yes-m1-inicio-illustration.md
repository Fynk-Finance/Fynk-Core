---
date: 2026-11-09
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-96]
branch: fix/inicio-illustration-width
tool: Claude Code
pr: "#349"
status: done
---

# Draw the Inicio illustration, in the place the design has it

## Instruction

Daniel sent a screenshot of Inicio: "the screen is not showing the vectorial figure".

## What was done

* `identity/ui/InicioIllustration.tsx`: `alignSelf: 'stretch'` on the illustration's box, and the rotation points of both cards.
* `InicioIllustration.test.tsx`: a test that the box takes the full width of a parent that centers its children, seen failing first.

## Result

* Tests: 263 pass in `src/modules/identity`, `tsc` clean. ESLint and Prettier clean on the changed files.
* On the Android emulator: the figure shows and matches `docs/design/screens/light/Inicio.png`.
* Pull request: #349.

## Decisions and problems

* The art box centers its children, so a `flex: 1` child measured 0 wide and nothing was drawn.
* The design's CSS rotates each card around the center of its own box (`transform-box: fill-box`), which React Native SVG ignores. Without correcting the pivots the cards sat higher and to the right, and the lime card was cut by the top.
* The first device check said "still blank", but that was invalid: running Metro with `CI=1` turned file watching off and it served an old bundle.

## Next step

None for this fix.
