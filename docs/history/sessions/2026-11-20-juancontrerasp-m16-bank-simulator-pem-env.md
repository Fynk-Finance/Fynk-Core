# 2026-11-20 — Bank Simulator: Accept TLS/CA PEMs from Environment (M16)

## Context
In AWS ECS, Secrets Manager injects secret values as environment variables containing raw PEM text rather than mounted files, and the `bank-simulator` distroless container has no shell to materialize files in an entrypoint. Because `BANK_TLS_CERT`, `BANK_TLS_KEY`, and `BANK_CLIENT_CA` only accepted file paths, `bank-simulator` fell back to `BANK_DEV_MODE=1` and disabled its internal `:9443` mTLS listener.

## Changes
- `services/bank-simulator/cmd/bank-simulator/main.go`:
  - Added `CertPEM`, `KeyPEM`, `ClientCAPEM` config fields mapped from `BANK_TLS_CERT_PEM`, `BANK_TLS_KEY_PEM`, and `BANK_CLIENT_CA_PEM`.
  - Added `pemToFile` and `resolveTLSFiles` to validate that path and `_PEM` env vars are not both set, write any `_PEM` inputs to `0600` temporary files before `run()` checks mTLS config, and clean them up on shutdown.
- `services/bank-simulator/cmd/bank-simulator/main_test.go`:
  - Added unit tests covering `0600` temp file materialization and cleanup, rejecting simultaneous path + `_PEM`, preserving `BANK_DEV_MODE=1`, and failing startup on invalid `BANK_CLIENT_CA_PEM`.

## Verification
- `cd services/bank-simulator && go test -race ./...`
- `node --test scripts/*.test.mjs`
