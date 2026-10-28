---
date: 2026-10-27
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6, SCRUM-5]
branch: chore/add-mobile-auth-libraries
tool: Claude Code
pr: none
status: done
---

# Add the mobile sign-in libraries (react-native-app-auth, react-native-keychain)

## Instruction

Part of the M1 session that builds branches 1, 3 and 5 of `docs/modules/M01-identity.md`. Branch 5 (mobile sign-in with PKCE) needs two native libraries. The developer asked that changes to M0 files go in "separate chore PRs" for Sofia to review.

## What was done

* `apps/mobile/package.json` and `pnpm-lock.yaml`: `react-native-app-auth` 9.0.0 and `react-native-keychain` 10.0.0, installed with `expo install` at exact versions.
* `apps/mobile/app.json`: the `react-native-app-auth` config plugin with the redirect `co.fynk.app://oauth/callback`.
* `apps/mobile/.env.example`: `EXPO_PUBLIC_KEYCLOAK_ISSUER`, and `EXPO_PUBLIC_DEV_AUTH`, which only works in development builds.
* `docs/adr/0001-stack.md`: one row per library.

## Result

* ESLint, `tsc` and Jest pass: 17 suites, 256 tests.
* `expo prebuild --no-install` writes `manifestPlaceholders.appAuthRedirectScheme = 'co.fynk.app'` and the AppAuth result forwarding in `MainActivity`. Expo does not create the iOS project on Windows, so CI's prebuild job checks iOS.

## Decisions

* The OAuth redirect uses its own scheme, `co.fynk.app`, not `fynk://`. AppAuth on Android captures every link of its redirect scheme, which would break M0's `fynk://` deep links.
* react-native-app-auth 9.0.0 instead of 8.5.1. Both came out on 19 Oct 2026, and 9.0.0 targets React Native 0.86 or newer, which matches our 0.88.

## Problems

* `expo install` could not write `app.json` because of a Windows file lock (EBUSY). It left a temporary file behind. The plugin entry was added by hand and the temporary file deleted.

## Next step

* `feature/mobile-sign-in-with-pkce` builds on this branch.
