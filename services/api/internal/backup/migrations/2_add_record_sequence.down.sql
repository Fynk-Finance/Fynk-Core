DROP INDEX IF EXISTS backup.records_seq_idx;
ALTER TABLE backup.records DROP COLUMN IF EXISTS seq;
DROP SEQUENCE IF EXISTS backup.records_seq;
