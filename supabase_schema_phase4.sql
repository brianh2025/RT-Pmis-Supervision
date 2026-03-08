-- ============================================================
-- PMIS Phase 4 — 施工日誌 & 監造月報資料表
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上 → Run
-- ============================================================

-- Table 3: 每日施工記事
CREATE TABLE IF NOT EXISTS daily_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  log_date    date NOT NULL,
  weather_am  text,
  weather_pm  text,
  work_items  text,
  notes       text,
  created_at  timestamptz DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id),
  UNIQUE (project_id, log_date)
);

-- Table 4: 監造月報記錄
CREATE TABLE IF NOT EXISTS supervision_reports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  report_month     text NOT NULL,           -- ex: '2025-09'
  report_no        integer,                 -- 報表編號
  planned_progress numeric,                 -- 預定進度 %
  actual_progress  numeric,                 -- 實際進度 %
  submitted_at     timestamptz,             -- 提送時間 (null = 未提送)
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'submitted')),
  notes            text,
  created_at       timestamptz DEFAULT now(),
  UNIQUE (project_id, report_month)
);

-- Enable RLS
ALTER TABLE daily_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervision_reports  ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "auth_read_daily_logs"
  ON daily_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_daily_logs"
  ON daily_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "auth_read_reports"
  ON supervision_reports FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_reports"
  ON supervision_reports FOR INSERT TO authenticated USING (true);

CREATE POLICY "auth_update_reports"
  ON supervision_reports FOR UPDATE TO authenticated USING (true);
