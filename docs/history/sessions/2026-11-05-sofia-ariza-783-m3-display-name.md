---
date: 2026-11-05
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M3
jira: [SCRUM-69]
branch: feature/onboarding-display-name
tool: Claude Code
pr: none
status: done
---

# Export the name typed in onboarding for the Dashboard greeting

## Instruction

Sofia asked to continue the onboarding work: "Doesn't export the name typed in onboarding (the Dashboard greeting shows no name)." The Cuentas step was done in the same session on other branches (see `2026-11-05-sofia-ariza-783-m3-accounts-step.md`).

## What was done

* **`onboarding/application/useDisplayName.ts`** (new): `useDisplayName()` reads the name with `GET /me` through React Query and gives the full name ("Laura Gómez"), or null while it loads, when there is none, or on error. The cache key carries the account id, so one account's name never shows for the next account on the phone. It does not ask while signed out.
* **`useRememberName()`**: the Nombre step puts the name it just saved in that cache, so the Dashboard shows it as soon as the setup ends, before the API answers.
* **`onboarding/index.ts`**: exports `useDisplayName`. One `createProfileNameApi()` serves the step and the hook. `userId` from M1 is read on render only.
* **`accounts/index.ts`** (M6): the Dashboard takes the name from M3 instead of `() => null`. The `TODO(M3)` is gone.
* **`app/AppRoot.test.tsx`** (M0): its onboarding mock gets `useDisplayName`, which the Dashboard now calls.
* **Tests:** 6 hook tests (full name, null while loading and when empty, null on error, no request while signed out, one cache entry per account, a saved name shows on the first render). The Nombre test checks that the saved name reaches the cache, and that nothing does when saving fails.

## Result

* Tests: onboarding, accounts and app suites, 252 pass. `tsc`, ESLint and Prettier are clean.
* Pull request: not opened yet.

## Decisions and problems

* **The name is not stored in the vault.** "Where data lives" puts the profile name in Keycloak, so the greeting reads `GET /me` and uses the cache.
* **Full name, not the first word.** `HeaderBlue` shows the name with the avatar initials, and the Dashboard tests already use "Laura Gómez".
* **Open:** on a cold start the header shows "Invitado" until `GET /me` answers. Fixing it needs a loading state in M6's Dashboard (`undefined` while loading).
* **Open:** M11's `RecommendationsScreen` has its own `useDisplayName` target; the team can point it to this export.

## Next step

Open the pull request. Then the Cuentas step stack.
