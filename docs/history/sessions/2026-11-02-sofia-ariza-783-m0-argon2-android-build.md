---
date: 2026-11-02
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: chore/patch-react-native-argon2-gradle
tool: Claude Code
pr: none
status: done
---

# Run the app from Android Studio and fix the Android build of react-native-argon2

## Instruction

Sofia wanted to check as many gates as possible on a phone: "List the instructions to run the app from android studio". While following them, the Android build failed in Android Studio, and she asked to fix it and then "commit the argon2 patch and open the PR".

## What was done

* Wrote the steps to run the app from Android Studio: `make generate`, `expo prebuild --platform android`, open `apps/mobile/android`, Metro on port 8088 (Keycloak already uses 8081), `adb reverse` for 8088, 8080 and 8081, and the `.env` modes (dev-token or real Keycloak).
* `patches/react-native-argon2@4.0.0.patch`, registered in `pnpm-workspace.yaml` (`patchedDependencies`) and `pnpm-lock.yaml`. The library's `android/build.gradle` now uses `mavenCentral()` instead of `jcenter()`, has no `buildscript` block pinning AGP 4.1 and no `buildToolsVersion`, and declares `namespace 'com.poowf.argon2'`; the `package` attribute left `AndroidManifest.xml`.

## Result

* `./gradlew app:assembleDebug` builds the debug APK (x86_64) on Windows; the app was then installed from Android Studio on a real Android 15 phone and runs against the local stack.
* `pnpm install --frozen-lockfile` and Prettier pass. No JavaScript changed, so Jest and ESLint are not affected.
* Pull request: see the PR of this branch.

## Decisions and problems

* react-native-argon2 4.0.0 is the latest release, so an upgrade does not help. A pnpm patch was chosen over a fork: it is small, reviewed in the repository and applied on every install.
* Two more Windows problems came up. They are local to the machine, so nothing was committed for them:
  * Reanimated's C++ build failed with a path longer than 260 characters. Windows long paths were already on, but the `ninja` 1.10.2 of CMake 3.22.1 ignores them. Fix: install CMake 4.1.2 in the SDK Manager and set `cmake.dir` in `apps/mobile/android/local.properties`.
  * Android Studio offered to upgrade the Gradle wrapper to 9.8.2. Its Kotlin 2.4 breaks React Native's Gradle plugin (Kotlin 2.2). The wrapper went back to the 9.4.1 that `expo prebuild` writes. Do not accept Gradle or AGP upgrades from Android Studio.
* Testing the sign up on the phone found that every backup flow of the API answers 500 because the audit allow-list rejects the events of M2. Reported as SCRUM-72 for M13 and M2.

## Next step

Daniel (M2) reviews the patch, since the library belongs to the vault module. Consider adding the Windows Android notes (CMake 4.x, Gradle wrapper) to `docs/local-dev.md`.
