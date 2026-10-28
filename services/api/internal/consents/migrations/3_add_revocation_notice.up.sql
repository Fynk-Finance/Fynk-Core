-- Notice of a revocation to the entity (HU-008, "notificar al proveedor"). Fynk tries at once,
-- then every 10 minutes for 24 hours. Still consent metadata: no tokens, no financial data.
ALTER TABLE consents
  ADD COLUMN provider_notified_at timestamptz,
  ADD COLUMN next_notify_at       timestamptz,
  ADD COLUMN notify_attempts      int NOT NULL DEFAULT 0 CHECK (notify_attempts >= 0),
  ADD CONSTRAINT consents_revoked_has_date CHECK (status <> 'revoked' OR revoked_at IS NOT NULL);

CREATE INDEX consents_notice_due_idx ON consents (next_notify_at)
  WHERE status = 'revoked' AND provider_notified_at IS NULL;
