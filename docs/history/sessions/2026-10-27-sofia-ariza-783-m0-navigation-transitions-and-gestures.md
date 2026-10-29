---
date: 2026-10-27
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: feature/navigation-transitions-and-gestures
tool: Claude Code
pr: #29
status: done
---

# Default transitions, back gestures and swipeable tabs

## Instruction

Same session as #11 to #15. Sofia asked: "All transitions between screens must be smooth animations and allow gesture navigation. Manage a default and allow specifications when the user indicates them", and chose tabs that also switch by swipe. This branch is M0 Step 7.3. It is stacked on `feature/theme-components`.

## What was done

* `src/shared/navigation/types.ts`: `ModuleScreen.presentation` replaced by `transition` (`push`, `modal`, `sheet`, `fade`, `none`) and `gesture` (`default`, `vertical`, `off`), as in shared contracts 3.6. No module used `presentation` yet.
* `src/app/navigation/screenOptions.ts`: a pure mapping to native stack options.
  * `push`: iOS-style slide on both platforms, with the full-screen swipe back.
  * `modal`: slides up and closes with a swipe down.
  * `sheet`: a native form sheet with the 32 px radius.
  * `fade` and `none`.
  * `gesture` overrides the transition's gesture.
  * Reduce Motion turns every animation into a fade and keeps the gestures.
* `RootNavigator.tsx`: every screen gets `screenOptionsFor(screen)`. Gate flows and the tabs replace each other with a fade and no gesture back.
* `app.json`: Android `predictiveBackGestureEnabled: true`, so the system back gesture shows the previous screen while swiping.
* `MainTabs.tsx`: material top tabs at the bottom with `swipeEnabled`. A tap jumps instead of sliding when Reduce Motion is on.
* `TabBar.tsx`: the notch follows the pager's `position` during a swipe.
* `@react-navigation/bottom-tabs` removed, and the ADR updated.
* Tests:
  * `screenOptions.test.ts` (8): defaults, overrides, Reduce Motion, flow fade;
  * `AppRoot.test.tsx`: tabs switch by swipe (the pager's page-selected event), and the notch sits halfway mid-swipe.

## Result

* Tests: 19 suites, 371 tests and 100 snapshots pass. ESLint, `tsc` and Prettier are clean.
* Not checked on a device in this session: the iOS full-screen swipe, Android predictive back, and nested carousels handing the swipe to the tabs. These need a dev build on a phone.
* Pull request: #29.

## Decisions and problems

* `ios_from_right` gives Android the same slide as iOS, so the motion looks the same on both phones.
* A tab swipe on the pager is native (`react-native-pager-view`), so it stays smooth and nested horizontal scroll views win until their edge. This needs a check on a device with the Dashboard carousel once M6 and M8 build it.
* Testing Library 14 no longer has `UNSAFE_getByType`, so the swipe test finds the native pager host (`RNCViewPager`) with `screen.root.queryAll`.

## Next step

`feature/gesture-components` (M0 Step 7.4): `BottomSheet`, `Fab`, `Toast`, `Switch`, `SegmentedControl`, `Carousel` with `PageDots`, `PullTab`, `Accordion`, `CollapsingHeader` and `SearchField`. Then `feature/appearance-setting`.
