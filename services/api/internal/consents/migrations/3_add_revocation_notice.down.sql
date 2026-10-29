DROP INDEX consents_notice_due_idx;
ALTER TABLE consents
  DROP CONSTRAINT consents_revoked_has_date,
  DROP COLUMN notify_attempts,
  DROP COLUMN next_notify_at,
  DROP COLUMN provider_notified_at;
