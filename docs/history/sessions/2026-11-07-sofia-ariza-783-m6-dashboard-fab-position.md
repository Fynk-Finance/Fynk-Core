---
date: 2026-11-07
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M6
jira: [SCRUM-76]
branch: fix/dashboard-fab-position
tool: Claude Code
pr: "#333"
status: done
---

# Place the Dashboard + button just above the tab bar (QA review V1)

## Instruction

Sofia asked to fix the Dashboard findings of the 7 Nov app review (#332): "In pr #332 theer are several visual and gestual changes, lets solve them. Most af them are small changes, lets start for Dashboard screen changes." This session covers V1: the + button sits higher than in the design and should be about 12 px or less above the tab bar.

## What was done

* `apps/mobile/src/modules/accounts/ui/DashboardScreen.tsx`: the FAB goes from `bottom: 92` to `bottom: 12`, still `right: 16`.
* `DashboardScreen.test.tsx`: a test checks the FAB sits at right 16 and bottom 12.

## Result

* Tests: 158 of 158 in the accounts module. Typecheck, ESLint and Prettier clean.
* Pull request: #333.

## Decisions and problems

* The design's 92 px counts its 72 px tab bar, which overlaps the page there (92 − 72 = 20 px). In the app the tab bar sits below the page (`tabBarPosition="bottom"`), so 92 put the button 92 px above the bar. 12 px follows the finding (12 px or less).

## Next step

Check it on a phone next to `docs/design/screens/light/Dashboard.png`, in light and dark.
