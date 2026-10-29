---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6]
branch: feature/identity-devices-and-profile
tool: Claude Code
pr: none
status: done
---

# Bring the backend stack into develop in one PR

## Instruction

After #70 put the Keycloak stack in `develop`, the developer asked: "wouldnt it be better to do a merge like #70 that is the entire stack instead of doing it one by one? and do the #58 change that you mention".

## What was done

* **One branch for the whole backend stack (#40 to #61).** The same 17 commits on top of today's `develop`. The changes are identical to the stack's, checked by comparing the two diffs.
* **The #58 change.** `admin_integration_test.go` takes the login and terms form URLs from `formAction` with page ids (`login.ftl`, `terms.ftl`). With the theme now in `develop`, the HTML carries the data model instead of the form.

## Result

* `make lint-go`, `go vet -tags integration`, `go test ./...`, `make lint-mobile`, `make test-mobile`, `make test-integration` (Postgres) and `make test-keycloak` pass on this branch.
* The PR is to be merged with "Rebase and merge". The eight original PRs get closed with a link to it once it merges.

## Decisions and problems

* **One PR instead of eight.** Merging the stacked PRs one at a time would have needed a rebase, a CI run and a new approval after each merge, because `develop` only takes up-to-date branches and an approval only counts after the last push. Each change was already reviewed in its own PR.
* **Juan Leal's #52, #53 and #57** edit some of the same M0 files. Both sides add settings, so whichever merges second keeps both. That is for the developer and the M0 owner to confirm when it happens.

## Next step

* Merge this PR, then close #40, #47, #48, #51, #58, #59, #60 and #61 as included.
* Continue M1 on the work Sofia's merges unblocked: the docs PR for the email codes, the identity screens in light and dark, then Mi cuenta and Seguridad.
