---
date: 2026-10-29
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23]
branch: chore/add-expo-web-browser
tool: Claude Code
pr: none
status: done
---

# Add expo-web-browser for the bank login

## Instruction

The developer approved step B of the plan: "Yes, push and do B". Its first part is a dependency-only pull request, reviewed by Sofia (M0), because M5 step 3 opens the bank's authorization page in the system browser.

## What was done

* `apps/mobile/package.json`: `expo-web-browser` `58.0.6`. `pnpm-lock.yaml`: only that package is added (no new transitive dependencies).
* No code uses it yet. M5's `feature/mobile-connect-bank-flow` will.

## Result

* `pnpm install --frozen-lockfile` and the mobile typecheck pass.
* Pull request: not opened yet.

## Decisions and problems

* **Version 58.0.6:** the one Expo SDK 58.0.19 bundles (`bundledNativeModules.json` says `~58.0.6`), pinned exactly as ADR 0001 requires. That's how M12 pinned `expo-notifications`.
* **`expo-web-browser`, not `react-native-app-auth`** (already used by M1): our backend returns a ready-made `authorizeUrl` from the PAR, with the PKCE challenge and `state` already inside. The phone has to open that exact URL. `react-native-app-auth` builds its own authorization URL, with its own `state` and PKCE. `openAuthSessionAsync` opens our URL as is, in the same system browser session (ASWebAuthenticationSession on iOS, Custom Tabs on Android), so it's still never a webview.
* **No `app.json` change:** the package's config plugin only does something with the optional `experimentalLauncherActivity` setting, which we don't use.
* **A new dev build is needed** once code uses the native module. Sofia's call when to rebuild.

## Next step

`feature/bank-vault-tables`.
