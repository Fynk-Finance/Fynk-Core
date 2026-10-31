---
date: 2026-10-30
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-62]
branch: chore/add-expo-clipboard
tool: Claude Code
pr: none
status: done
---

# Add expo-clipboard for the recovery code

## Instruction

Daniel asked to "continue the implementation of M2 and complete what is left". He approved adding a clipboard library in its own pull request for the "Copiar" button of the recovery code screen.

## What was done

* **`apps/mobile/package.json`:** `expo-clipboard` pinned to 58.0.4, the version in Expo SDK 58's `bundledNativeModules.json`.
* **`pnpm-lock.yaml`:** only the expo-clipboard entries.
* **`docs/adr/0001-stack.md`:** a row for the library.

## Result

* `pnpm install --frozen-lockfile`, `make lint-mobile` and `make test-mobile` (111 suites, 1357 tests) pass.

## Decisions and problems

* The app only writes the code to the clipboard when the person taps "Copiar". It never reads the clipboard.
* Adding a library is reviewed by M0, so this PR is separate from the screen.

## Next step

The backup registry (`feature/backup-registry`).
