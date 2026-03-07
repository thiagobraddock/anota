-- Migration: Replace creator_token with owner_device_id for simpler ownership tracking
-- Each device has a unique ID, and that ID is stored when a note is created

-- Add owner_device_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notes' AND column_name = 'owner_device_id'
    ) THEN
        ALTER TABLE notes ADD COLUMN owner_device_id TEXT;
    END IF;
END $$;

-- Create index for faster lookups by device
CREATE INDEX IF NOT EXISTS idx_notes_owner_device ON notes(owner_device_id);

-- Migrate existing notes: if they have a creator_token, use it as the device_id temporarily
-- This allows existing owners to maintain ownership
UPDATE notes 
SET owner_device_id = creator_token::TEXT 
WHERE owner_device_id IS NULL AND creator_token IS NOT NULL;
