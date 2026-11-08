---
date: 2026-11-07
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M6
jira: [SCRUM-93]
branch: feature/dashboard-pull-to-sync
tool: Claude Code
pr: none
status: done
---

# Pull the Dashboard down to sync, with a growing indicator (QA review F3)

## Instruction

Sofia asked to go on with the Dashboard findings of the 7 Nov app review: "Continuee with the next changes. Stack everything is related with the same screen." This session covers F3: pull down at the top of the Dashboard, everything moves down and a loading indicator grows in size and opacity; releasing at the maximum syncs with the banks, and the 60 s cooldown still applies.

## What was done

* `accounts/ui/pullToSync.ts` (new, pure): the page moves half as far as the finger, up to 64 px below the top inset; the indicator grows from 40 % to full size and from transparent to opaque; letting go at the maximum syncs and holds the page 56 px below the inset, otherwise it springs back.
* `accounts/ui/DashboardScreen.tsx`: a downward pan on the page, simultaneous with the scroll view's own gesture and only at the top of the page, moves the header and the page together. The indicator (a blue circle with the sync icon) sits behind them and shows in the gap; while M5 syncs it spins (still with Reduce Motion) and the page waits, then everything springs back. A second sync cannot start while one runs. The native `RefreshControl`, the iOS bounce and the Android glow are gone. The page has an "Actualizar" accessibility action that runs the same sync.
* Tests: the pull math, the sync then the accounts read again, a failing sync, no second sync while one runs, the hidden indicator and no native spinner, and nothing without M5.
* `docs/design/README.md`: the gesture table notes the Dashboard's pull.
* Corrected the stack number in the V2 and V5 session log (#337 became #338).

## Result

* Tests: 2,715 of 2,715 in the app, 128 snapshots. Typecheck, ESLint and Prettier clean.
* Pull request: not opened yet. Stacked on #342 (stack #338), the last one of the Dashboard findings.

## Decisions and problems

* The three vertical gestures stay apart: a drag on the header opens Detalle de cuentas (G1), a drag on the page scrolls and shrinks the header (G3), and a pull on the page at the top syncs (F3). The QA notes asked to build them in this order so they do not fight.
* M5's `syncNow` keeps the 60 s cooldown; the Dashboard only calls it, as before.
* Jest cannot run native gestures, so the pull is covered by the pure functions and must be checked on a phone, on iOS and Android.

## Next step

Check the three gestures together on a phone, then take the screenshots for every pull request of stack #338.
