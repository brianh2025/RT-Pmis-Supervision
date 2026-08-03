-- 補記現況：construction_inspections.inspect_category、quality_issues.source_table/source_record_id
-- 這些欄位已存在於正式環境，但過去透過 Dashboard 手動加入，未曾寫入 migration，導致無法從本檔案重建正式環境 schema。
-- 本 migration 僅補登記現況，不變更現況。
-- RLS 現況為全開放（ci_all: USING(true) WITH CHECK(true)），本次不收斂，如需依 project/角色限制需另立任務處理。
ALTER TABLE construction_inspections
  ADD COLUMN IF NOT EXISTS inspect_category text DEFAULT '施工檢驗';

ALTER TABLE quality_issues
  ADD COLUMN IF NOT EXISTS source_table text,
  ADD COLUMN IF NOT EXISTS source_record_id uuid;
