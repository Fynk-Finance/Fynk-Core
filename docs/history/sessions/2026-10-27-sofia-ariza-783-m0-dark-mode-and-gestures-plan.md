---
date: 2026-10-27
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: docs/dark-mode-and-gestures-plan
tool: Claude Code
pr: #12
status: done
---

# Plan dark mode, transitions and gestures across the modules

## Instruction

Same session as `docs/update-design` (#11): "update the plan with the new screens … consider [buttons and gestures] in the plan. All transitions between screens must be smooth animations and allow gesture navigation. Manage a default and allow specifications when the user indicates them." Sofia chose defaults with overrides for the theme and the transitions, and tabs that also switch by swipe. This branch updates the plan documents. It is stacked on #11.

## What was done

* `docs/modules/00-shared-contracts.md`:
  * new section 3.6, theme and navigation: `ThemePreference` (default `system`), `useTheme`, `useThemedStyles`, `useThemePreference`, and `ModuleScreen.transition` and `gesture` with their defaults;
  * rules for Reduce Motion, gate flows, gestures with a button, and tab swipe against carousels;
  * reference numbers from Metas and Estadísticas (checked by hand: categories add to $3.482.400, $116.080 a day, $140.000 a month, 23 %).
* `docs/modules/M00-foundations.md`: new design paths, the navigation libraries in the technical decisions, and Step 7 with five branches (libraries, theme, transitions and tab swipe, gesture components, Apariencia screen) and its criteria.
* `docs/modules/00-phases-and-gates.md`: Gate A asks for light and dark, tab swipe, edge swipe back and Reduce Motion fades.
* `CLAUDE.md`:
  * decisions "Dark mode" and "Navigation and gestures";
  * theme preference in "Where data lives";
  * open items 7 (anonymous usage statistics in Privacidad) and 8 (WhatsApp support).
* Module prompts M01 to M15: each design line lists its screens by their new names, in light and dark, with what is new for that module. M01 Dispositivos vinculados is now designed in Seguridad. M03 gets a step order note and its navigation rules. M04 consents start from "Cuentas conectadas".

## Result

* Docs only, no tests to run. The old `design/source` paths and numbered PNG names no longer appear in `docs/modules/` or `CLAUDE.md`.
* The claude.ai doc "Fynk Implementation Plan by Modules" was not updated. It is not in Sofia's artifact list, and the Docs connector cannot look up a doc by name, so its link is needed.
* Pull request: #12.

## Decisions and problems

* `transition` replaces the old `presentation` field of `ModuleScreen`. Gate A has not passed, so M0 can still change the shared contracts.
* The theme preference lives outside the vault, so the lock screen is themed before unlock. It is not personal data.
* M3: the design now has Correo as step 1, but the Jira criterion lists nombre first. The prompt asks to confirm with the team and update Jira before steps 1 and 2 are built.
* The module prompt lines belong to their owners, so CODEOWNERS asks each of them to review.

## Next step

`chore/add-gesture-and-pager-libraries` (M0 Step 7.1), then `feature/theme-dark-mode`.
