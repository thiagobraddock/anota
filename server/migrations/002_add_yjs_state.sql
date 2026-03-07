-- Add yjs_state column for Y.js binary state persistence
-- This stores the collaborative editing state as binary data

ALTER TABLE notes ADD COLUMN IF NOT EXISTS yjs_state BYTEA;
