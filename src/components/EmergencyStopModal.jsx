import React, { useState } from 'react';
import { AlertTriangle, X, Camera, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import './Modal.css';

const STOP_REASONS = [
  '安全疑慮（即時危險）',
  '施工品質不符規範',
  '材料不合格或未送審',
  '圖說變更待確認',
  '地下管線或障礙物',
  '惡劣天候（颱風/豪雨）',
  '勞資或人力問題',
  '業主指示停工',
];

const today = () => new Date().toISOString().split('T')[0];

export function EmergencyStopModal({ projectId, onClose, onSuccess }) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!reason) { setError('請選擇停工原因'); return; }
    if (!location.trim()) { setError('請輸入停工位置'); return; }
    setSaving(true);
    setError('');

    const workItems = `【緊急停工通報】\n停工原因：${reason}\n停工位置：${location}`;
    const fullNotes = notes.trim()
      ? `${notes}\n\n通報時間：${new Date().toLocaleString('zh-TW')}`
      : `通報時間：${new Date().toLocaleString('zh-TW')}`;

    // 1. 寫入施工日誌
    const { error: logErr } = await supabase.from('daily_logs').upsert({
      project_id: projectId,
      log_date: today(),
      weather_am: '停工',
      weather_pm: '停工',
      work_items: workItems,
      notes: fullNotes,
      created_by: user?.id,
    }, { onConflict: 'project_id,log_date' });

    // 2. 寫入品管缺失（critical）
    const { error: qualErr } = await supabase.from('quality_issues').insert({
      project_id: projectId,
      inspection_date: today(),
      location,
      item: `緊急停工：${reason}`,
      severity: 'critical',
      description: notes || `停工原因：${reason}，位置：${location}`,
      status: 'open',
      created_by: user?.id,
    });

    setSaving(false);
    if (logErr || qualErr) {
      setError(logErr?.message || qualErr?.message || '儲存失敗');
      return;
    }
    onSuccess?.();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottom: '2px solid var(--color-danger, #ef4444)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} style={{ color: 'var(--color-danger, #ef4444)' }} />
            <h2 className="modal-title" style={{ color: 'var(--color-danger, #ef4444)' }}>緊急停工通報</h2>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 停工原因 */}
          <div>
            <label className="form-label">停工原因 <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
              {STOP_REASONS.map(r => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    border: `1px solid ${reason === r ? 'var(--color-danger, #ef4444)' : 'var(--color-border)'}`,
                    background: reason === r ? 'rgba(239,68,68,0.1)' : 'var(--color-surface)',
                    color: reason === r ? 'var(--color-danger, #ef4444)' : 'var(--color-text2)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* 停工位置 */}
          <div>
            <label className="form-label">
              <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
              停工位置 <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              className="form-input"
              placeholder="例：B棟1F柱位 / 3號排水溝上游段"
              value={location}
              onChange={e => setLocation(e.target.value)}
              style={{ marginTop: 6 }}
            />
          </div>

          {/* 說明 */}
          <div>
            <label className="form-label">
              <Camera size={12} style={{ display: 'inline', marginRight: 4 }} />
              詳細說明（選填）
            </label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="詳細描述停工情況、現場狀況、已採取措施等…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ marginTop: 6, resize: 'vertical' }}
            />
          </div>

          {error && (
            <div style={{ color: 'var(--color-danger)', fontSize: '0.78rem', padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>
              {error}
            </div>
          )}

          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', padding: '6px 10px', background: 'var(--color-bg2)', borderRadius: 6 }}>
            送出後將自動：1) 在今日施工日誌標註停工 2) 新增一筆重大品管缺失
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-modal-cancel" onClick={onClose}>取消</button>
          <button
            className="btn-modal-save"
            onClick={handleSubmit}
            disabled={saving}
            style={{ background: 'var(--color-danger, #ef4444)', borderColor: 'var(--color-danger, #ef4444)' }}
          >
            {saving ? <><Loader2 size={14} className="animate-spin" /> 送出中…</> : '確認緊急停工'}
          </button>
        </div>
      </div>
    </div>
  );
}
