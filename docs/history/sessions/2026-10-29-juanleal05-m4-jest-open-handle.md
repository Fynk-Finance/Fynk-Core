---
date: 2026-10-29
developer: Juan Carlos Leal
github: JuanLeal05
module: M4
jira: [SCRUM-21]
branch: fix/consents-jest-open-handle
tool: Claude Code
pr: none
status: done
---

# Let Jest exit after M4's tests

## Instruction

Part of step A that the developer approved ("let's start with A which is quick"). The handoff said Jest prints "a worker process has failed to exit gracefully" on M4 and M5's suites, and asked to "check whether one of our suites leaks a timer".

## What was done

* Ran each of the 13 M4 and M5 suites alone with `--detectOpenHandles` and a 90 second limit. Twelve exit in 0 to 2 seconds. `consents/application/useConsents.test.tsx` passes but never exits.
* Cause: its test `QueryClient` sets `gcTime: Infinity` only for mutations. After the hooks unmount, each query starts React Query's default 5 minute cleanup timer, which keeps the process alive.
* Fix: `gcTime: Infinity` for queries too, as the other M4 and M5 suites already do. Test code only.

## Result

* Tests: the suite exits in about 1 second. M4 and M5 together: 13 suites, 130 tests pass, and the worker warning is gone.
* Pull request: not opened yet.

## Decisions and problems

* **Only our suite was checked.** Other modules' suites may have the same pattern. That's for their owners to check, not for us to change.

## Next step

Open the pull request. Then step B, M5 step 3.
