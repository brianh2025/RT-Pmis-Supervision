import { supabase } from '../lib/supabaseClient';

/* 由施工抽查記錄建立缺失改善單（quality_issues），並以 source_table/source_record_id 回連原查驗記錄。
   原本在 Quality.jsx（addInspection／cycleInspResult／saveQuickInsp）與 InspectionQuickModal.jsx
   各自重複實作一份幾乎相同的 insert 邏輯，統一抽出避免行為各自漂移。 */
export function useQualityIssueCreator() {
  async function createIssueFromInspection({
    projectId, userId, sourceRecordId,
    inspectionDate, location, item, description,
    severity = 'major', status = 'open', resolveDate, remark,
  }) {
    if (!supabase) return null;
    const payload = {
      project_id: projectId, created_by: userId,
      inspection_date: inspectionDate, location: location || null, item,
      severity, status,
      source_table: 'construction_inspections', source_record_id: sourceRecordId,
    };
    if (description !== undefined) payload.description = description;
    if (resolveDate) payload.resolve_date = resolveDate;
    if (remark) payload.remark = remark;
    const { data, error } = await supabase.from('quality_issues').insert([payload]).select().single();
    if (error) { console.error('建立缺失改善單失敗:', error); return null; }
    return data;
  }
  return { createIssueFromInspection };
}
