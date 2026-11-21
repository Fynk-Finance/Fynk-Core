---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-5, SCRUM-9]
branch: feature/keycloak-email-codes-and-theme
tool: Claude Code
pr: "#70"
status: done
---

# Bring the Keycloak stack into develop and close a cooldown leak in the recovery

## Instruction

The developer asked to "stack my PRs so is easier to merge with develop", then merged the Keycloak stack (#49 to #69) and asked "was it correctly merged?". Later: "the PR 70# doesnt pass CI".

## What was done

* **Stacking.** Claude Code put every open M1 PR on the latest `develop` in two lines with one merge order each, wrote that order at the top of every PR, and opened #69 (the theme in the Keycloak image) on top of the Keycloak line. It rebased everything twice, because `develop` moved twice while it worked.
* **The merge left most of the stack outside `develop`.** The stack was merged from the bottom up, so only #49 reached `develop`. #50 to #69 were squashed into the branch of the PR below them.
  * This branch puts the same 18 commits on top of `develop`.
  * The tree is byte for byte the tree of #69's branch, and #49's squash in `develop` matches #49's branch exactly.
* **Cooldown leak, found by CI on #70** (`TestIntegrationUnknownEmailLooksTheSameInTheReset`). For an email with an account, the recovery code page could say 59 seconds before a new code, while for an unknown email it always said 60.
  * The real path sends the email before the page counts the seconds left, and the decoy sends nothing.
  * On CI's slower mail server, the email took long enough to cross a second boundary.
  * `ResetCredentialWithCode` now shows the full cooldown on the page that started it, the same for both.

## Result

* `make test-keycloak` passes locally with the fix.
* #70 is open into `develop`, to be merged with "Rebase and merge" so each original change keeps its own commit.

## Decisions and problems

* **Why a new PR instead of reopening the old ones.** The old PRs are closed as merged, and their branches already hold the squashes. A single branch with the reviewed commits is the shortest way to `develop` with nothing changed.
* **One by one is still the right way for the backend stack**, but after each merge the next PR has to be pointed at `develop` and rebased before it is merged. Otherwise it lands in the branch below it, as happened here.
* **Still open: response time.** The real path sends an email and the decoy doesn't, so a real account's recovery page can take a little longer to answer. Keycloak's own link flow has the same property. Sending the email off the request thread would close it. Not done here.

## Next step

* Merge #70. Then the backend stack, one PR at a time. #58 gets the small change that moves its admin test to the theme's form helpers.
