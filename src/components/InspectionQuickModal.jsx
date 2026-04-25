import React, { useState } from 'react';
import { X, ClipboardCheck, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import './Modal.css';

const RESULT_OPTIONS = [
  { val: '合格',   color: '#10b981' },
  { val: '不合格', color: '#ef4444' },
  { val: '待複驗', color: '#f59e0b' },
];

const SEVERITY_OPTIONS = [
  { val: 'critical',    label: '嚴重', color: '#dc2626' },
  { val: 'major',       label: '主要', color: '#f59e0b' },
  { val: 'minor',       label: '次要', color: '#3b82f6' },
  { val: 'observation', label: '觀察', color: '#6b7280' },
];

export function InspectionQuickModal({ projectId, inspectDate, existing, onClose, onSuccess }) {
  const { user } = useAuth();
  const [workItem,    setWorkItem]    = useState(existing?.work_item   || '');
  const [location,    setLocation]    = useState(existing?.location    || '');
  const [inspectType, setInspectType] = useState(existing?.inspect_type || '施工抽查');
  const [inspector,   setInspector]   = useState(existing?.inspector   || user?.email?.split('@')[0] || '');
  const [result,      setResult]      = useState(existing?.result      || '合格');
  const [remark,      setRemark]      = useState(existing?.remark      || '');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const dateDisplay = (() => {
    if (!inspectDate) return '';
    const d = new Date(inspectDate + 'T00:00:00');
    return `${d.getFullYear() - 1911}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  })();

  const handleSubmit = async () => {
    if (!workItem.trim()) { setError('請填寫工項名稱'); return; }
    setSaving(true);
    setError('');

    const payload = {
      project_id:   projectId,
      inspect_date: inspectDate,
      work_item:    workItem.trim(),
      location:     location.trim() || null,
      inspect_type: inspectType,
      inspector:    inspector.trim() || null,
      result,
      remark:       remark.trim() || null,
    };

    let insId;
    if (existing?.id) {
      const { error: err } = await supabase
        .from('construction_inspections').update(payload).eq('id', existing.id);
      if (err) { setSaving(false); setError(err.message); return; }
      insId = existing.id;
    } else {
      const { data, error: err } = await supabase
        .from('construction_inspections')
        .insert({ ...payload, created_by: user?.id })
        .select().single();
      if (err) { setSaving(false); setError(err.message); return; }
      insId = data.id;
    }

    // 不合格 → 詢問是否立即建立缺失單
    if (result === '不合格' && !existing?.id) {
      const confirmed = window.confirm(
        `此抽查結果為「不合格」，是否立即建立缺失改善單？\n\n工項：${workItem}\n位置：${location || '（未填）'}`
      );
      if (confirmed) {
        await supabase.from('quality_issues').insert({
          project_id:      projectId,
          inspection_date: inspectDate,
          location:        location.trim() || null,
          item:            workItem.trim(),
          severity:        'major',
          description:     remark.trim() || null,
          status:          'open',
          created_by:      user?.id,
        });
      }
    }

    setSaving(false);
    onSuccess?.(insId);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardCheck size={15} style={{ color: 'var(--color-primary)' }} />
            <h2 className="modal-title">{existing?.id ? '編輯抽查記錄' : '新增抽查記錄'}</h2>
            {dateDisplay && (
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginLeft: 4 }}>
                {dateDisplay}
              </span>
            )}
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 檢驗類別 */}
          <div>
            <label className="form-label">檢驗類別</label>
            <div style={{ display: 'flex', gap: '6px', marginTop: 6 }}>
              {['施工抽查', '材料抽查', '進度查核'].map(t => (
                <button
                  key={t}
                  onClick={() => setInspectType(t)}
                  style={{
                    padding: '5px 12px', borderRadius: 6,
                    border: `1px solid ${inspectType === t ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: inspectType === t ? 'rgba(37,99,235,0.1)' : 'var(--color-surface)',
                    color: inspectType === t ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    fontSize: '0.78rem', fontWeight: inspectType === t ? 700 : 500,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >{t}</button>
              ))}
            </div>
          </div>

          {/* 工項 */}
          <div>
            <label className="form-label">
              工項名稱 <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              className="form-input" style={{ marginTop: 6 }}
              placeholder="例如：混凝土澆置"
              value={workItem}
              onChange={e => setWorkItem(e.target.value)}
            />
          </div>

          {/* 位置 + 人員 */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">檢驗位置</label>
              <input
                className="form-input" style={{ marginTop: 6 }}
                placeholder="例如：B1F 東側柱"
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label">檢驗人員</label>
              <input
                className="form-input" style={{ marginTop: 6 }}
                placeholder="監造姓名"
                value={inspector}
                onChange={e => setInspector(e.target.value)}
              />
            </div>
          </div>

          {/* 結果 */}
          <div>
            <label className="form-label">檢驗結果</label>
            <div style={{ display: 'flex', gap: '6px', marginTop: 6 }}>
              {RESULT_OPTIONS.map(r => (
                <button
                  key={r.val}
                  onClick={() => setResult(r.val)}
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: 6,
                    border: `1.5px solid ${result === r.val ? r.color : 'var(--color-border)'}`,
                    background: result === r.val ? `${r.color}18` : 'var(--color-surface)',
                    color: result === r.val ? r.color : 'var(--color-text-muted)',
                    fontSize: '0.82rem', fontWeight: result === r.val ? 700 : 500,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >{r.val}</button>
              ))}
            </div>
          </div>

          {/* 備註 */}
          <div>
            <label className="form-label">備註</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="檢驗情形、缺失描述、複驗指示等…"
              value={remark}
              onChange={e => setRemark(e.target.value)}
              style={{ marginTop: 6, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.55 }}
            />
          </div>

          {/* 不合格提示 */}
          {result === '不合格' && !existing?.id && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '8px 12px', borderRadius: 6,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#dc2626', fontSize: '0.75rem', lineHeight: 1.55,
            }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>儲存後將提示建立「缺失改善單」，以利後續追蹤。</span>
            </div>
          )}

          {error && (
            <div style={{
              color: 'var(--color-danger)', fontSize: '0.78rem',
              padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 6,
            }}>{error}</div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-modal-cancel" onClick={onClose}>取消</button>
          <button className="btn-modal-save" onClick={handleSubmit} disabled={saving}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> 儲存中…</> : '儲存抽查'}
          </button>
        </div>
      </div>
    </div>
  );
}
