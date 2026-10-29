---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-5]
branch: feature/identity-signup-e2e
tool: Claude Code
pr: none
status: partial
---

# Write the Maestro flow for signing up with Keycloak

## Instruction

This is part of the plan to "finish M1 by finishing the pending task that we left until sofia's PRs were merged". The last item of M1's mobile track is an end-to-end flow. A new person taps Empezar, signs up on Keycloak, enters the email code, and lands in the app. Claude Code (Opus) wrote it directly; it was small enough not to need a subagent.

## What was done

* **`apps/mobile/e2e/identity/signup.yaml`:**
  * a clean launch;
  * Empezar;
  * the Fynk registration page (email, password twice, terms);
  * the code page;
  * then the tabs, because M3 has no gate yet.
* **`identity/scripts/new-account.js`** makes a new `@fynk.test` address for each run.
* **`identity/scripts/mailpit-code.js`** reads the code from the local Mailpit:
  * it matches the address in the response, not in a query string;
  * it reads the code line with the same regex as the Keycloak integration tests;
  * it throws until the email arrives, so the flow's `retry` waits for it.
* **`e2e/tabs.yaml` (M0's file, in the plan):** a note that its build needs `EXPO_PUBLIC_DEV_AUTH=dev-token`, and that the Keycloak flows are in `e2e/identity/`.

## Result

* `make lint-mobile` and `make format-check` pass.
* The Mailpit script was run in Node against faked Mailpit answers: it picks the right email, and it throws when the email hasn't arrived or has no code.
* **The flow itself was not run.** This machine has no Android SDK or Maestro. The Keycloak page taps (the field labels and the terms checkbox) may need adjusting on the first real run.

## Decisions and problems

* **It lives in `e2e/identity/`, not next to `tabs.yaml`.** `make e2e` runs the top-level flows of `e2e/` on a dev-token build, which skips Keycloak. This flow needs the real Keycloak, so it runs on its own with `maestro test apps/mobile/e2e/identity/signup.yaml`.
* **The flow ends on the tabs.** When M3 adds its gate, the last step changes to M3's first screen.
* **The ESLint globals of Maestro** (`output`, `http`, `json`, `MAILPIT_URL`) are declared in each script, so the shared ESLint config doesn't change.

## Next step

Run it once on an emulator with `make dev`, and adjust the taps if Chrome Custom Tabs names the fields differently.
