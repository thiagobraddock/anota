-- Remove yjs_state column from notes table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notes' AND column_name = 'yjs_state'
    ) THEN
        ALTER TABLE notes DROP COLUMN yjs_state;
    END IF;
END $$;
