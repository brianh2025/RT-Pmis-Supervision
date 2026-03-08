import React, { useState } from 'react';
import { X, Save, Building2 } from 'lucide-react';
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
};

export function AddProjectModal({ onClose, onSuccess }) {
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
      created_by: user?.id ?? null,
    };

    const { error: insertError } = await supabase.from('projects').insert(payload);
    if (insertError) {
      setError(`儲存失敗：${insertError.message}`);
      setSaving(false);
    } else {
      onSuccess?.();
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
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
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
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
              <label className="form-label"><span>預算（萬元）</span><span className="en">BUDGET (×10K NTD)</span></label>
              <input type="number" name="budget" className="form-input" value={form.budget} onChange={handleChange} placeholder="例：3500" min="0" />
            </div>
            <div className="form-group">
              <label className="form-label"><span>狀態</span><span className="en">STATUS</span></label>
              <select name="status" className="form-input" value={form.status} onChange={handleChange}>
                <option value="active">執行中 Active</option>
                <option value="completed">已完工 Completed</option>
                <option value="suspended">暫停 Suspended</option>
              </select>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-modal-cancel" onClick={onClose}>取消</button>
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
