---
date: 2026-10-28
developer: Karol
github: Karol2905
module: M12
jira: [SCRUM-70]
branch: chore/add-expo-notifications
tool: Claude Code
pr: none
status: done
---

# Add expo-notifications for M12 local reminders

## Instruction

Claude proposed the dependency pull request that step 2 of M12 needs, and Karol agreed: "si".

## What was done

* Added `expo-notifications` 58.1.6 to `apps/mobile/package.json` and `pnpm-lock.yaml` with `pnpm --filter @fynk/mobile add`.
* Added its row to the library table of `docs/adr/0001-stack.md`: local notifications only, never a push token.

## Result

* Tests: 53 suites and 721 tests of the app pass, and `tsc` is clean. The CI "Expo prebuild" job checks the native projects.
* Pull request: not opened yet. M0 (Sofia) reviews it, as the conflict rules say for a new library.

## Decisions and problems

* `npx expo install` could not reach the Expo API from this environment, so the version was taken from Expo SDK 58's `bundledNativeModules.json` (`~58.1.6`), pinned exactly as the ADR requires.
* 58.1.7 was published a few hours earlier and is held back by the release age policy.
* No config plugin was added to `app.json`. The library's own manifest adds the Android notification permission, and the notification icon and color can come with step 2 if the design asks for them.

## Next step

Open the pull request for Sofia. After it merges, `feature/local-scheduled-notifications` (M12 step 2).
