-- ============================================================
-- PMIS 雲端工程監造管理系統 — Supabase 資料庫建置腳本
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上 → Run
-- ============================================================

-- 1. 建立「工程專案」資料表
CREATE TABLE IF NOT EXISTS projects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  location     text,
  contractor   text,
  status       text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'completed', 'suspended')),
  start_date   date,
  end_date     date,
  budget       numeric,          -- 單位：萬元（新台幣）
  created_at   timestamptz DEFAULT now(),
  created_by   uuid REFERENCES auth.users(id)
);

-- 2. 建立「工程進度記錄」資料表
CREATE TABLE IF NOT EXISTS progress_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  report_date       date NOT NULL DEFAULT CURRENT_DATE,
  planned_progress  numeric CHECK (planned_progress BETWEEN 0 AND 100),
  actual_progress   numeric CHECK (actual_progress BETWEEN 0 AND 100),
  notes             text,
  created_at        timestamptz DEFAULT now(),
  created_by        uuid REFERENCES auth.users(id)
);

-- 3. 啟用 Row Level Security（確保只有登入者可存取）
ALTER TABLE projects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_records ENABLE ROW LEVEL SECURITY;

-- 4. 建立 RLS 策略：已認證使用者可讀取所有資料
CREATE POLICY "auth_read_projects"
  ON projects FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_read_progress"
  ON progress_records FOR SELECT TO authenticated USING (true);

-- 5. 建立 RLS 策略：已認證使用者可新增資料（記錄建立者）
CREATE POLICY "auth_insert_projects"
  ON projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "auth_insert_progress"
  ON progress_records FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- ============================================================
-- 6. 插入範例工程資料（可依實際情況刪除或修改）
-- ============================================================
INSERT INTO projects (name, location, contractor, status, start_date, end_date, budget)
VALUES
  ('斗六市區道路改善工程', '斗六市中山路段', '大成營造有限公司', 'active', '2025-09-01', '2026-06-30', 3500),
  ('虎尾鎮排水整治工程',   '虎尾鎮光復路沿線', '中興土木工程公司', 'active', '2025-10-15', '2026-08-31', 5200),
  ('西螺大橋護欄更新工程', '西螺鎮西螺大橋全段', '合樂工程有限公司', 'active', '2025-11-01', '2026-05-31', 1800);

INSERT INTO progress_records (project_id, report_date, planned_progress, actual_progress, notes)
SELECT id, CURRENT_DATE, 55, 48, '混凝土澆置作業延誤，正加強趕工中'
FROM projects WHERE name = '斗六市區道路改善工程';

INSERT INTO progress_records (project_id, report_date, planned_progress, actual_progress, notes)
SELECT id, CURRENT_DATE, 40, 42, '施工進度超前，品質符合規範要求'
FROM projects WHERE name = '虎尾鎮排水整治工程';

INSERT INTO progress_records (project_id, report_date, planned_progress, actual_progress, notes)
SELECT id, CURRENT_DATE, 75, 70, '護欄材料到貨延遲，預計下週補足'
FROM projects WHERE name = '西螺大橋護欄更新工程';
