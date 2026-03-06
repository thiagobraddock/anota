-- Migração: Alterar default de access_mode para 'private'
-- Data: 2026-03-06
-- Observação: Esta migração apenas altera o default para novas notas.
-- Notas existentes mantêm seu access_mode atual.

ALTER TABLE notes ALTER COLUMN access_mode SET DEFAULT 'private';

-- Opcional: Se quiser tornar todas as notas existentes privadas, descomente:
-- UPDATE notes SET access_mode = 'private' WHERE access_mode = 'open';
