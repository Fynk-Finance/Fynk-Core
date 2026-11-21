---
date: 2026-10-30
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-44]
branch: feature/bank-kms-keys
tool: Claude Code
pr: none
status: done
---

# The KMS client assertion signer and token fingerprint

## Instruction

The developer asked to start step D: "Start with D, but for this part, use a different stack if possible so that we don't have a stack of more than 10 PRs". First layer of a new stack from `develop`: the KMS signer and fingerprint behind the interfaces M5 already has.

## What was done

* `internal/bank/keys/kms.go`:
  * a small `KMS` interface (`SignDigest`, `GenerateMac`);
  * `KMSSigner`: builds the same claims as the local signer, sends KMS only the SHA-256 digest of `header.payload` (RSASSA_PSS_SHA_256), and appends the signature;
  * `KMSFingerprinter`: KMS `GenerateMac` with an HMAC_256 key; its errors never contain the token.
* `signer.go`: the claims (iss, sub, aud, random jti, exp 60 s) move to `assertionClaims`, shared by both signers. `LocalSigner` behaves the same.
* `kms_test.go`: a fake KMS with local keys (PSS with the salt equal to the hash, as KMS does, and HMAC-SHA-256). It checks:
  * the assertion verifies as PS256 with the public key of an RSA 3072 key (M14's spec);
  * KMS gets only the digest of the signing input, with the right key id;
  * every jti differs;
  * missing values are refused and KMS errors come through;
  * the fingerprint equals HMAC-SHA-256 of the token;
  * no error contains the token.

## Result

* Tests: `go test ./internal/bank/...` passes. gofmt, go vet and golangci-lint (0 issues) pass.
* Pull request: not opened yet. About 260 lines.
* Not used yet: the AWS SDK adapter and the settings come in the next layers, and they need the developer's OK (`go.mod` and `platform/config` are M0's).

## Decisions and problems

* **A new stack,** as the developer asked, so stack #188 stays at 9 PRs.
* **No `kid` header,** as with the local signer. If Banco Demo or a real bank needs one to find Fynk's key, it's one line in `assertionClaims`' caller.
* **Switching to KMS changes every fingerprint,** because the KMS HMAC key isn't the local file key. Links made with the local key won't refresh under KMS. Staging has no links yet (no bank settings), so nothing breaks there.

## Next step

Ask the developer to approve `chore/add-aws-kms-sdk` (`go.mod`) and the KMS settings in `platform/config`, both reviewed by Sofia.
