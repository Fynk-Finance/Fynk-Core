---
date: 2026-11-02
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: chore/add-expo-navigation-bar
tool: Claude Code
pr: none
status: done
---

# Add expo-navigation-bar for the Android navigation bar fix

## Instruction

Testing the app on an Android 15 phone, Sofia saw that "the phone menu should be the same color as the bar, but it is white. It breaks the look", and asked: "Lets fix the error in the default android bar. In a different pr." CLAUDE.md asks for a new library in its own small pull request, so this is the bottom of a stack of two.

## What was done

* `apps/mobile/package.json` and `pnpm-lock.yaml`: `expo-navigation-bar` 58.0.4, the version of Expo SDK 58. Nothing else changed in the lockfile.
* `docs/adr/0001-stack.md`: new row explaining why the library is there.

## Result

* `pnpm install --frozen-lockfile` and Prettier pass.
* The library is used in the next pull request of the stack (`fix/android-navigation-bar-contrast`), where it was checked on the phone.
* Pull request: see the PR of this branch.

## Decisions and problems

* A small config plugin of our own could turn off the contrast layer, but the button color must change at runtime when the person picks Claro or Oscuro in Apariencia, and that needs a native call. expo-navigation-bar does both and belongs to the Expo SDK, so it follows Expo upgrades.

## Next step

Review the stack bottom-up: this pull request first, then the fix above it.
