-- seq is the paging cursor: timestamps are not safe across API instances. Every write of a
-- record takes a new value, under the user's advisory lock, so per user seq order is commit order.
CREATE SEQUENCE backup.records_seq;
ALTER TABLE backup.records ADD COLUMN seq bigint NOT NULL DEFAULT nextval('backup.records_seq');
CREATE INDEX records_seq_idx ON backup.records (user_id, seq);
