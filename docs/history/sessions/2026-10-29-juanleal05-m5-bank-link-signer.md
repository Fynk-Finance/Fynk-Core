---
date: 2026-10-29
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-44]
branch: feature/bank-link-signer
tool: Claude Code
pr: none
status: done
---

# PS256 client assertion signer and refresh token fingerprint (M5 step 2, part 2)

## Instruction

Same session as `2026-10-29-juanleal05-m5-bank-link-settings.md`. Key sentence: "Then let's continue with M5 step 2 as better as possible."

## What was done

* `internal/bank/keys`:
  * `LocalSigner`: the `private_key_jwt` assertion, PS256, with iss and sub the client id, aud the bank, a random jti and exp 60 s. Reads PKCS #1 or PKCS #8 PEM and refuses keys under 2048 bits.
  * `LocalHMAC`: the HMAC-SHA-256 fingerprint of a refresh token, with a key of at least 32 bytes; `Matches` compares in constant time.
  * Both sit behind the interfaces the KMS keys will use in AWS.
* Tests: claims and lifetime, a new jti every time, not accepted as RS256 or HS256, weak keys, both PEM formats, fingerprints per token and per key.

## Result

* Tests: `make lint` and `make test` pass on the whole stack. The Postgres and Redis tests pass against Postgres 16 and Redis 7 in Docker.
* Pull request: not opened yet.

## Decisions and problems

* **`golang-jwt/jwt/v5` was already a dependency,** so no library was added.
* **The first commit had the signer and the links table together (about 830 lines).** It was split in two before pushing. Renaming the branch broke `gh stack`'s local record, which was fixed by renaming the entry in `.git/gh-stack` (a backup was kept).

## Next step

`feature/bank-links-table`.
