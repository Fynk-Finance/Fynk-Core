---
date: 2026-11-05
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23]
branch: docs/bancolombia-sandbox-mtls-finding
tool: Claude Code
pr: "#292"
status: done
---

# Record what the first Bancolombia sandbox test found (ADR 0003, findings 7 to 9)

## Instruction

After all M4/M5 pull requests were merged, Juan Carlos asked to "check what's in develop right now and tell me how to proceed", then set up Fynk's application in Bancolombia's API Market sandbox and ran the sandbox tests. With the results he approved fixing the adapter and adding the new findings to ADR 0003: "Yes, do it".

## What was done

* Checked `develop`: all M4/M5 work is merged; Go, Postgres integration, `tsc`, Jest and lint pass. Deploy Staging fails because the `AWS_ACCOUNT_ID` secret is missing (M14).
* Guided the creation of the application "Fynk" in the sandbox portal. It was created without a product and without a certificate; the portal refuses `fynk://bank/callback` as redirect URL and does not let a certificate be added afterwards.
* Probed the resource server with `curl` and `openssl s_client`: with no client certificate it answers `401 invalid_client` (mTLS not established); a self-signed one is refused; the handshake only accepts the "Ozone Unsecured Certificates" NON-PROD CAs.
* `docs/adr/0003-bancolombia-sandbox.md`: findings 7 (sandbox mTLS with Ozone's test CA), 8 (Open Finance products missing from the access package), 9 (redirect must be `http(s)://`), the first sandbox test result, the certificate settings of the sandbox test, and the pending step at Bancolombia.

## Result

* Sandbox test with Fynk's credentials: discovery passes; accounts, transactions and revoked consent get `401 invalid_client`.
* Pull request: #292.

## Decisions and problems

* The certificate cannot be made by Fynk: only Bancolombia can issue one from its test CA. A support request was drafted asking for the certificate, the Open Finance products and a way to attach the certificate.
* The `https://` return link (finding 9) needs a domain and changes in M0's `linking.ts`; left to the team.

## Next step

When Bancolombia answers, put the certificate in `certs/` and run the sandbox tests with `BANCOLOMBIA_SANDBOX_CERT_FILE` and `BANCOLOMBIA_SANDBOX_KEY_FILE`.
