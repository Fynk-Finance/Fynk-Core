# Project history

This folder records how Fynk was built: what each developer asked in each session, what came out of it, and what was decided. It is the source for the project history we present to the jury.

## How it works

1. Every work session (Claude Code, claude.ai or by hand) adds one file to `sessions/`, copied from `_template.md`.
2. The file name is `<YYYY-MM-DD>-<github-user>-<module>-<short-topic>.md`, so two developers never edit the same file.
3. The file goes in the same branch and pull request as the work, in its own commit: `docs(<module>): SCRUM-NN add session log`.
4. CI fails a pull request that changes code and adds no session file.
5. To build the full history, run `make history` (or `node scripts/build-history.mjs`). It writes `PROJECT_HISTORY.md` with:
   * a summary table with sessions per module and per developer
   * a timeline of every session by date
   * the sessions of each module
   * the sessions of each developer

`PROJECT_HISTORY.md` is generated, so do not edit it by hand. Regenerate it before each gate and commit it in the `release/gate-x` branch.

## What a good record looks like

* The instruction is faithful: quote the key sentence the developer wrote.
* The result is honest: failing tests and unfinished parts are written down, not hidden.
* Decisions say why, in one line.
* No secrets, tokens, passwords, personal data of real people or amounts from real accounts.

## Fixing a record

A wrong record is corrected in a new commit. Records are never deleted, so the history stays honest.
