-- ============================================================
-- RT-PMIS P4 DB Migration
-- 執行環境：Supabase SQL Editor
-- 建立日期：2026-03-29
-- ============================================================

-- 1. archive_docs 加欄位（送審來源追蹤 + 版本號）
ALTER TABLE archive_docs
  ADD COLUMN IF NOT EXISTS version      VARCHAR  DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS submission_id UUID,
  ADD COLUMN IF NOT EXISTS source_table  VARCHAR;

-- 2. 材料進場紀錄表
CREATE TABLE IF NOT EXISTS material_entries (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID        REFERENCES projects(id) ON DELETE CASCADE,
  entry_date   DATE,
  name         TEXT,
  spec         TEXT,
  qty          TEXT,
  vendor       TEXT,
  inspector    TEXT,
  remark       TEXT,
  created_by   UUID,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE material_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "material_entries_select" ON material_entries FOR SELECT USING (true);
CREATE POLICY "material_entries_insert" ON material_entries FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "material_entries_update" ON material_entries FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "material_entries_delete" ON material_entries FOR DELETE USING (auth.uid() IS NOT NULL);

-- 3. 施工檢驗管制表
CREATE TABLE IF NOT EXISTS construction_inspections (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID        REFERENCES projects(id) ON DELETE CASCADE,
  inspect_date  DATE,
  work_item     TEXT,
  location      TEXT,
  inspect_type  TEXT,
  inspector     TEXT,
  result        TEXT        CHECK (result IN ('合格', '不合格', '待複驗')),
  remark        TEXT,
  created_by    UUID,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE construction_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ci_select" ON construction_inspections FOR SELECT USING (true);
CREATE POLICY "ci_insert" ON construction_inspections FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ci_update" ON construction_inspections FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "ci_delete" ON construction_inspections FOR DELETE USING (auth.uid() IS NOT NULL);
