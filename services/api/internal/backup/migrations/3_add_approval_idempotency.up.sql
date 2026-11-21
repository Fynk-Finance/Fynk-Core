-- A retried POST /device-approvals with the same Idempotency-Key returns the first approval of that device.
-- NULLs never collide, so a request without a key is never deduplicated.
ALTER TABLE backup.device_approvals ADD COLUMN idempotency_key text;
CREATE UNIQUE INDEX device_approvals_idempotency_idx ON backup.device_approvals (new_device_id, idempotency_key);
