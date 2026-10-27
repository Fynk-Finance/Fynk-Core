---
date: 2026-10-27
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: feature/theme-components
tool: Claude Code
pr: none
status: done
---

# Move the design system components to the theme

## Instruction

Same session as #11 to #13 and `feature/theme-dark-mode`. Sofia asked to "review the current design tokens and components to follow the new screen specifications", with dark mode following the phone unless the person picks otherwise. This branch is M0 Step 7.2, part 2. It is stacked on `feature/theme-dark-mode`.

## What was done

* Each of the 20 components in `src/shared/ui/components/`, `Icon`, `FynkLogo` and the `TabBar` reads `useTheme()` or `useThemedStyles()`:
  * the light `white` became `background` for surfaces (outlined card, chip, ghost button, focused field) and `onPrimary` for anything on blue;
  * light-blue borders became `borderBlue`.
* `HeaderBlue` has a `dashboard` option for the muted dark header of the Dashboard.
* Things drawn on blue keep their colors in dark, as in the design: the tab bar, its notch, the white icon tile and the logo.
* The deprecated `colors` and `shadow` aliases are removed, and `ColorToken` no longer has `white`.
* Catalog:
  * every story is snapshot-tested in light and in dark;
  * a new `OnColor` helper draws the blue backgrounds of the stories from the theme;
  * the catalog screen has a Claro and Oscuro switch that never saves over the person's choice.
* Stale design file names in comments now use the new names.

## Result

* Tests: 18 suites, 361 tests and 100 snapshots pass (50 light, 50 dark). ESLint, `tsc` and Prettier are clean.
* The 50 light snapshots are byte-identical to `develop`, checked by comparing each entry, so light output did not change.
* Spot checks of the dark snapshots against the design: card `#13212D` with border `#223746`, text `#E8F1F6`, selected chip `#62C8F0`, field `#182A37`.
* Pull request: not opened yet.

## Decisions and problems

* About 850 changed lines without the snapshot file, more than the 400 guideline. The change is mechanical, and the components and stories cannot compile half moved, so it stays one commit. The byte-identical light snapshots make it reviewable.
* The white icon tile keeps `#1F93C2` icons in dark, because it sits on blue cards.

## Next step

`feature/navigation-transitions-and-gestures`: `ModuleScreen.transition` and `gesture`, the edge swipe, Reduce Motion fades, and swipeable tabs.
