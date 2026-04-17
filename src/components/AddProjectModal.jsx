import React, { useState, useEffect } from 'react';
import { X, Save, Building2, Lock, Unlock, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import './Modal.css';

const EMPTY_FORM = {
  name: '',
  location: '',
  contractor: '',
  status: 'active',
  start_date: '',
  end_date: '',
  budget: '',
  drive_folder_id: '',
};

export function AddProjectModal({ onClose, onSuccess }) {
  const { user } = useAuth();
  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem('pmis_add_project_draft');
    return saved ? JSON.parse(saved) : EMPTY_FORM;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [driveLocked, setDriveLocked] = useState(false);

  useEffect(() => {
    localStorage.setItem('pmis_add_project_draft', JSON.stringify(form));
  }, [form]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'budget') {
      setForm(prev => ({ ...prev, budget: value.replace(/[^0-9]/g, '') }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const clearDraft = () => localStorage.removeItem('pmis_add_project_draft');

  const handleClose = () => {
    clearDraft();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('工程名稱為必填欄位。'); return; }
    setSaving(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      location: form.location.trim() || null,
      contractor: form.contractor.trim() || null,
      status: form.status,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      budget: form.budget ? parseFloat(form.budget) : null,
      drive_folder_id: form.drive_folder_id.trim() || null,
      created_by: user?.id ?? null,
    };

    const { error: insertError } = await supabase.from('projects').insert(payload);
    if (insertError) {
      setError(`儲存失敗：${insertError.message}`);
      setSaving(false);
    } else {
      clearDraft();
      onSuccess?.();
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="modal-panel animate-slide-up">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <Building2 size={18} className="modal-icon" />
            <div>
              <h2 className="modal-title">新增工程</h2>
              <p className="modal-subtitle">ADD PROJECT</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={handleClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group full-width">
              <label className="form-label"><span>工程名稱</span><span className="en">PROJECT NAME *</span></label>
              <input name="name" className="form-input" value={form.name} onChange={handleChange} placeholder="例：虎尾鎮排水整治工程" required />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label"><span>施工地點</span><span className="en">LOCATION</span></label>
              <input name="location" className="form-input" value={form.location} onChange={handleChange} placeholder="例：虎尾鎮光復路沿線" />
            </div>
            <div className="form-group">
              <label className="form-label"><span>承包商</span><span className="en">CONTRACTOR</span></label>
              <input name="contractor" className="form-input" value={form.contractor} onChange={handleChange} placeholder="例：大成營造有限公司" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label"><span>開工日期</span><span className="en">START DATE</span></label>
              <input type="date" name="start_date" className="form-input" value={form.start_date} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label"><span>預計完工</span><span className="en">END DATE</span></label>
              <input type="date" name="end_date" className="form-input" value={form.end_date} onChange={handleChange} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label"><span>預算（元）</span><span className="en">BUDGET (NTD)</span></label>
              <input type="text" inputMode="numeric" name="budget" className="form-input" value={form.budget ? Number(form.budget).toLocaleString('zh-TW') : ''} onChange={handleChange} placeholder="例：52,000,000" />
            </div>
            <div className="form-group">
              <label className="form-label"><span>狀態</span><span className="en">STATUS</span></label>
              <select name="status" className="form-input" value={form.status} onChange={handleChange}>
                <option value="pending">未發包</option>
                <option value="active">執行中</option>
                <option value="completed">已完工</option>
                <option value="accepted">已竣工</option>
                <option value="suspended">暫停</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group full-width">
              <label className="form-label">
                <span>Google Drive 工程資料夾 ID</span>
                <span className="en">DRIVE FOLDER ID（選填）</span>
              </label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  name="drive_folder_id"
                  className="form-input"
                  value={form.drive_folder_id}
                  onChange={handleChange}
                  readOnly={driveLocked}
                  placeholder="貼上 Google Drive 工程資料夾網址中的 ID（1ABC…）"
                  style={driveLocked ? { background: 'var(--color-bg2)', cursor: 'default' } : {}}
                />
                <button
                  type="button"
                  title={driveLocked ? '解鎖 Drive ID' : '鎖定 Drive ID（防誤改）'}
                  disabled={!form.drive_folder_id.trim()}
                  onClick={() => setDriveLocked(v => !v)}
                  style={{ flexShrink: 0, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'none', cursor: form.drive_folder_id.trim() ? 'pointer' : 'not-allowed', color: driveLocked ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
                >
                  {driveLocked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>
                <a
                  href={form.drive_folder_id.trim() ? `https://drive.google.com/drive/folders/${form.drive_folder_id.trim()}` : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="前往 Google Drive 資料夾"
                  aria-disabled={!form.drive_folder_id.trim()}
                  style={{ flexShrink: 0, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'none', display: 'flex', alignItems: 'center', color: form.drive_folder_id.trim() ? '#2563eb' : 'var(--color-text-muted)', pointerEvents: form.drive_folder_id.trim() ? 'auto' : 'none', opacity: form.drive_folder_id.trim() ? 1 : 0.4 }}
                >
                  <ExternalLink size={14} />
                </a>
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                用於廠商施工日誌 Excel 自動同步。從 Drive 資料夾網址複製 ID：drive.google.com/drive/folders/<strong>此處</strong>
              </p>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-modal-cancel" onClick={handleClose}>取消</button>
            <button type="submit" className="btn-modal-save" disabled={saving}>
              <Save size={15} />
              {saving ? '儲存中...' : '儲存工程'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
