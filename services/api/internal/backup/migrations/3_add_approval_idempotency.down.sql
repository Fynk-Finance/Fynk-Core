DROP INDEX backup.device_approvals_idempotency_idx;
ALTER TABLE backup.device_approvals DROP COLUMN idempotency_key;
