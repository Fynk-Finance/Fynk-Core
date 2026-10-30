---
date: 2026-10-30
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-44]
branch: feature/bank-kms-wiring
tool: Claude Code
pr: none
status: done
---

# Use the KMS keys for the bank link in AWS

## Instruction

Last layer of the KMS stack, approved by the developer: "Yes, do it and create the stack with the PRs, Sofia and Juan Pablo must be called to review either way". The SDK adapter, the KMS key settings in `platform/config` (M0, Sofia reviews) and the choice of key in the bank wiring.

## What was done

* `internal/platform/config` (M0): two optional settings, `BANK_SIGNER_KMS_KEY_ID` and `BANK_FINGERPRINT_KMS_KEY_ID` (id, ARN or alias). Nothing is required, so every environment keeps starting. One test reads them and the "link off" test checks they default to empty.
* `internal/bank/keys/kmsclient.go`: `AWSKMS` over the SDK, `Sign` with `MessageType DIGEST` and `RSASSA_PSS_SHA_256`, and `GenerateMac` with `HMAC_SHA_256`. An empty answer is an error.
* `internal/bank/wiring.go`: `bankKeys` takes each key from KMS when its id is set, else from its file. The AWS client is built once, from the default chain (`AWS_REGION`, the ECS task role). With neither source, or if the AWS client can't load, the link stays off and the revoker stays unavailable, as before.
* Tests:
  * the adapter against a fake KMS endpoint: checks the `X-Amz-Target` operation and the JSON fields (key id, `DIGEST`, `RSASSA_PSS_SHA_256`, `HMAC_SHA_256`, base64 message), errors, and empty answers;
  * the wiring: KMS ids alone build the providers with the KMS fingerprinter and one client; local files never load AWS; an AWS client that can't load keeps the link off.

## Result

* Tests: `go test ./...` in `services/api` passes. gofmt, go vet and golangci-lint (0 issues) pass.
* Pull request: not opened yet. About 300 lines.
* Never run against a real KMS: that needs the staging keys and the task role (M14).

## Decisions and problems

* **Each key chooses on its own,** so staging can move one key at a time. In practice both are set together.
* **No region setting of our own:** `AWS_REGION` is set in ECS. M11 has its own region variable for Bedrock; the KMS keys live in the API's region.
* **For Juan Pablo (M14):**
  * the ECS task needs `BANK_SIGNER_KMS_KEY_ID` and `BANK_FINGERPRINT_KMS_KEY_ID` from the KMS module's outputs;
  * the task role needs `kms:Sign` on the signer key and `kms:GenerateMac` on the fingerprint key;
  * Banco Demo needs the public key of the KMS signer (`kms:GetPublicKey`) to verify the assertions.
* **`.env.example` is unchanged:** local development keeps the key files.

## Next step

Push the stack and the mTLS test, with Sofia and Juan Pablo as reviewers.
