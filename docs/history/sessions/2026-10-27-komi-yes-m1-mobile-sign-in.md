---
date: 2026-10-27
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6, SCRUM-5]
branch: feature/mobile-sign-in-with-pkce
tool: Claude Code
pr: none
status: done
---

# Sign in from Inicio and send the session on every API call

## Instruction

Last of the three branches of M1 branch 5. The developer said: "Resume, you can do the PRs now I already installed github CLI and install make". `make` was not on the PATH yet, so it was installed with winget (GNU Make 4.4.1).

## What was done

* `ui/InicioIllustration.tsx`: the cards, coin stacks and sparks of `VerdeInicio.dc.html` with `react-native-svg`, same viewBox, paths and colors, at their resting frame.
* `ui/Rise.tsx`: the design's `fk-rise` entrance (0.7 s ease-out, 12 px, delays 0.15, 0.3 and 0.45 s), off with reduced motion.
* `ui/InicioScreen.tsx`: title, subtitle, `AccentButton` "Empezar" (sign up), "Ya tengo cuenta" (sign in, not in the design), the error line, busy state while the browser is open.
* `ui/IdentityFlow.tsx`: loader while the stored tokens are read, then Inicio. `ui/useSessionState.ts` uses `useSyncExternalStore`, so no new library.
* `index.ts`: builds the session (dev session when allowed), installs the API hooks, opens the gate until signed in, exports `useSession`, `getAccessToken`, `signIn`, `signUp`, `signOut` and `deviceId` (null until device registration).
* Tests: loader then Inicio, "Empezar" opens registration and "Ya tengo cuenta" sign in, both blocked while busy, no message after a cancel, the right message after a failure.

## Result

* `make lint-mobile test-mobile format-check test-scripts`: ESLint, `tsc`, 309 Jest tests in 23 suites, Prettier and 21 script tests pass.
* Pull request: opened right after this log.
* Not tried on a device or emulator yet: the real Keycloak round trip, the return through `co.fynk.app://oauth/callback` and the silent refresh after 5 minutes.

## Decisions and problems

* The design's looping animations (floating cards, shine, coin drop, twinkle) are left for a follow-up branch to keep this PR's size in check.
* "Ya tengo cuenta" and the error line are new UI and need design review.
* RNTL 14's `fireEvent` is async: an unawaited press left an `act` scope open and broke the next test. All presses are awaited.

## Next step

* Manual check on an Android emulator (steps in the PR).
* Follow-up branch for the Inicio illustration's looping animations.
* M1 branches 2 (Keycloak theme), 4 (devices and profile endpoints) and 6 (linked devices screen).
