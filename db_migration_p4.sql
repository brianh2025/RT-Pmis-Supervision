-- ============================================================
-- RT-PMIS 完整 DB Migration（P4）
-- 執行環境：Supabase SQL Editor
-- 建立日期：2026-03-29
-- 說明：建立尚未存在的資料表，並對 archive_docs 補充欄位
-- ============================================================

-- ── 確保 uuid 擴充存在 ──
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. mcs_submission 材料送審管制表
-- ============================================================
CREATE TABLE IF NOT EXISTS mcs_submission (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID        REFERENCES projects(id) ON DELETE CASCADE,
  no          TEXT,
  ci          TEXT,
  name        TEXT,
  qty         TEXT,
  test        TEXT,
  p_date      TEXT,
  a_date      TEXT,
  factory     TEXT,
  f_date      TEXT,
  vendor      TEXT,
  cat         TEXT,
  rpt         TEXT,
  smp         TEXT,
  other       TEXT,
  result      TEXT,
  r_date      TEXT,
  ver         TEXT        DEFAULT 'v1',
  ver_color   TEXT,
  sort_order  INTEGER     DEFAULT 0,
  remark      TEXT,
  created_by  UUID        REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. mcs_test 檢試驗管制表
-- ============================================================
CREATE TABLE IF NOT EXISTS mcs_test (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID        REFERENCES projects(id) ON DELETE CASCADE,
  no          TEXT,
  ci          TEXT,
  name        TEXT,
  p_date      TEXT,
  a_date      TEXT,
  qty         TEXT,
  s_date      TEXT,
  s_qty       TEXT,
  freq        TEXT,
  cum_qty     TEXT,
  cum_smp     TEXT,
  result      TEXT,
  personnel   TEXT,
  ver         TEXT        DEFAULT 'v1',
  ver_color   TEXT,
  sort_order  INTEGER     DEFAULT 0,
  remark      TEXT,
  created_by  UUID        REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. mcs_plan 施工計畫送審管制表
-- ============================================================
CREATE TABLE IF NOT EXISTS mcs_plan (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID        REFERENCES projects(id) ON DELETE CASCADE,
  no          TEXT,
  item        TEXT,
  deadline    TEXT,
  submit      TEXT,
  reject      TEXT,
  approve     TEXT,
  basis       TEXT,
  ver         TEXT        DEFAULT 'v1',
  ver_color   TEXT,
  sort_order  INTEGER     DEFAULT 0,
  remark      TEXT,
  created_by  UUID        REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. quality_issues 品管缺失
-- ============================================================
CREATE TABLE IF NOT EXISTS quality_issues (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       UUID        REFERENCES projects(id) ON DELETE CASCADE,
  inspection_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
  location         TEXT,
  item             TEXT        NOT NULL,
  severity         TEXT        DEFAULT 'major'
                               CHECK (severity IN ('critical','major','minor','observation')),
  description      TEXT,
  responsible      TEXT,
  deadline         DATE,
  status           TEXT        DEFAULT 'open'
                               CHECK (status IN ('open','in_progress','resolved','verified','waived')),
  resolve_date     DATE,
  remark           TEXT,
  created_by       UUID        REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. archive_docs 歸檔文件（含 P4 新欄位）
-- ============================================================
CREATE TABLE IF NOT EXISTS archive_docs (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id     UUID        REFERENCES projects(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL,
  category       TEXT        DEFAULT 'other',
  doc_no         TEXT,
  doc_date       DATE,
  sender         TEXT,
  receiver       TEXT,
  tags           TEXT[],
  file_url       TEXT,
  version        TEXT        DEFAULT 'v1',
  submission_id  UUID,
  source_table   TEXT,
  remark         TEXT,
  created_by     UUID        REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 若 archive_docs 已存在，補充缺少的欄位
ALTER TABLE archive_docs ADD COLUMN IF NOT EXISTS version       TEXT    DEFAULT 'v1';
ALTER TABLE archive_docs ADD COLUMN IF NOT EXISTS submission_id UUID;
ALTER TABLE archive_docs ADD COLUMN IF NOT EXISTS source_table  TEXT;
-- tags 欄位型別升級（若為 TEXT 改為 TEXT[]，需手動確認）
-- ALTER TABLE archive_docs ALTER COLUMN tags TYPE TEXT[] USING string_to_array(tags, ',');

-- ============================================================
-- 6. material_entries 材料進場紀錄（新表）
-- ============================================================
CREATE TABLE IF NOT EXISTS material_entries (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID        REFERENCES projects(id) ON DELETE CASCADE,
  entry_date  DATE,
  name        TEXT,
  spec        TEXT,
  qty         TEXT,
  vendor      TEXT,
  inspector   TEXT,
  remark      TEXT,
  created_by  UUID        REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. construction_inspections 施工檢驗管制（新表）
-- ============================================================
CREATE TABLE IF NOT EXISTS construction_inspections (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID        REFERENCES projects(id) ON DELETE CASCADE,
  inspect_date  DATE,
  work_item     TEXT,
  location      TEXT,
  inspect_type  TEXT,
  inspector     TEXT,
  result        TEXT        CHECK (result IN ('合格','不合格','待複驗')),
  remark        TEXT,
  created_by    UUID        REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. RLS（Row Level Security）
-- ============================================================
DO $$ BEGIN
  -- mcs_submission
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mcs_submission' AND policyname='mcs_sub_all') THEN
    ALTER TABLE mcs_submission ENABLE ROW LEVEL SECURITY;
    CREATE POLICY mcs_sub_all ON mcs_submission TO authenticated USING (true) WITH CHECK (true);
  END IF;
  -- mcs_test
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mcs_test' AND policyname='mcs_tst_all') THEN
    ALTER TABLE mcs_test ENABLE ROW LEVEL SECURITY;
    CREATE POLICY mcs_tst_all ON mcs_test TO authenticated USING (true) WITH CHECK (true);
  END IF;
  -- mcs_plan
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mcs_plan' AND policyname='mcs_pln_all') THEN
    ALTER TABLE mcs_plan ENABLE ROW LEVEL SECURITY;
    CREATE POLICY mcs_pln_all ON mcs_plan TO authenticated USING (true) WITH CHECK (true);
  END IF;
  -- quality_issues
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quality_issues' AND policyname='qi_all') THEN
    ALTER TABLE quality_issues ENABLE ROW LEVEL SECURITY;
    CREATE POLICY qi_all ON quality_issues TO authenticated USING (true) WITH CHECK (true);
  END IF;
  -- archive_docs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='archive_docs' AND policyname='arc_all') THEN
    ALTER TABLE archive_docs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY arc_all ON archive_docs TO authenticated USING (true) WITH CHECK (true);
  END IF;
  -- material_entries
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='material_entries' AND policyname='me_all') THEN
    ALTER TABLE material_entries ENABLE ROW LEVEL SECURITY;
    CREATE POLICY me_all ON material_entries TO authenticated USING (true) WITH CHECK (true);
  END IF;
  -- construction_inspections
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='construction_inspections' AND policyname='ci_all') THEN
    ALTER TABLE construction_inspections ENABLE ROW LEVEL SECURITY;
    CREATE POLICY ci_all ON construction_inspections TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
