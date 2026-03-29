/* ============================================================
   Quality.jsx — 品質管理
   Tab 0: 施工檢驗管制（construction_inspections）
   Tab 1: 缺失改善管制（quality_issues）
   ============================================================ */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import './MaterialControl.css';
import '../components/Modal.css';

/* ── Config ── */
const SEVERITY_CONFIG = {
  critical:    { label: '重大缺失', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  major:       { label: '一般缺失', color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  minor:       { label: '輕微缺失', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  observation: { label: '觀察項目', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
};

const RESOLVE_STATUS = {
  open:        { label: '待改善', color: '#ef4444' },
  in_progress: { label: '改善中', color: '#f59e0b' },
  resolved:    { label: '已改善', color: '#10b981' },
  verified:    { label: '已驗收', color: '#6366f1' },
  waived:      { label: '免改善', color: '#6b7280' },
};
const RESOLVE_CYCLE = ['open', 'in_progress', 'resolved', 'verified', 'waived'];

const INSPECT_RESULT = {
  '合格':  { color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  '不合格': { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  '待複驗': { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
};
const RESULT_CYCLE = ['合格', '不合格', '待複驗'];

const TNAMES = ['施工檢驗管制', '缺失改善管制'];

const EMPTY_INSPECT = {
  inspect_date: new Date().toISOString().split('T')[0],
  work_item: '', location: '', inspect_type: '', inspector: '', result: '待複驗', remark: '',
};
const EMPTY_QUALITY = {
  inspection_date: new Date().toISOString().split('T')[0],
  location: '', item: '', severity: 'major', description: '', responsible: '', deadline: '', remark: '',
};

/* ── Main Component ── */
export function Quality() {
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const [tab, setTab] = useState(0);

  // Tab 0: construction_inspections
  const [inspections, setInspections] = useState([]);
  const [inspFilter, setInspFilter] = useState('all');
  const [showInspModal, setShowInspModal] = useState(false);
  const [inspForm, setInspForm] = useState({ ...EMPTY_INSPECT });

  // Tab 1: quality_issues
  const [issues, setIssues] = useState([]);
  const [issueFilter, setIssueFilter] = useState('all');
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueForm, setIssueForm] = useState({ ...EMPTY_QUALITY });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [editCell, setEditCell] = useState(null);
  const [editVal, setEditVal] = useState('');
  const editInputRef = useRef(null);

  const loadInspections = useCallback(async () => {
    if (!supabase) return [];
    const { data } = await supabase.from('construction_inspections').select('*')
      .eq('project_id', projectId).order('inspect_date', { ascending: false });
    return data || [];
  }, [projectId]);

  const loadIssues = useCallback(async () => {
    if (!supabase) return [];
    const { data } = await supabase.from('quality_issues').select('*')
      .eq('project_id', projectId).order('inspection_date', { ascending: false });
    return data || [];
  }, [projectId]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const [ins, iss] = await Promise.all([loadInspections(), loadIssues()]);
      setInspections(ins);
      setIssues(iss);
      setLoading(false);
    }
    if (projectId) init();
  }, [projectId, loadInspections, loadIssues]);

  useEffect(() => {
    if (editCell) setTimeout(() => editInputRef.current?.focus(), 10);
  }, [editCell]);

  /* ── Tab 0: Inspections ── */
  async function addInspection() {
    if (!supabase || !inspForm.work_item.trim()) return;
    setSaving(true);
    const { data } = await supabase.from('construction_inspections').insert([{
      project_id: projectId, created_by: user?.id, ...inspForm,
    }]).select().single();
    if (data) setInspections(prev => [data, ...prev]);
    setShowInspModal(false);
    setInspForm({ ...EMPTY_INSPECT });
    setSaving(false);
  }

  async function cycleInspResult(id, cur) {
    if (!supabase) return;
    const next = RESULT_CYCLE[(RESULT_CYCLE.indexOf(cur) + 1) % RESULT_CYCLE.length];
    await supabase.from('construction_inspections').update({ result: next }).eq('id', id);
    setInspections(prev => prev.map(r => r.id === id ? { ...r, result: next } : r));
  }

  /* ── Tab 1: Quality Issues ── */
  async function addIssue() {
    if (!supabase || !issueForm.item.trim()) return;
    setSaving(true);
    const { data } = await supabase.from('quality_issues').insert([{
      project_id: projectId, created_by: user?.id, status: 'open',
      ...issueForm, deadline: issueForm.deadline || null,
    }]).select().single();
    if (data) setIssues(prev => [data, ...prev]);
    setShowIssueModal(false);
    setIssueForm({ ...EMPTY_QUALITY });
    setSaving(false);
  }

  async function cycleIssueStatus(id, cur) {
    if (!supabase) return;
    const next = RESOLVE_CYCLE[(RESOLVE_CYCLE.indexOf(cur) + 1) % RESOLVE_CYCLE.length];
    await supabase.from('quality_issues').update({ status: next }).eq('id', id);
    setIssues(prev => prev.map(r => r.id === id ? { ...r, status: next } : r));
  }

  /* ── Inline edit (shared) ── */
  function startEdit(id, field, val, table) {
    setEditCell({ id, field, table });
    setEditVal(val || '');
  }

  async function commitEdit() {
    if (!editCell || !supabase) return;
    const { id, field, table } = editCell;
    const patch = { [field]: editVal || null };
    await supabase.from(table).update(patch).eq('id', id);
    if (table === 'construction_inspections') {
      setInspections(prev => prev.map(r => r.id === id ? { ...r, [field]: editVal } : r));
    } else {
      setIssues(prev => prev.map(r => r.id === id ? { ...r, [field]: editVal } : r));
    }
    setEditCell(null); setEditVal('');
  }

  function cancelEdit() { setEditCell(null); setEditVal(''); }

  /* ── Delete selected ── */
  async function deleteSelected() {
    if (!selected.size || !supabase) return;
    const ids = Array.from(selected);
    if (tab === 0) {
      await supabase.from('construction_inspections').delete().in('id', ids);
      setInspections(prev => prev.filter(r => !selected.has(r.id)));
    } else {
      await supabase.from('quality_issues').delete().in('id', ids);
      setIssues(prev => prev.filter(r => !selected.has(r.id)));
    }
    setSelected(new Set());
  }

  function togSel(id) {
    setSelected(prev => { const ns = new Set(prev); ns.has(id) ? ns.delete(id) : ns.add(id); return ns; });
  }

  function EditableCell({ id, field, table, val, type = 'text' }) {
    const isEd = editCell?.id === id && editCell?.field === field;
    if (isEd) {
      return (
        <input ref={editInputRef} className="mcs-ce" type={type} value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === 'Escape') cancelEdit(); if (e.key === 'Enter') commitEdit(); }}
          style={{ width: '100%' }} />
      );
    }
    return (
      <div className="mcs-cv" onDoubleClick={() => startEdit(id, field, val, table)}>
        {val || <span className="mcs-placeholder">·</span>}
      </div>
    );
  }

  /* ── Stats ── */
  const inspStats = RESULT_CYCLE.reduce((acc, r) => { acc[r] = inspections.filter(i => i.result === r).length; return acc; }, {});
  const issueStats = RESOLVE_CYCLE.reduce((acc, s) => { acc[s] = issues.filter(i => i.status === s).length; return acc; }, {});
  const filteredInsp = inspFilter === 'all' ? inspections : inspections.filter(r => r.result === inspFilter);
  const filteredIssues = issueFilter === 'all' ? issues : issues.filter(r => r.status === issueFilter);
  const openIssues = (issueStats.open || 0) + (issueStats.in_progress || 0);

  if (loading) return (
    <div className="mcs-loading"><Loader2 size={20} className="animate-spin" /><span>載入品質管理資料中…</span></div>
  );

  return (
    <div className="mcs-root">
      {/* Stats bar */}
      <div className="mcs-stats">
        {tab === 0 ? (
          RESULT_CYCLE.map(r => {
            const cfg = INSPECT_RESULT[r];
            return (
              <div key={r} className="mcs-stat" style={{ cursor: 'pointer' }} onClick={() => setInspFilter(f => f === r ? 'all' : r)}>
                <span className="mcs-stat-val" style={{ color: cfg.color }}>{inspStats[r] || 0}</span>
                <span className="mcs-stat-label">{r}</span>
              </div>
            );
          })
        ) : (
          RESOLVE_CYCLE.map(s => {
            const cfg = RESOLVE_STATUS[s];
            return (
              <div key={s} className="mcs-stat" style={{ cursor: 'pointer' }} onClick={() => setIssueFilter(f => f === s ? 'all' : s)}>
                <span className="mcs-stat-val" style={{ color: cfg.color }}>{issueStats[s] || 0}</span>
                <span className="mcs-stat-label">{cfg.label}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Toolbar */}
      <div className="mcs-toolbar">
        <div className="mcs-toolbar-group">
          <span className="mcs-grp-label">管制表</span>
          <div className="mcs-tabs">
            {TNAMES.map((n, i) => (
              <button key={i} className={`mcs-tab${tab === i ? ' active' : ''}`}
                onClick={() => { setTab(i); setSelected(new Set()); setEditCell(null); setInspFilter('all'); setIssueFilter('all'); }}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="mcs-toolbar-group" style={{ marginLeft: 'auto' }}>
          {selected.size > 0 && (
            <button className="mcs-btn mcs-btn-del" onClick={deleteSelected}><Trash2 size={12} /> 刪除({selected.size})</button>
          )}
          {tab === 0 && openIssues === 0 && (
            <span style={{ fontSize: '0.68rem', color: 'var(--color-success)' }}>• 無待複驗項目</span>
          )}
          <button className="mcs-btn mcs-btn-add" onClick={() => tab === 0 ? setShowInspModal(true) : setShowIssueModal(true)}>
            <Plus size={12} /> 新增{tab === 0 ? '檢驗' : '缺失'}
          </button>
        </div>
      </div>

      {/* Tab 0: 施工檢驗管制 */}
      {tab === 0 && (
        <div className="mcs-tbl-wrap">
          <table className="mcs-table">
            <thead>
              <tr>
                <th style={{ width: 28 }}>
                  <input type="checkbox"
                    checked={filteredInsp.length > 0 && selected.size === filteredInsp.length}
                    onChange={() => setSelected(selected.size === filteredInsp.length ? new Set() : new Set(filteredInsp.map(r => r.id)))} />
                </th>
                <th style={{ width: 90 }}>檢驗日期</th>
                <th style={{ width: 160 }}>工程項目</th>
                <th style={{ width: 120 }}>部位</th>
                <th style={{ width: 100 }}>檢驗類型</th>
                <th style={{ width: 90 }}>人員</th>
                <th style={{ width: 80 }}>結果</th>
                <th>備註</th>
              </tr>
            </thead>
            <tbody>
              {filteredInsp.length === 0 ? (
                <tr><td colSpan={8} className="mcs-empty">
                  <ShieldCheck size={28} style={{ opacity: 0.2, margin: '0 auto 8px', display: 'block' }} />
                  <div>尚無施工檢驗記錄 — 點擊「新增檢驗」建立</div>
                </td></tr>
              ) : filteredInsp.map(row => {
                const resCfg = INSPECT_RESULT[row.result] || INSPECT_RESULT['待複驗'];
                return (
                  <tr key={row.id} className={selected.has(row.id) ? 'sel' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={selected.has(row.id)} onChange={() => togSel(row.id)} />
                    </td>
                    <td style={{ padding: '2px 4px' }}>
                      <EditableCell id={row.id} field="inspect_date" table="construction_inspections" val={row.inspect_date} type="date" />
                    </td>
                    <td style={{ padding: '2px 4px' }}>
                      <EditableCell id={row.id} field="work_item" table="construction_inspections" val={row.work_item} />
                    </td>
                    <td style={{ padding: '2px 4px' }}>
                      <EditableCell id={row.id} field="location" table="construction_inspections" val={row.location} />
                    </td>
                    <td style={{ padding: '2px 4px' }}>
                      <EditableCell id={row.id} field="inspect_type" table="construction_inspections" val={row.inspect_type} />
                    </td>
                    <td style={{ padding: '2px 4px' }}>
                      <EditableCell id={row.id} field="inspector" table="construction_inspections" val={row.inspector} />
                    </td>
                    <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                      <span onClick={() => cycleInspResult(row.id, row.result)} title="點擊切換結果"
                        style={{ display: 'inline-block', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 600,
                          color: resCfg.color, background: resCfg.bg, border: `1px solid ${resCfg.color}40` }}>
                        {row.result || '待複驗'}
                      </span>
                    </td>
                    <td style={{ padding: '2px 4px' }}>
                      <EditableCell id={row.id} field="remark" table="construction_inspections" val={row.remark} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 1: 缺失改善管制 */}
      {tab === 1 && (
        <div className="mcs-tbl-wrap">
          <table className="mcs-table">
            <thead>
              <tr>
                <th style={{ width: 28 }}>
                  <input type="checkbox"
                    checked={filteredIssues.length > 0 && selected.size === filteredIssues.length}
                    onChange={() => setSelected(selected.size === filteredIssues.length ? new Set() : new Set(filteredIssues.map(r => r.id)))} />
                </th>
                <th style={{ width: 90 }}>查驗日期</th>
                <th style={{ width: 100 }}>位置</th>
                <th style={{ width: 160 }}>缺失項目</th>
                <th style={{ width: 80 }}>嚴重度</th>
                <th style={{ width: 200 }}>缺失說明</th>
                <th style={{ width: 80 }}>責任廠商</th>
                <th style={{ width: 90 }}>改善期限</th>
                <th style={{ width: 90 }}>狀態</th>
                <th style={{ width: 90 }}>改善日期</th>
                <th>備註</th>
              </tr>
            </thead>
            <tbody>
              {filteredIssues.length === 0 ? (
                <tr><td colSpan={11} className="mcs-empty">
                  <AlertTriangle size={28} style={{ opacity: 0.2, margin: '0 auto 8px', display: 'block' }} />
                  <div>目前無品管缺失記錄 — 點擊「新增缺失」建立</div>
                </td></tr>
              ) : filteredIssues.map(row => {
                const sevCfg = SEVERITY_CONFIG[row.severity] || SEVERITY_CONFIG.major;
                const resCfg = RESOLVE_STATUS[row.status] || RESOLVE_STATUS.open;
                const isOverdue = row.deadline && new Date(row.deadline) < new Date()
                  && !['resolved', 'verified', 'waived'].includes(row.status);
                return (
                  <tr key={row.id} className={selected.has(row.id) ? 'sel' : ''}
                    style={isOverdue ? { background: 'rgba(239,68,68,0.03)' } : {}}>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={selected.has(row.id)} onChange={() => togSel(row.id)} />
                    </td>
                    <td style={{ padding: '2px 4px' }}>
                      <EditableCell id={row.id} field="inspection_date" table="quality_issues" val={row.inspection_date} type="date" />
                    </td>
                    <td style={{ padding: '2px 4px' }}>
                      <EditableCell id={row.id} field="location" table="quality_issues" val={row.location} />
                    </td>
                    <td style={{ padding: '2px 4px' }}>
                      <EditableCell id={row.id} field="item" table="quality_issues" val={row.item} />
                    </td>
                    <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '4px', fontSize: '10px',
                        background: sevCfg.bg, color: sevCfg.color, border: `1px solid ${sevCfg.color}40` }}>
                        {sevCfg.label}
                      </span>
                    </td>
                    <td style={{ padding: '2px 4px' }}>
                      <EditableCell id={row.id} field="description" table="quality_issues" val={row.description} />
                    </td>
                    <td style={{ padding: '2px 4px' }}>
                      <EditableCell id={row.id} field="responsible" table="quality_issues" val={row.responsible} />
                    </td>
                    <td style={{ padding: '2px 4px' }}>
                      <EditableCell id={row.id} field="deadline" table="quality_issues" val={row.deadline} type="date" />
                    </td>
                    <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                      <span onClick={() => cycleIssueStatus(row.id, row.status)} title="點擊切換狀態"
                        style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer',
                          color: resCfg.color, border: `1px solid ${resCfg.color}40`, background: `${resCfg.color}10` }}>
                        {resCfg.label}
                      </span>
                    </td>
                    <td style={{ padding: '2px 4px' }}>
                      <EditableCell id={row.id} field="resolve_date" table="quality_issues" val={row.resolve_date} type="date" />
                    </td>
                    <td style={{ padding: '2px 4px' }}>
                      <EditableCell id={row.id} field="remark" table="quality_issues" val={row.remark} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mcs-footer">
        {tab === 0
          ? <span>共 {filteredInsp.length} 筆 · 合格 {inspStats['合格'] || 0} · 不合格 {inspStats['不合格'] || 0} · 待複驗 {inspStats['待複驗'] || 0}</span>
          : <span>共 {filteredIssues.length} 筆 · 待改善 {openIssues} 筆</span>
        }
        <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '0.7rem' }}>雙擊儲存格編輯 · 點擊狀態/結果切換</span>
      </div>

      {/* Modal: 新增施工檢驗 */}
      {showInspModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowInspModal(false)}>
          <div className="modal-box" style={{ maxWidth: '520px', width: '92%' }}>
            <div className="modal-header">
              <div className="modal-title"><ShieldCheck size={16} style={{ color: 'var(--color-primary-light)' }} /><span>新增施工檢驗記錄</span></div>
              <button className="modal-close" onClick={() => setShowInspModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  { label: '檢驗日期', field: 'inspect_date', type: 'date' },
                  { label: '檢驗類型', field: 'inspect_type', type: 'text', placeholder: '例：鋼筋綁紮' },
                  { label: '工程項目', field: 'work_item', type: 'text', placeholder: '例：主體鋼筋工程', full: true },
                  { label: '部位/位置', field: 'location', type: 'text', placeholder: '例：B2F 柱位 A3' },
                  { label: '檢驗人員', field: 'inspector', type: 'text', placeholder: '姓名' },
                  { label: '備註', field: 'remark', type: 'text', placeholder: '備註說明', full: true },
                ].map(({ label, field, type, placeholder, full }) => (
                  <div key={field} style={{ gridColumn: full ? '1 / -1' : undefined }}>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>{label}</label>
                    <input type={type} placeholder={placeholder} value={inspForm[field] || ''}
                      onChange={e => setInspForm(prev => ({ ...prev, [field]: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text1)', fontSize: '13px', boxSizing: 'border-box' }} />
                  </div>
                ))}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>檢驗結果</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {RESULT_CYCLE.map(r => {
                      const cfg = INSPECT_RESULT[r];
                      const active = inspForm.result === r;
                      return (
                        <button key={r} onClick={() => setInspForm(prev => ({ ...prev, result: r }))}
                          style={{ flex: 1, padding: '5px 8px', borderRadius: '5px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                            background: active ? cfg.bg : 'transparent', color: active ? cfg.color : 'var(--color-text-muted)',
                            border: `1px solid ${active ? cfg.color + '60' : 'var(--color-border)'}` }}>
                          {r}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowInspModal(false)}>取消</button>
              <button className="btn-primary" onClick={addInspection} disabled={saving || !inspForm.work_item.trim()}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} 新增
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: 新增品管缺失 */}
      {showIssueModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowIssueModal(false)}>
          <div className="modal-box" style={{ maxWidth: '560px', width: '92%' }}>
            <div className="modal-header">
              <div className="modal-title"><AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} /><span>新增品管缺失</span></div>
              <button className="modal-close" onClick={() => setShowIssueModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  { label: '查驗日期', field: 'inspection_date', type: 'date' },
                  { label: '缺失位置', field: 'location', type: 'text', placeholder: '例：B1 柱位 C3' },
                  { label: '缺失項目', field: 'item', type: 'text', placeholder: '例：鋼筋間距不符', full: true },
                  { label: '缺失說明', field: 'description', type: 'text', placeholder: '詳細說明', full: true },
                  { label: '責任廠商', field: 'responsible', type: 'text', placeholder: '廠商名稱' },
                  { label: '改善期限', field: 'deadline', type: 'date' },
                  { label: '備註', field: 'remark', type: 'text', placeholder: '備註說明', full: true },
                ].map(({ label, field, type, placeholder, full }) => (
                  <div key={field} style={{ gridColumn: full ? '1 / -1' : undefined }}>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>{label}</label>
                    <input type={type} placeholder={placeholder} value={issueForm[field] || ''}
                      onChange={e => setIssueForm(prev => ({ ...prev, [field]: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text1)', fontSize: '13px', boxSizing: 'border-box' }} />
                  </div>
                ))}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>嚴重度</label>
                  <select value={issueForm.severity} onChange={e => setIssueForm(prev => ({ ...prev, severity: e.target.value }))}
                    style={{ width: '100%', padding: '6px 8px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text1)', fontSize: '13px' }}>
                    {Object.entries(SEVERITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowIssueModal(false)}>取消</button>
              <button className="btn-primary" onClick={addIssue} disabled={saving || !issueForm.item.trim()}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} 新增
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
