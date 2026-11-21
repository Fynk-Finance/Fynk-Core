DROP TRIGGER IF EXISTS trg_prevent_event_truncate ON events;
DROP TRIGGER IF EXISTS trg_prevent_event_modification ON events;
DROP FUNCTION IF EXISTS prevent_event_modification();
DROP TABLE IF EXISTS events;
