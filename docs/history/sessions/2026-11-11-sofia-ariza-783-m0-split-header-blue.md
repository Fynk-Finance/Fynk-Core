---
date: 2026-11-11
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-89]
branch: refactor/split-header-blue
tool: Claude Code
pr: none
status: done
---

# Split HeaderBlue into parts the tabs' shared header can reuse (QA review G2)

## Instruction

"We already implemented all visual improvements, now we need to code the gestual one. Lets start with that. According to the actual requirement, design a plan to code this part." The only gesture item left was G2 (SCRUM-89): the blue header stays in place and changes height between tabs. This branch is step 1 of that plan.

## What was done

* `shared/ui/components/HeaderBlue.tsx`: `HeaderBlue` is now built from three exported parts with the same public API: `HeaderBlueFrame` (blue card, shadow, insets), `HeaderGreetingRow` (avatar, greeting, chart and bell) and `HeaderBlueContent` (title row and extra content). New helpers `headerContentTop` and `headerBlueHeight` give the header geometry, as worklets.
* Catalog snapshots updated: the only change is one wrapper `View` around the content.

## Result

* Tests: every suite of the branch passes; the whole stack passes 2854 of 2854. Typecheck and ESLint clean.
* Pull request: opened in the G2 stack right after this log.
* No visible change: the header draws the same pixels.

## Decisions and problems

* The parts are exported so the shared header (a later branch) draws exactly the same header, instead of a copy.

## Next step

The blend math of the shared header (`feature/tab-header-blend`).
