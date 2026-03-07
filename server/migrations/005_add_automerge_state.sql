-- Adiciona coluna automerge_state para persistir estado da colaboração
ALTER TABLE notes ADD COLUMN IF NOT EXISTS automerge_state BYTEA;
