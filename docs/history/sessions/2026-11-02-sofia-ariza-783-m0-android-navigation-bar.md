---
date: 2026-11-02
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: fix/android-navigation-bar-contrast
tool: Claude Code
pr: none
status: done
---

# Match the Android navigation bar to the screen

## Instruction

On an Android 15 phone with three-button navigation, the system bar under the blue tab bar showed white: "it breaks the look". Sofia asked: "Lets fix the error in the default android bar. In a different pr."

## What was done

* `apps/mobile/app.json`: the expo-navigation-bar config plugin with `enforceContrast: false`. Android 15 paints a light contrast layer over the three-button bar of an edge-to-edge app unless the app turns it off; the tab bar already painted behind the bar.
* `apps/mobile/src/app/navigationBar.ts`: `navigationBarStyle(scheme, overTabBar)`. Dark buttons over the tab bar in both themes, because the tab bar is the same light blue (`primaryLight`, `#50C1EB`) in light and dark; elsewhere the buttons contrast with the canvas. Unit test in `navigationBar.test.ts`.
* `AppRoot.tsx` renders `NavigationBar` with the theme's style; `MainTabs.tsx` overrides it while the tabs are focused, so a pushed screen gets the theme's style back.

## Result

* ESLint, `tsc` and the 27 tests of `src/app` pass.
* Checked on the phone (Android 15, three-button navigation), light and dark: no white band; dark buttons on the blue tab bar in both themes; dark buttons on the white canvas and light buttons on the dark canvas of a pushed screen (Mi cuenta, Apariencia).
* Pull request: see the PR of this branch.

## Decisions and problems

* The first build gave light buttons on the tab bar. The type comments of expo-navigation-bar 58.0.4 say `light` is a light bar with dark buttons, but its native module (`NavigationBarModule.kt`) treats `dark` as dark content, like expo-status-bar. The mapping follows the native code, and a comment next to the type says so.
* The phone build used a local branch that also had the argon2 patch (#224), because the Android build fails without it. That branch was not pushed.
* `expo prebuild` could not clear `apps/mobile/android` while Android Studio held it, so for the phone check the two plugin lines were added to the local `styles.xml` by hand. A clean prebuild writes them from `app.json`.
* Found while checking: the Android back key on Apariencia closes the app instead of going back to Mi cuenta. Not caused by this change (it does not touch back handling). Left for its own fix.

## Next step

Run a clean `expo prebuild --platform android` once Android Studio is closed, and look into the back key that closes the app on pushed screens.
