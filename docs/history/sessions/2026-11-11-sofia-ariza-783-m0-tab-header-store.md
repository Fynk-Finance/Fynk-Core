---
date: 2026-11-11
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-89]
branch: feature/tab-header-store
tool: Claude Code
pr: none
status: done
---

# useTabHeader: each tab hands its header to a shared one (QA review G2)

## Instruction

Part of the G2 plan (SCRUM-89). The tab pages slide inside a native pager that clips each page, so a header inside a page always slides with it. The header has to move out of the pages.

## What was done

* `shared/navigation/tabHeader.tsx`:
  * A small store read with `useSyncExternalStore`, so a tab that updates its header re-renders only the shared header, never the other tabs.
  * `TabHeaderProvider` and the bridge with the pager's position as a shared value.
  * `useSyncTabHeader`, called by the tab bar.
  * `useTabHeader`: inside the tabs it registers the tab's header and returns a spacer as tall as it; anywhere else (screen tests, catalog) it returns a plain `HeaderBlue`, so existing screen tests do not change.
* `tabHeader.test.tsx`: the fallback outside the tabs, the fallback for a tab that keeps its own header, and the store.

## Result

* Tests: every suite of the branch passes; the whole stack passes 2854 of 2854.
* Pull request: opened in the G2 stack right after this log.

## Decisions and problems

* Content handed to the shared header is drawn outside the screen's navigation context, so it must not call `useNavigation` or `useRoute`. Written at the top of the file.

## Next step

The host that draws the shared header (`feature/tab-header-host`).
