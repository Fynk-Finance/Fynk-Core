---
date: 2026-10-27
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6]
branch: chore/app-shell-tests-with-module-gates
tool: Claude Code
pr: none
status: done
---

# Keep the app shell tests independent of the sign-in gate (M0 files)

## Instruction

Part of building M1's mobile sign-in (`feature/mobile-sign-in-with-pkce`). The developer asked that changes to M0 files go in "separate chore PRs" for Sofia to review.

## What was done

* `apps/mobile/src/app/registry.test.ts`: the gate test checks the order, and that every gate module has a flow and a `useGate` function. It no longer calls the gates, because M1's gate is a React hook and cannot run outside a render.
* `apps/mobile/src/app/AppRoot.test.tsx`: `@modules/identity` is replaced by a stand-in whose gate the test sets, so the shell tests do not touch Keychain or the browser. New test: while the sign-in gate is open, the flow is shown instead of the tabs.

## Result

* `jest src/app`: 3 suites, 18 tests pass. ESLint, `tsc` and Prettier are clean.

## Decisions

* The stand-in lives in the test, not in `jest.setup.ts`, so the identity module's own tests still use the real module.

## Problems

* None.

## Next step

* `feature/mobile-sign-in-with-pkce` builds on this branch.
