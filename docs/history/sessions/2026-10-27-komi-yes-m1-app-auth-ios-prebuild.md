---
date: 2026-10-27
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6]
branch: chore/add-mobile-auth-libraries
tool: Claude Code
pr: '#17'
status: done
---

# Fix the iOS prebuild with react-native-app-auth on Expo SDK 58

## Instruction

After the developer asked to open the PRs, CI's "Expo prebuild" job failed on #17 (and on #20, stacked on it): `react-native-app-auth could not find application(_:continue:restorationHandler:) in the Expo AppDelegate`.

## What was done

* Found the cause:
  * Expo SDK 58's AppDelegate template (`expo-template-bare-minimum` 58.0.29) uses the scene based life cycle and no longer has that method.
  * `react-native-app-auth` 9.0.0's config plugin requires the method and throws.
  * 9.0.0 is the latest release.
* `apps/mobile/plugins/withAppAuthSceneLifecycle.js`: a small config plugin that adds a pass-through override of the method (it calls `super`), so the library's patch can run. It is listed after `react-native-app-auth` in `app.json`, because Expo runs mods in reverse order. Checked by running Expo's mod compiler on the SDK 58 template in both orders: only this order works.
* `apps/mobile/plugins/withAppAuthSceneLifecycle.test.js`, with the SDK 58 `AppDelegate.swift` as a fixture:
  * the template alone fails the library's patch;
  * with the plugin, the patch succeeds;
  * the method is added only once;
  * a changed template fails loudly.

## Result

* 4 new tests pass; ESLint and Prettier are clean. The Android prebuild runs locally. The iOS prebuild can only run on macOS or Linux, so CI is the check.
* Not compiled with Xcode: there is no Mac in the team setup yet.

## Decisions and problems

* The sign-in does not depend on this method: on iOS 13+ AppAuth gets the redirect from `ASWebAuthenticationSession` directly. The library only requires the AppDelegate to conform to its protocol, which its own patch adds.
* The plugin should be removed once `react-native-app-auth` supports the SDK 58 template. Worth an upstream issue.

## Next step

* Rebase the stacked branches (#20, #25, #26, #27) on this fix.
