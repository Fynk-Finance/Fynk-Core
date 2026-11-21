# ADR 0004: Audit Trail Retention Periods (Consent vs Operational Events)

* Status: proposed
* Date: 2026-10-28
* Owner: M13 Compliance, privacy and audit (Juan Pablo Contreras / `@juancontrerasp`)
* Jira: SCRUM-41 (HU-027)

---

## 1. Context

Fynk operates in Colombia under **Ley 1581 de 2012** (General Data Protection / Habeas Data), **Decreto 1377 de 2013**, and Superintendencia Financiera de Colombia (**SFC**) regulations on Open Finance (**Circular Externa 004 de 2024** and **Decreto 0368 de 2026**).

All access, consent grants, revocations, and financial account synchronization events must be recorded in an append-only, tamper-evident cryptographic hash chain (`audit.events`). The system must define clear retention windows balancing:
1. **Legal evidentiary obligations:** Demonstrating valid prior consent and customer authorizations under SIC (Superintendencia de Industria y Comercio) oversight and SFC guidelines.
2. **Data minimization:** Article 4(f) of Ley 1581 stipulates that personal data and associated records should not be held longer than necessary for the purposes of processing.
3. **Storage cost and verification performance:** Retaining indefinite audit logs increases verification overhead (`audit verify`) and database storage footprint.

---

## 2. Alternatives Considered

### Option A: Uniform Indefinite Retention
* Keep all audit events permanently.
* **Drawbacks:** Violates the principle of data minimization; creates unbounded database growth and increases verification duration over time.

### Option B: Uniform 5-Year Retention for All Events
* Retain every audit event for 5 years.
* **Drawbacks:** Unnecessarily inflates storage for ephemeral, high-frequency operational events (e.g. daily background bank syncs, recurring device checks).

### Option C: Differentiated Retention (Recommended)
* **5 Years for Consent & Privacy Events:** Events recording legal rights transitions (`consent.created`, `consent.granted`, `consent.revoked`, `consent.expired`, `privacy.deletion_requested`, `privacy.deletion_completed`).
* **1 Year for Operational Events:** High-volume operational and session events (`auth.login`, `auth.login_failed`, `auth.password_reset`, `device.registered`, `device.approved`, `device.rejected`, `device.removed`, `bank.sync`, `bank.sync_failed`, `bank.token_refreshed`, `backup.uploaded`, `backup.restored`, `recovery_key.set`).

---

## 3. Decision

We propose **Option C: Differentiated Retention**:

1. **Consent and Legal Rights Events (5 Years):**
   * *Events:* `consent.created`, `consent.granted`, `consent.revoked`, `consent.expired`, `privacy.deletion_requested`, `privacy.deletion_completed`.
   * *Rationale:* The general statute of limitations for contractual and commercial claims under Colombian Commercial Law (Código de Comercio Art. 822 and Código Civil Art. 2536) is 5 years. Retaining consent proofs for 5 years ensures full evidentiary defense against regulatory claims before the SIC and financial complaints before the SFC.

2. **Operational and Access Events (1 Year):**
   * *Events:* `auth.*`, `device.*`, `bank.sync*`, `backup.*`, `recovery_key.*`.
   * *Rationale:* Operational logs satisfy cybersecurity incident investigation windows and Superfinanciera IT risk management expectations without accumulating unbounded log volume.

---

## 4. Preservation of Hash Chain Integrity

Because `audit.events` is a cryptographically chained log (`prev_hash` -> `hash`), naive row pruning would invalidate the hash chain verification (`fynk-api audit verify`).

To prune rows older than their respective retention window without breaking chain continuity:
1. **Annual Epoch Archival:** At the end of each annual retention cycle, the verified state and head hash of the archived year are sealed and persisted to cold storage (Amazon S3 Glacier with Object Lock).
2. **Genesis Epoch Checkpoint:** The active table retains a root checkpoint event summarizing the historical head hash, enabling chain verification from that checkpoint forward.
3. **Initial Phase 1 Operation:** In Phase 1, all records remain active in `audit.events` as table volume grows; retention lifecycle policies and epoch checkpointing will be scheduled prior to production launch.

---

## 5. Team Confirmation & Next Steps

* [x] Draft proposed retention periods (5 years for consent, 1 year for operational).
* [ ] Team / Legal confirmation on Colombian statutory compliance.
* [ ] Schedule automated epoch archival job before production General Availability.
