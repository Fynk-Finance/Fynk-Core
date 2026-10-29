---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: team
jira: [SCRUM-68]
branch: docs/stacked-prs-with-gh-stack
tool: Claude Code
pr: none
status: done
---

# Use GitHub's stacked pull requests for dependent work

## Instruction

While M1 was being finished, Daniel asked: "why dont you do the stacks with this https://docs.github.com/en/pull-requests/how-tos/stacked-pull-requests". After the M1 stacks merged, he asked to "tell to claude.md to do the stack of PRs with the github stack tool".

## What was done

* **In practice:** M1's dependent pull requests became two GitHub stacks with the `gh stack` extension.
  * #81: #74 → #76 → #75 → #79 → #83 → #84.
  * #82: #77 → #78.

  Both merged bottom-up into `develop`.
* **`CLAUDE.md` › Pull requests:** a rule that dependent work goes in a stack, with how a stack is targeted, reviewed and merged, and its limits.
* **`CLAUDE.md` › Steps Claude Code follows:** the `gh stack` commands to start, rebase, submit and link a stack. The never-list now names `gh stack merge` next to `gh pr merge`.
* **`CLAUDE.md` › Decisions taken:** a "Stacked pull requests (28 Oct)" row.
* **`.claude/settings.json`:** `gh stack merge` is denied like `gh pr merge`, so Claude Code still can't merge.

## Result

* `make format-check` passes.
* With the stacks, the PRs above were rebased and retargeted by GitHub after each merge. Before that, "depends on #N" pull requests on `develop` needed a manual rebase, and one failed CI because it lacked a fix from the pull request below it.

## Decisions and problems

* **No reordering of independent work into one stack.** A stack is linear, and a pull request cannot merge before the ones under it.
* **This changes shared files owned by M0** (`CLAUDE.md`, `.claude/settings.json`), so Sofia reviews it.

## Next step

Every module uses `gh stack` for its dependent pull requests.
