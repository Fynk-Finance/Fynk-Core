---
date: 2026-11-06
developer: Daniel Palacios
github: Komi-yes
module: M16
jira: [SCRUM-73]
branch: feature/simulated-banks-entity-oauth
tool: Claude Code
pr: none
status: done
---

# Banco Demo: PAR per entity and opaque tokens

## Instruction

Second of the three layers of step 4 of the simulated banks plan (store, oauth, api). Daniel's instruction was "continue" to step 4.

## What was done

* `internal/oauth`: PAR requires `entity`, one of the four provider ids. Otherwise it answers 400 `invalid_request`. It keeps the optional `nonce` and `fynk_consent_id` and creates a pending consent with no customer.
* `CompleteAuthorization` activates the consent through `store.ActivateConsent`. A customer with no products at the entity gets `ErrNoProductsAtEntity`, and the consent stays pending.
* Tokens are opaque (`at-`, `rt-` and `cc-` plus 32 hex) and registered in the store with their consent and client. The consent id is no longer part of the token.
* Refresh looks up the refresh token. An unknown or expired token, or one whose consent is no longer active, gets `invalid_grant`.
* Revoke looks up the token. An unknown token is a 200 that revokes nothing (RFC 7009), with no fallback to the demo consent.
* Tests in `internal/oauth/entity_test.go`. In `oauth_test.go`, the PAR calls now send `entity=banco-demo` and the revoke step sends the access token instead of the consent id.

## Result

* `go test ./...`, `go vet ./...` and `gofmt -l .` in `services/bank-simulator` pass on this commit alone.
* Pull request: see the stack.

## Decisions and problems

Bugs fixed:

* PAR bound every consent to the demo customer and made it active at once.
* Tokens looked like `at-consent-<hex>-tok-<hex>`. Revoke and refresh split them on `-` and took `consent` as the consent id, so they acted on the wrong consent.

Not yet fixed: the Open Finance API still reads any bearer token as the demo consent. The api slice above this one fixes that. The Fynk API adapter does not send `entity` yet, so its integration test against a running simulator fails at PAR until step 6.

## Next step

The api slice: look tokens up on every Open Finance call.
