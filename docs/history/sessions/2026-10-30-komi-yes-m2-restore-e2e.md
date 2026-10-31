---
date: 2026-10-30
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-62]
branch: test/restore-e2e
tool: Claude Code
pr: none
status: done
---

# The Maestro flow for the restore with the recovery code

## Instruction

The M2 prompt asks for a Maestro flow: "device A registers, creates a goal, device B logs in, restores with the code, sees the goal". One YAML flow and its helper script, no app code, run on one emulator with two devices in sequence.

## What was done

* **`e2e/vault/restore-with-code.yaml`:**
  * Device A signs up as `identity/signup.yaml` does, copies the 5 recovery groups into variables, confirms the last one, creates a goal and waits past the 5 s upload debounce, then sends the app to the background and stops it.
  * Device B launches with the state and keychain cleared, signs in ("Ya tengo cuenta"), restores with the 5 groups typed into the code input and looks for the goal in Metas.
* **`e2e/vault/scripts/goal-name.js`:** a goal name with a timestamp, so an old goal cannot satisfy the last step. The flow reuses the identity scripts by relative path.

## Result

* The YAML parses (checked with the `yaml` package) and every testID and label was found in the source. `make format-check` passes.
* It was not run: there is no emulator here.
* The last step needs M8 to register `savings.goals` for the backup (`TODO(M8)` in the flow).

## Decisions and problems

* **Deep links to the goal screens:** the Dashboard does not place the goals carousel yet (M6 does), so the flow opens `fynk://metas/nueva` and `fynk://metas`.
* **The upload on device A:** `stopApp` kills the process, so the flow presses Home first to trigger the background flush, after the debounce wait.
* **The wait:** Maestro has no sleep, so it is an optional `extendedWaitUntil` on a text that never shows.
* **Only an emulator can check:** the `copyTextFrom` plus `evalScript` pattern, `../` script paths, `clearKeychain` on Android (iOS only; app data clears the Keystore keys), `pressKey: Home`, and the typed code with spaces.

## Next step

Run it on an emulator, then again once M8 registers `savings.goals`.
