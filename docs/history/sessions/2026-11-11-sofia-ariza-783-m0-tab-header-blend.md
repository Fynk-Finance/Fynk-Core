---
date: 2026-11-11
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-89]
branch: feature/tab-header-blend
tool: Claude Code
pr: none
status: done
---

# Blend math of the tabs' shared header (QA review G2)

## Instruction

Part of "design a plan to code this part" for G2 (SCRUM-89): the header stays, its height follows the finger between tabs, each tab's content fades, and Reduce Motion switches at once.

## What was done

* `shared/navigation/tabHeaderBlend.ts`: pure worklets that turn the pager's position into the header's values:
  * `blend` gives the height between two tabs, or the nearest tab's height with Reduce Motion.
  * `fillUnknown` lets a tab not measured yet borrow its neighbour's height.
  * `layerOpacity` fades a tab's content out by the middle of the swipe; it is 0 or 1 with Reduce Motion.
  * `nearestTab` gives the closest tab.
  * `flickTarget` turns a sideways flick on the header into the next or previous tab.
* `tabHeaderBlend.test.ts`: one test per criterion (height follows the position, content fades, Reduce Motion is immediate) plus the flick thresholds and the edges.

## Result

* Tests: every suite of the branch passes; the whole stack passes 2854 of 2854.
* Pull request: opened in the G2 stack right after this log.

## Decisions and problems

* A flick wins by distance (60 px) first, then by speed (500 px/s), so a short fast flick still switches tab.

## Next step

The store and the `useTabHeader` hook (`feature/tab-header-store`).
