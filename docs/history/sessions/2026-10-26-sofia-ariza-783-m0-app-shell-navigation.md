---
date: 2026-10-26
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: feature/app-shell-navigation
tool: Claude Code
pr: none
status: done
---

# M0 Step 4, part 3 of 3: four-tab navigation, module registry and deep links

## Instruction

Same session and instruction as parts 1 and 2. This part covers what the M0 prompt asks for:
* "`RootNavigator` with an auth stack, an onboarding stack and the main tabs";
* "`src/app/registry.ts` declares every module's screens once ... with all 14 modules already listed, each exporting a placeholder screen";
* "Deep link scheme `fynk://`, with paths reserved per module ... listed in `src/app/linking.ts`".

## What was done

* **`src/shared/navigation`.** The `ModuleRoutes` contract has four fields:
  * `tab`, the root screen of a main tab;
  * `screens`, named `<module>.<Screen>` with a path under the module's prefix;
  * `flow`, a full-screen flow such as sign in, unlock or onboarding;
  * `useGate`, which says when that flow shows.

  It also has `createPlaceholderScreen`, built from design system components.
* **Each of the 14 `src/modules/<module>/index.ts`.** It exports placeholder `routes`, its tab for the four tab owners, a flow for identity, vault and onboarding, and one placeholder screen with a deep link for the rest.
* **`src/app/registry.ts`.** All 14 modules, listed once, and the tab owners:
  * Dashboard: M6;
  * Billetera: M9;
  * Recomendaciones: M11;
  * Inversión: M15.

  It also holds the gate order (identity, vault, onboarding) and `collectScreens`, which rejects badly named or duplicate screens.
* **`src/app/linking.ts`.** The `fynk://` scheme, one reserved prefix per module, tab paths, and a check that no module declares a path outside its prefix. It keeps the prefixes other modules already use: `billetera` (M9), `metas` (M8) and `bank` (M5, for `fynk://bank/callback`).
* **Navigation.**
  * `RootNavigator`: the first open gate's flow, otherwise the tabs plus every module screen. `fynk://dev/catalogo` opens the design system catalog in development.
  * `MainTabs`, and `TabBar` like the design's bottom bar: light blue, white filled icon and dot on the active tab, 72 % white inactive tabs, and a white notch under the active tab.
* **`AppRoot`.** Loads the fonts, then the safe area, TanStack Query (no background refetch, CLAUDE.md rule 4) and the navigation container.
* **`apps/mobile/e2e/tabs.yaml`.** The first Maestro flow (opens, sees the 4 tabs, switches tabs). `make e2e` runs it.

## Result

* Jest: 256 tests and 50 snapshots pass. The whole app renders on the Dashboard tab with the 4 tabs, and pressing Billetera switches to M9's placeholder. `make lint test` passes.
* Deep links resolve: `fynk://billetera` opens the Billetera tab and `fynk://notificaciones` opens the inbox placeholder.
* Not run: the Maestro flow and the app on a phone. There is no Android SDK or emulator on this machine, and iOS needs a Mac. The Android bundle and `expo prebuild` work.
* Pull request: opened right after this log, based on `feature/ui-components`.

## Decisions and problems

* Gates run in a fixed order on every render, so React's hook order never changes. M1, M2 and M3 open them later from their own `index.ts`, without editing `src/app`.
* This pull request touches the `index.ts` of all 14 modules, so each module owner should look at their file.
* The routes contract (`ModuleRoutes`) is new shared API. It is not in `00-shared-contracts.md`, but the M0 prompt requires the registry. It should be added to the shared contracts doc.

## Next step

Merge parts 1 to 3. Someone with an Android emulator or a phone runs `pnpm --filter @fynk/mobile android` and `make e2e` to check Gate A on a device. Then Step 5, `feature/local-dev-stack`.
