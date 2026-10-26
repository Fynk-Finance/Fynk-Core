---
date: 2026-10-26
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: feature/design-tokens-and-icons
tool: Claude Code
pr: none
status: done
---

# M0 Step 4, part 1 of 3: libraries, design tokens, fonts and icons

## Instruction

After pull request #3 was merged, Sofia said "continue with step 4". Step 4 of the M0 prompt (`feature/app-shell-and-design-system`):
* read the design code and PNGs;
* write `tokens.ts` "with the exact values in the tokens table";
* load the three fonts;
* copy the icons and the logo from the design;
* build about 20 components with stories and snapshot tests;
* build the four-tab navigation, `registry.ts` and `linking.ts`.

The work came to about 3.900 lines plus generated snapshots, so Sofia chose 3 stacked pull requests. This is the first.

## What was done

* Every library of Step 4 in one commit, so the lockfile changes once, all pinned exactly:
  * React Navigation 7 (native stack, bottom tabs), react-native-screens and safe-area-context;
  * react-native-svg, Reanimated 4 with worklets, react-native-gifted-charts with expo-linear-gradient;
  * expo-font and the three `@expo-google-fonts` packages, TanStack Query and expo-system-ui.
* The Jest config uses Reanimated's resolver and the safe-area mock.
* `app.json`: `com.fynkfinance.app` as the Android package and iOS bundle id, and the expo-font plugin.
* `src/shared/ui/tokens.ts`:
  * the 24 colors of the README table;
  * extra values taken from the design code, each with the screen it comes from;
  * fonts per weight, the font sizes and line heights used in the design, radii, sizes, spacing, motion durations;
  * the CSS shadows translated to React Native.
* `fonts.ts`: loads only the 8 weights the design uses, one entry point per weight.
* `AppText` with the text styles found in the design. `strings.es-CO.ts` for the shared copy.
* `icons/`:
  * every icon used by the screens, copied from the design SVGs, including the outline and filled versions of the 4 tab icons;
  * `Icon` draws them with react-native-svg;
  * `FynkLogo` is copied from `VerdeLogin.dc.html`.
* `docs/adr/0001-stack.md` lists every library with its version and why it was chosen.

## Result

* `tokens.test.ts` reads `docs/design/README.md` and checks all 24 colors, the font sizes, radii and sizes. `icons.test.tsx` draws every icon and checks color and accessibility.
* `make lint test` passes on this branch alone.
* `expo-doctor`: 20 of 20 checks pass. `expo export --platform android` builds the bundle, and `expo prebuild` generates the Android project with the `fynk://` scheme.
* Pull request: opened right after this log.

## Decisions and problems

* @tanstack/react-query 5.105.0 was published the same day, so 5.104.5 is used because of pnpm's release age policy.
* Importing each font package's index bundled every weight (about 20 files). Importing each weight from its own entry point keeps only the 8 the design uses.
* The token test reads the README through `jest.requireActual('fs')`, so the app gets no Node types (it runs on React Native).
* `expo-linking` was tried for the Expo Go URL prefix and removed. Development builds already register `fynk://` (and `exp+fynk://`) from `app.json`.
* `com.fynkfinance.app` follows the GitHub organization name. The team can change it before the first store build.
* Zustand is decided but not added yet, because the shell has no small UI state that needs it.

## Next step

Review and merge this pull request, then `feature/ui-components` (part 2), then `feature/app-shell-navigation` (part 3).
