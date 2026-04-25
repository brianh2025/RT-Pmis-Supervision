import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import './Modal.css';

export function ProgressFormModal({ projectId, initialData, onClose, onSuccess, plannedProgress }) {
  const isEdit = !!initialData;
  const [form, setForm] = useState({
    report_date:     initialData?.report_date     ?? '',
    actual_progress: initialData?.actual_progress ?? '',
    notes:           initialData?.notes           ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.report_date || form.actual_progress === '') {
      setError('請填寫日期及實際進度');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      project_id:      projectId,
      report_date:     form.report_date,
      actual_progress: parseFloat(form.actual_progress),
      notes:           form.notes || null,
    };

    let err;
    if (isEdit) {
      ({ error: err } = await supabase
        .from('progress_records')
        .update(payload)
        .eq('id', initialData.id));
    } else {
      ({ error: err } = await supabase
        .from('progress_records')
        .insert(payload));
    }

    setSaving(false);
    if (err) {
      setError(`儲存失敗：${err.message}`);
    } else {
      onSuccess?.();
    }
  };

  // 差異：用傳入的計算值 plannedProgress
  const diff = form.actual_progress !== '' && plannedProgress !== null && plannedProgress !== undefined
    ? (parseFloat(form.actual_progress) - plannedProgress).toFixed(2)
    : null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div>
              <h2 className="modal-title">{isEdit ? '編輯進度紀錄' : '新增進度紀錄'}</h2>
              <p className="modal-subtitle">PROGRESS RECORD</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            <div className="form-group">
              <label className="form-label">報告日期 *</label>
              <input
                type="date"
                className="form-input"
                value={form.report_date}
                onChange={e => set('report_date', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">實際進度 (%) *</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                className="form-input"
                value={form.actual_progress}
                onChange={e => set('actual_progress', e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* 預定進度（唯讀，由工程計畫推算） */}
            {plannedProgress !== null && plannedProgress !== undefined && (
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '6px 12px', background: 'var(--color-bg2)', borderRadius: '8px' }}>
                預定進度（計算值）：<strong style={{ color: 'var(--color-text1)' }}>{plannedProgress.toFixed(2)}%</strong>
              </div>
            )}

            {diff !== null && (
              <div style={{
                padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                background: parseFloat(diff) >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
                color: parseFloat(diff) >= 0 ? '#10b981' : '#ef4444',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                {parseFloat(diff) >= 0 ? '▲ 超前' : '▼ 落後'} {Math.abs(parseFloat(diff)).toFixed(2)}%
                <div style={{ flex: 1, height: '6px', background: 'rgba(0,0,0,0.08)', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, parseFloat(form.actual_progress) || 0)}%`,
                    background: parseFloat(diff) >= 0 ? '#10b981' : '#ef4444',
                    transition: 'width 0.4s',
                  }} />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">備註說明</label>
              <textarea
                className="form-input"
                rows={3}
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="說明當期進度差異原因、重要事項…"
                style={{ resize: 'vertical' }}
              />
            </div>

            {error && <div className="form-error">{error}</div>}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-modal-cancel" onClick={onClose}>取消</button>
          <button className="btn-modal-save" onClick={handleSubmit} disabled={saving}>
            <Save size={15} /> {saving ? '儲存中…' : '儲存進度'}
          </button>
        </div>
      </div>
    </div>
  );
}
