---
date: 2026-10-29
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M3
jira: [SCRUM-69]
branch: feature/onboarding-intro-motion
tool: Claude Code
pr: none
status: done
---

# Aviso illustration and the panel that becomes the step header

## Instruction

Same session as the onboarding progress and shell logs. The prompt asks to "take exact values, SVGs and animations" from the design code. This branch adds what was left out of the shell to keep it small: Aviso's illustration and its transition into step 1.

## What was done

* `ui/IntroIllustration.tsx`: the SVG of `OnbIntro.html`.
  * It shows the checklist card, the blue card, the target, the "+$625.000" pill and three stars, in the design's viewBox at 366 × 420.
  * Each floating group is its own Svg layer: `ob-float` 5 s, `ob-float2` 6 s with a 0.6 s delay, and the target and pill at 4.4 s with a 1.2 s delay. The stars twinkle (`ob-twinkle`, 2.6 s).
  * In dark, the inner square drops to 40 % and the pill and empty bars take the dark export's colors. The illustration colors stay in the module, like the Inicio illustration of M1.
  * Nothing moves with reduced motion.
* `ui/IntroScreen.tsx`:
  * "Comenzar configuración" shrinks the blue panel to the step header (0.7 s, `cubic-bezier(.76,0,.24,1)`).
  * Meanwhile the full-screen squares fade into the header squares and the content leaves (`ob-out`).
  * Then step 1 opens with no slide: the `fromIntro` param sets `animation: 'none'`. Coming back to Aviso grows the panel again.
  * With reduced motion, step 1 fades in.
  * On short phones the illustration scales down so it never runs under the text.
* Tests:
  * `IntroIllustration.test.tsx` (4): the image label, the light and dark colors, and reduced motion.
  * `OnboardingNavigator.test.tsx` (+1): with motion on, step 1 appears only after the 700 ms morph.

## Result

* Tests: onboarding 5 suites and 60 tests pass. ESLint and `tsc` are clean.
* Pull request: not opened yet. Stacked on `feature/onboarding-wizard-shell`.
* Not checked on a phone from this session (no emulator here): the morph timing and the dark colors need a look on a device next to `docs/design/screens/{light,dark}/OnbIntro.png`.

## Decisions and problems

* The design's `ob-out` uses two durations (0.32 s opacity, 0.4 s movement). Both are driven by the 0.7 s morph value, ending at 46 % and 57 % of it, which gives the same timing.

## Next step

The Nombre step (`feature/onboarding-name-step`).
