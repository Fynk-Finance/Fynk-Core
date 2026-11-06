---
date: 2026-11-06
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M3
jira: [SCRUM-69]
branch: feature/onboarding-listo-motion
tool: Claude Code
pr: "#303"
status: done
---

# Add the design's motion to the Listo screen

## Instruction

Last part of Sofia's request to "complete all the onboarding module": the Listo screen of #302 had the design's layout but none of its animations, which CLAUDE.md asks to take from the design code.

## What was done

* **`onboarding/ui/ListoMotion.tsx`** (new), every value from the CSS of `OnbListo.html`:
  * `ls-hero`: the hero waits 150 px lower at 1.25×, then moves to its place (1.9 s, `cubic-bezier(.65,0,.35,1)`, from 62 %);
  * `ls-check` and `ls-ok`: the pop from 0 at −20° to 1.15 at 4°, then 1; `ls-path`: the check drawn with a 30 dash;
  * `ls-t1`, `ls-t2`, `ls-row`: fade up 12 px; `ls-sheet`: up from 105 % of its height after 1.7 s;
  * `ls-burst`: the 30 bits of the design with their own offset, size, corner, delay, length, turn, scale and color; `ls-spark`: 4 stars and 4 squares that pop and then twinkle.
* **`onboarding/ui/ListoScreen.tsx`:** uses them. Each row is its own component so it fades 0.08 s after the one above and its check pops after it.
* Nothing moves and the bits are not drawn with Reduce Motion, as in the design's `prefers-reduced-motion`.
* **Tests:** two more in `ListoScreen.test.tsx`: the burst is drawn when motion is allowed, and not with Reduce Motion.

## Result

* Tests: full mobile suite, 235 suites, 2620 pass. `tsc`, ESLint and Prettier are clean.
* Not seen on a phone yet: the timing should be checked on a dev build against the design.
* Pull request: #303, in the M3 stack, on top of #302.

## Decisions and problems

* The shared `StepBurst` has the step bar's 18 bits fixed inside it, so Listo's 30 bits live in the onboarding module instead of changing M0's component.
* The design's dark export colors are the same for the bits (white, lime, light blue), so they read the same theme tokens in both themes.

## Next step

Review of the whole stack (#276 → … → this) and a run of the Maestro flow on a dev build.
