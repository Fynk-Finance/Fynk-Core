---
date: 2026-10-27
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: feature/theme-dark-mode
tool: Claude Code
pr: none
status: done
---

# Light and dark palettes and the theme provider

## Instruction

Same session as #11 to #13. Sofia asked to support the new dark mode with "a default and allow specifications when the user indicates them", and to "review the current design tokens and components to follow the new screen specifications". She chose: follow the phone by default, with Claro or Oscuro as an override. This branch is M0 Step 7.2, part 1: tokens and theme. The components move to the theme in the next branch.

## What was done

* `src/shared/ui/tokens.ts`:
  * `lightColors` and `darkColors` with the same keys, from the light and dark token table of `docs/design/README.md`;
  * new tokens: `borderBlue`, `borderBlueStrong`, `focusRingOnPrimary`, `accentStroke`, `accentText`, `textBody`, `trackOff`, `dangerPressed`, `canvas`, `onPrimary`, `shadow`, `headerDashboard` and `pullTab`;
  * `makeShadows(palette)` with per-scheme `shadows`;
  * the old `colors` and `shadow` stay as deprecated light-only aliases until the components move.
* `src/shared/ui/theme/`:
  * `resolveScheme` (pure);
  * `asyncStorageThemeStore` (key `ui.themePreference`, falls back to `system`);
  * `ThemeProvider`, `useTheme`, `useThemePreference` and `useThemedStyles` (one style object per scheme).
* `src/app/AppRoot.tsx`: `ThemeProvider` at the root. The navigation theme and the system background follow the active scheme.
* `app.json`: `userInterfaceStyle` set to `automatic`.
* ESLint: `src/app` and `src/modules` cannot import a raw palette, only `useTheme()`. Checked with a probe file that the rule fires.
* Tests:
  * `tokens.test.ts` checks all 41 README rows in both themes, key parity, colors on blue, and shadows;
  * `theme/theme.test.tsx` covers the scheme rules, phone default, saved choice, override, native sync, the style cache and the store fallback.

## Result

* Tests: 17 suites, 311 tests and 50 snapshots pass. ESLint, `tsc` and Prettier are clean.
* Light output is unchanged: the 50 existing snapshots pass untouched.
* Pull request: not opened yet. It contains #11 (the README token table it tests against) and #13 (AsyncStorage), so it is a draft until both merge.

## Decisions and problems

* The README token table and `tokens.test.ts` were changed together, so the code cannot drift from the documented design.
* The light `white` played two roles: page surfaces, which turn `#13212D` in dark, and text and icons on blue, which stay white. They are now `background` and `onPrimary`.
* The Dashboard header and its pull tab are a muted blue in dark only (`#428FAF`, `#418EAE`). `design-color-pairs` cannot pair that screen, so the values were read from the two files by hand and added to the README in #11.
* The status bar stays light in both themes, because every screen starts under a blue header.
* The theme preference is read before the vault unlocks, so it lives in AsyncStorage.

## Next step

`feature/theme-components`: move every component, the tab bar and the catalog to `useTheme()`, add dark snapshots and the catalog's Claro and Oscuro switch, and remove the deprecated `colors` alias.
