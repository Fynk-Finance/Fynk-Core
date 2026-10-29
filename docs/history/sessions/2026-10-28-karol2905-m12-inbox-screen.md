---
date: 2026-10-28
developer: Karol
github: Karol2905
module: M12
jira: [SCRUM-70]
branch: feature/notifications-inbox-screen
tool: Claude Code
pr: none
status: partial
---

# Notificaciones screen and bell count (third branch of the M12 stack)

## Instruction

Same session as `feature/notifications-inbox-rules`: start M12 with step 1 of its work plan. This branch has the screen and the bell.

## What was done

* `ui/NotificationsScreen.tsx`: built from the design code `Notificaciones.html` (light and dark). It has the plain back chevron, the title, "<n> sin leer" and the green "Marcar como leídas", then the Hoy, Esta semana and Antes sections. Colors come only from `useTheme()`, and the screen uses the default push transition (inventory row 8).
* `ui/NotificationRow.tsx`: a 40 px icon tile, bold title, body, time and the lime unread dot. Tapping a row marks it read and opens its `deepLink`.
* Loading skeleton, empty state "No tienes avisos por ahora." and an error state with retry.
* `ui/useInbox.ts`: `useInbox`, which delivers due reminders first and reloads on every change, and `useUnreadCount` for the bell. A locked vault reads as an empty inbox with 0 unread.
* `index.ts` replaces M0's placeholder with the real screen and exports `NotificationsScreen` and `useUnreadCount`.
* `ui/NotificationsScreen.test.tsx`: 11 tests with the design rows. They cover the sections and times, 3 unread and their dots, "Marcar como leídas", tapping a row, a reminder that fired while the app was closed, the empty, locked and error states, the dark theme, and the bell counter.

## Result

* Tests: 48 suites and 659 tests of the app pass. ESLint, `tsc` and Prettier are clean.
* Pull request: not opened, the session cannot push (see the first branch).
* Not checked on a phone yet: the screenshots next to the design PNGs are still missing for the pull request.

## Decisions and problems

* The bell lives in `HeaderBlue`, which M0 built with a `hasUnread` prop. The Dashboard (M6) and the other headers have to pass `hasUnread={useUnreadCount() > 0}` from `@modules/notifications`. This module does not edit them.
* "Marcar como leídas" is hidden when nothing is unread, and the counter is hidden when the inbox is empty.
* `IconTile` size 40 draws a 19 px icon (M0's mapping). The design draws 16 px. Left as M0 defined it.

## Next step

Run the app on a phone to take the light and dark screenshots, then push the stack and open the pull requests. After that, `feature/local-scheduled-notifications` (step 2).
