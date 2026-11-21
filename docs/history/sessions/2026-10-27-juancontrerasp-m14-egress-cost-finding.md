---
date: 2026-10-27
developer: Juan Pablo Contreras
github: juancontrerasp
module: M14
jira: [SCRUM-46, SCRUM-48]
branch: docs/egress-cost-finding
tool: Claude Code
pr: none
status: done
---

# M14 Step 7: ADR 0005 Egress Architecture and Cost Analysis

## Instruction

Juan Pablo Contreras requested to execute all steps of Module M14 (AWS Staging Infrastructure): "Please do the module m14 all the steps please."

## What was done

* Created branch `docs/egress-cost-finding` based on `infra/deploy-pipeline`.
* Authored `docs/adr/0005-egress.md`:
  * Detailed architectural cost analysis comparing the confirmed design (7 Interface Endpoints in 1 AZ at ~$58.65/mo) against a single AWS NAT Gateway (~$36.95/mo).
  * Documented the trade-off finding: while a NAT Gateway saves ~$21.70/mo in staging, the confirmed interface endpoint design completely eliminates default outbound internet routes from private subnets, delivering zero-egress network isolation for financial data protection and compliance evidence.
  * Formally presented the recommendation to keep the confirmed design for staging and jury demo while logging the finding for team review.

## Result

* ADR 0005 documented in `docs/adr/0005-egress.md`.
* Module M14 complete across all 7 planned steps.

## Decisions and problems

* Respected the project rule: "Do not change confirmed architecture on your own; write findings into ADR 0005 and document for the team."

## Next step

Module M14 is fully implemented across all 7 steps. Next module in backlog: M13 Compliance & Audit.
