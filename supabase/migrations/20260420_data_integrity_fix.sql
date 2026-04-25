-- ============================================================
-- RT-PMIS 資料黑洞修復 — Schema Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. daily_logs: 補齊進度欄位
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS planned_progress NUMERIC;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS actual_progress NUMERIC;

-- 2. daily_logs: 新增 form_data JSONB 欄位
--    儲存表單額外資料（天氣溫度、文件紀錄、抽查、品質試驗等），避免新增大量獨立欄位
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT '{}'::jsonb;

-- 3. projects: 補齊 drive_folder_id 欄位與狀態約束
ALTER TABLE projects ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('pending', 'active', 'completed', 'accepted', 'suspended'));

-- 4. 確保 daily_logs 的 project_id + log_date 唯一（upsert 需要）
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_logs_project_id_log_date_key'
  ) THEN
    ALTER TABLE daily_logs ADD CONSTRAINT daily_logs_project_id_log_date_key UNIQUE (project_id, log_date);
  END IF;
END $$;
