---
date: 2026-11-09
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-86]
branch: feature/category-dropdown
tool: Claude Code
pr: "#359"
status: done
---

# Dropdown: flaky catalog snapshot fixed (QA review V11)

## Instruction

"mobile and ci fails for pr #359"

## What was done

* The Mobile job failed now and then on `design system catalog › Dropdown / Category matches its dark snapshot`. Run alone, the catalog test failed about 1 run in 3.
* Cause: the chevron put `withTiming(...)` straight inside `useAnimatedStyle`. Even with Reduce Motion (duration 0), the snapshot sometimes caught the animation object instead of `"0deg"`.
* `shared/ui/components/Dropdown.tsx`: the chevron now turns a shared value set in an effect, which jumps straight to its end under Reduce Motion, the same as the `Fab`. The style is always a plain `"<n>deg"` string.

## Result

* The saved snapshots did not change. The catalog test passed 15 runs out of 15.
* Typecheck, ESLint, Prettier and the `shared/ui` tests pass (333 of 333).

## Decisions and problems

* The latest CI run of #359 had passed by chance; the fix removes the timing instead of retrying the test.

## Next step

Watch CI on #359 and #360.
