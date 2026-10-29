---
date: 2026-10-28
developer: Karol
github: Karol2905
module: M12
jira: [SCRUM-70]
branch: feature/notifications-inbox-rules
tool: Claude Code
pr: none
status: done
---

# Inbox rules of Notificaciones (first branch of the M12 stack)

## Instruction

Karol started her modules (M8, M9 and M12) and agreed to begin with M12, step 1 of its work plan, because M8, M9, M10 and M11 notify through it. Key sentence: "si" to "start with `feature/notifications-port-and-inbox` for SCRUM-70".

## What was done

* Step 1 of the work plan was about 850 lines of code plus tests, over the 400 line limit, so it was split into a stack of three branches: `feature/notifications-inbox-rules` (this one), `feature/notifications-port-and-inbox` and `feature/notifications-inbox-screen`.
* `modules/notifications/domain/inbox.ts`: pure rules. `groupInbox` splits rows into Hoy, Esta semana (the 6 days before today) and Antes by calendar day in Bogotá (UTC-5, no daylight saving), newest first. `timeLabel` gives "9:12" today, "Lun" this week and "28 sep" before. `unreadCount`. `idsOverLimit` keeps 200 rows and deletes the oldest read ones first.
* `domain/kinds.ts`: icon and tile per kind. Lime for payments and recommendations, light blue for income, goals, sync and subscriptions, as the design says. `device_approval` can never be turned off.
* `domain/inbox.test.ts`: 15 tests with the six rows of the design (9:12, 8:05, 7:30, Lun, Dom, Sáb, 3 unread), the Bogotá midnight edges and the limit.

## Result

* Tests: 15 pass. ESLint, `tsc` and Prettier are clean on the module.
* Pull request: not opened. This session cannot push to `Fynk-Finance/fynk-core` because the Claude GitHub App is not installed in the organization.

## Decisions and problems

* "Esta semana" means the 6 calendar days before today, which reproduces the design (Lun, Dom, Sáb on a Wednesday).
* Caps and new devices are not in the design: they use the light blue tile with the warning and shield icons. Needs design review.
* The recommendation icon reuses the light bulb of the Recomendaciones tab (`tabRecommendations`), which is the same path as in the design.

## Next step

Push the stack and open the three pull requests with `gh stack`, bottom first.
