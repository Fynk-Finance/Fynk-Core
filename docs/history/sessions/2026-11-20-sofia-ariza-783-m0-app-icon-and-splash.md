---
date: 2026-11-20
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: []
branch: feature/app-icon-from-fynk-logo
tool: Claude Code
pr: "#448"
status: done
---

# Package the Android app, and give it the Fynk icon and splash screen

## Instruction

The developer asked for the steps to package the app, then built a release APK on Windows with help on each error. Then: "usa el logo de FynkLogo.tsx para generar los PNG" and "Configure app.json to use the new splash-icon". No Jira task exists for this, and the developer asked for a single commit because the change is small and touches no behavior.

## What was done

* `apps/mobile/assets/`: `icon.png`, `android-icon-foreground.png`, `android-icon-background.png`, `android-icon-monochrome.png`, `splash-icon.png` and `favicon.png` rendered from the mark of `src/shared/ui/icons/FynkLogo.tsx` (same paths, no wordmark). White on `primary` `#2FA8D8` for the icon, blue on transparent for the splash. The Android foreground mark is 480 of 1024 px tall so it stays inside the adaptive icon safe zone. Rendered with headless Edge from a script outside the repository.
* `apps/mobile/app.json`: adaptive icon `backgroundColor` set to `#2FA8D8`, and the `expo-splash-screen` plugin added with `splash-icon.png`, width 200, background `#FFFFFF` in light and `#13212D` in dark (the `background` tokens).
* `apps/mobile/package.json` and `pnpm-lock.yaml`: `expo-splash-screen` 58.0.14, pinned exactly like the other dependencies.

## Result

* No tests: assets and configuration only. `expo config --type prebuild` resolves the splash plugin with these values. Prettier passes on the edited files.
* A release APK was built locally before the icon change (`./gradlew assembleRelease`, debug signing). The new icon and splash need a new `expo prebuild --clean` and build to be seen on a phone.
* Pull request: #448.

## Decisions and problems

* In SDK 58 the top level `splash` key of `app.json` is web only, so the native splash needs the `expo-splash-screen` plugin. It is added in this same commit instead of a separate `chore/add-expo-splash-screen` pull request, by the developer's choice, because the change is small.
* The design has no app icon or splash screen. They reuse the existing logo mark and theme colors, and need design review.
* Windows build problems found while packaging: `expo prebuild --clean` failed with `EBUSY` while Android Studio and the Gradle daemons held `android/` (close them, `./gradlew --stop`); Gradle did not find the SDK because `--clean` deletes `local.properties` and `ANDROID_HOME` was not set; the C++ build of `react-native-worklets` failed on a 269 character path because the ninja of CMake 3.22.1 does not support long paths, solved with `cmake.dir` pointing to CMake 4.1.2 (ninja 1.12.1) in `local.properties`.

## Next step

Run `expo prebuild --platform android --clean`, restore `sdk.dir` and `cmake.dir` in `android/local.properties`, build the APK and check the icon and splash in light and dark on a phone.
