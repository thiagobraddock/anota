-- Remove automerge_state column (no longer used, using simple WebSocket sync)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'notes' AND column_name = 'automerge_state'
    ) THEN
        ALTER TABLE notes DROP COLUMN automerge_state;
    END IF;
END $$;
