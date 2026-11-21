---
date: 2026-11-15
developer: Daniel Palacios
github: Komi-yes
module: M12
jira: [SCRUM-70]
branch: fix/notifications-permission-prompt-and-due-reminder
tool: Claude Code
pr: "#388"
status: done
---

# The permission explanation shows once per run, and a fired reminder is not lost on reschedule

## Instruction

After the code analysis of the whole repository, Daniel asked to "fix the bugs with the simple fixes" in the other modules too, and to "push that fixes with their PRs" so each owner reviews them. These are BUG-18 and BUG-19 of that analysis, in Karol's module.

## What was done

* `modules/notifications/application/notificationService.ts`:
  * `scheduleOs` keeps the answer of `askPermission()` for the app run, so the explanation is shown once.
  * `schedule()` delivers a due row of the same id to the inbox before it stores a different time.
* Tests: `shows the explanation once per app run when the person answers "Más tarde"` (`localScheduling.test.ts`), `keeps a reminder that already fired when the same id is scheduled for a later time` and `does not deliver twice a past reminder scheduled again for the same time` (`notificationService.test.ts`). The first two were run before the change and failed.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,881 tests, Go and script tests).
* Pull request: #388.
* After "Más tarde" the other reminders of that run are stored without a new dialog and still reach the inbox. A reminder that fired while the app was closed reaches the inbox even when its id is rescheduled first.

## Decisions and problems

* The answer is kept in memory, not in the vault. So the explanation comes back at the next app start. Waiting some days needs a stored preference, which is Karol's decision.
* The old test for "no" used a fake that sets the permission to denied. The real adapter leaves it undecided after "Más tarde", so the new test overrides the fake for that case.
* The change is in another person's module. Karol reviews it as CODEOWNER.

## Next step

Karol reviews the pull request and decides when the explanation may come back.
