---
date: 2026-11-11
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-89]
branch: feature/tab-header-host
tool: Claude Code
pr: none
status: done
---

# The tabs' blue header drawn once, above the pager (QA review G2)

## Instruction

Part of the G2 plan (SCRUM-89). Sofia chose that "a sideways flick on the header switches tab when the finger lifts", because the header sits above the pager and cannot drag it. After testing on the Android emulator: "when i slide to dashboard the shadow if the billetera header persist around one second. Please fix this."

## What was done

* `app/navigation/TabHeaderHost.tsx`: one blue card above the pager.
  * Its height follows the pager between tabs.
  * One greeting row that never moves.
  * Each tab's content fades.
  * The Dashboard's muted blue and Inversión's light avatar fade by their tab's weight.
  * A first-seen tab eases to its measured height (380 ms).
  * A sideways flick on the header switches tab.
  * Touches go only to the focused tab's content.
* `MainTabs.tsx` wraps the navigator in the provider. `TabBar.tsx` copies the pager's position into the shared header. No tab uses it yet in this branch (`SHARED_HEADER_TABS` is empty).
* Fix after the emulator test: the fade toward a tab with its own header is on the card itself, not on its parent. Android draws an elevation shadow with the view's own opacity only, so the shadow stayed for about a second.
* `TabHeaderHost.test.tsx`: 12 tests, including the two for the shadow fix.

## Result

* Tests: every suite of the branch passes; the whole stack passes 2854 of 2854. Typecheck and ESLint clean.
* Pull request: opened in the G2 stack right after this log.
* Checked on the Android emulator: Billetera, Recomendaciones and Inversión switch with the header in place, and the shadow fades with the card toward the Dashboard.

## Decisions and problems

* The pager's position is a native-driven `Animated` value. It is copied into a Reanimated shared value with `addListener`. The header only changes height and opacity, so a frame of lag does not show.
* The branch is about 590 lines, over the 400 line guideline, because the host's tests are 234 lines. The host itself is one piece that cannot be split usefully.
* Local setup problem, not in code: Keycloak's port was not published after `make dev` started while an old Metro held port 8081. `docker restart fynk-keycloak-1` fixed it.

## Next step

Billetera, Recomendaciones and Inversión hand their header to the host (`feature/tab-header-wallet-advice-investment`).
