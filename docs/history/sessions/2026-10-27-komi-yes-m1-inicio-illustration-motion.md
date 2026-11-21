---
date: 2026-10-27
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6]
branch: feature/inicio-illustration-motion
tool: Claude Code
pr: none
status: done
---

# Animate the Inicio illustration like the design

## Instruction

The developer approved the plan to finish M1 and said "continue". Claude Code plans and reviews, and a Sonnet subagent writes each task ("with sonnet 5.5 do the implementation following the plan you design and verify that the work done is correct"). This task is the looping motion of the Inicio illustration that was left static in `feature/mobile-sign-in-with-pkce`.

## What was done

* `ui/inicioMotion.ts`: the design's keyframes from `docs/design/sources/light/Inicio.html`, written as data:
  * `fk-float` and `fk-shadow`, 6 s;
  * `fk-shine`, 6 s, with delays of 1 s and 2.4 s;
  * `fk-drop`, 5 s, with delays of 1.2 s and 3.7 s;
  * `fk-twinkle`, 3.2, 3.8 and 4.4 s, with negative delays.

  Plus CSS `ease-in-out` on every segment, and a loop phase that handles positive and negative delays like CSS.
* `ui/InicioIllustration.tsx`: a still backdrop plus one layer per moving group (the shadow, two cards with their shine, the two top coins, three sparkles), each an `Svg` with the same viewBox, moved with Reanimated. Colors, paths and coordinates are unchanged. The design's shine sweep was added.
* With reduced motion, or before the view is measured, the single static picture is drawn and no animation starts.
* `ui/InicioIllustration.test.tsx`: 9 tests (the layers, reduced motion, the resting frame before layout, the accessible image, keyframe values).

## Result

* `make lint-mobile test-mobile format-check`: 25 suites, 320 tests pass; ESLint, `tsc` and Prettier are clean.
* Not seen on a device yet (no Android SDK on this machine). It needs a look on a simulator next to `docs/design/screens/light/Inicio.png`.

## Decisions

* Layers instead of animated SVG groups: React Native transforms work in view points, so each moving group is its own full-size layer and the SVG offsets are converted with the measured scale.
* Colors stay as they are. Moving them to the light and dark theme is the next branch, which waits for Sofia's #14.

## Problems

* In review, Claude Code found that the two still layers were in normal layout flow, so the second would have been drawn below the first instead of over it. They are now absolutely positioned like the moving layers. Two empty temporary files left in the repository root were deleted.

## Next step

* `refactor/identity-ui-theme`: the identity UI on `useTheme()` and the illustration's dark colors, after #14 is rebased.
