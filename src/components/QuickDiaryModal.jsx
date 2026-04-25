import React, { useState } from 'react';
import { X, BookOpen, Loader2, Sun, Cloud, CloudRain, CloudSnow } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import './Modal.css';

const WORK_TEMPLATES = [
  { label: '混凝土澆置', text: '進行混凝土澆置作業，澆置前確認模板及鋼筋尺寸符合圖說規定，澆置後進行養護工作。' },
  { label: '鋼筋綁紮', text: '進行鋼筋綁紮作業，依圖說確認鋼筋間距、搭接長度及保護層厚度，完成自主檢查。' },
  { label: '模板組立', text: '進行模板組立作業，確認模板尺寸、支撐系統穩固性及垂直度，完成組立後請監造人員查驗。' },
  { label: '土方開挖', text: '進行土方開挖作業，依放樣尺寸施工，確認開挖深度及邊坡穩定，土方運棄至指定地點。' },
  { label: '管線埋設', text: '進行管線埋設作業，依圖說確認管線路由、管徑及埋設深度，完成後進行回填夯實。' },
  { label: '道路鋪面', text: '進行道路鋪面作業，確認基底壓實度合格後，依規定厚度鋪設瀝青混凝土並滾壓密實。' },
  { label: '排水設施', text: '進行排水設施施工，依圖說確認排水溝尺寸及坡度，接頭處理確實，完成後進行通水測試。' },
  { label: '護岸砌石', text: '進行護岸砌石作業，依圖說確認石材規格及砌築方式，確保穩固並填縫密實。' },
  { label: '整地整坡', text: '進行整地整坡作業，依設計圖說進行地形整平，確認坡度符合規定後進行表面處理。' },
  { label: '測量放樣', text: '進行測量放樣作業，確認控制點座標後，依圖說放出結構物位置線，請監造人員確認後方可施工。' },
];

const WEATHER_OPTIONS = [
  { val: '晴', icon: Sun, color: '#f59e0b' },
  { val: '陰', icon: Cloud, color: '#94a3b8' },
  { val: '雨', icon: CloudRain, color: '#60a5fa' },
  { val: '停工', icon: CloudSnow, color: '#ef4444' },
];

export function QuickDiaryModal({ projectId, logDate, onClose, onSuccess, initialData }) {
  const { user } = useAuth();
  const [weatherAm, setWeatherAm] = useState(initialData?.weather_am || '晴');
  const [weatherPm, setWeatherPm] = useState(initialData?.weather_pm || '晴');
  const [workItems, setWorkItems] = useState(initialData?.work_items || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [plannedProgress, setPlannedProgress] = useState(initialData?.planned_progress ?? '');
  const [actualProgress, setActualProgress]   = useState(initialData?.actual_progress  ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const applyTemplate = (tpl) => {
    setWorkItems(prev => prev ? `${prev}\n${tpl.text}` : tpl.text);
  };

  const handleSubmit = async () => {
    if (!workItems.trim()) { setError('請填寫施工記事或選擇模板'); return; }
    setSaving(true);
    setError('');

    const { error: err } = await supabase.from('daily_logs').upsert({
      project_id: projectId,
      log_date: logDate,
      weather_am: weatherAm,
      weather_pm: weatherPm,
      work_items: workItems.trim(),
      notes: notes.trim() || null,
      planned_progress: plannedProgress !== '' ? parseFloat(plannedProgress) : null,
      actual_progress:  actualProgress  !== '' ? parseFloat(actualProgress)  : null,
      created_by: user?.id,
    }, { onConflict: 'project_id,log_date' });

    setSaving(false);
    if (err) { setError(err.message); return; }
    onSuccess?.();
    onClose();
  };

  const dateDisplay = (() => {
    const d = new Date(logDate + 'T00:00:00');
    return `${d.getFullYear() - 1911}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  })();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={15} style={{ color: 'var(--color-primary)' }} />
            <h2 className="modal-title">快速新增施工日誌</h2>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginLeft: 4 }}>{dateDisplay}</span>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 天氣 */}
          <div style={{ display: 'flex', gap: '20px' }}>
            {[['上午', weatherAm, setWeatherAm], ['下午', weatherPm, setWeatherPm]].map(([label, val, setter]) => (
              <div key={label} style={{ flex: 1 }}>
                <label className="form-label">{label}天氣</label>
                <div style={{ display: 'flex', gap: '6px', marginTop: 6 }}>
                  {WEATHER_OPTIONS.map(w => {
                    const Icon = w.icon;
                    return (
                      <button
                        key={w.val}
                        onClick={() => setter(w.val)}
                        title={w.val}
                        style={{
                          padding: '5px 8px',
                          borderRadius: '6px',
                          border: `1px solid ${val === w.val ? w.color : 'var(--color-border)'}`,
                          background: val === w.val ? `${w.color}1a` : 'var(--color-surface)',
                          color: val === w.val ? w.color : 'var(--color-text-muted)',
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 3,
                          fontSize: '0.72rem',
                          transition: 'all 0.15s',
                        }}
                      >
                        <Icon size={12} />{w.val}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 工項模板 */}
          <div>
            <label className="form-label">快速套用工項模板</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: 6 }}>
              {WORK_TEMPLATES.map(t => (
                <button
                  key={t.label}
                  onClick={() => applyTemplate(t)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '5px',
                    fontSize: '0.72rem',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text2)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary-light)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text2)'; }}
                >
                  + {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 進度 */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {[['預定進度 (%)', plannedProgress, setPlannedProgress], ['實際進度 (%)', actualProgress, setActualProgress]].map(([label, val, setter]) => (
              <div key={label} style={{ flex: 1 }}>
                <label className="form-label">{label}</label>
                <input
                  type="number"
                  className="form-input"
                  min={0} max={100} step={0.1}
                  placeholder="0.0"
                  value={val}
                  onChange={e => setter(e.target.value)}
                  style={{ marginTop: 6 }}
                />
              </div>
            ))}
          </div>

          {/* 施工記事 */}
          <div>
            <label className="form-label">施工記事 <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <textarea
              className="form-input"
              rows={5}
              placeholder="填寫今日施工項目、進度說明…（點擊上方模板自動帶入）"
              value={workItems}
              onChange={e => setWorkItems(e.target.value)}
              style={{ marginTop: 6, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
            />
          </div>

          {/* 備註 */}
          <div>
            <label className="form-label">備註（選填）</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="特殊情況說明、協調事項等…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ marginTop: 6, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {error && (
            <div style={{ color: 'var(--color-danger)', fontSize: '0.78rem', padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-modal-cancel" onClick={onClose}>取消</button>
          <button className="btn-modal-save" onClick={handleSubmit} disabled={saving}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> 儲存中…</> : '儲存日誌'}
          </button>
        </div>
      </div>
    </div>
  );
}
