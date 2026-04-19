-- Bug #5: 補充 archive_docs 歸檔欄位（submission_id, source_table）
ALTER TABLE archive_docs ADD COLUMN IF NOT EXISTS submission_id uuid;
ALTER TABLE archive_docs ADD COLUMN IF NOT EXISTS source_table text;
