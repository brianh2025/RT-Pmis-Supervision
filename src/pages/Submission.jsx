/* ============================================================
   Submission.jsx — 送審管理（材料送審 + 計畫書送審）
   Based on MaterialControl MCS spreadsheet interface
   ============================================================ */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Send, Plus, Trash2, Download, Columns, RotateCcw, Archive, Loader2, CheckCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import './MaterialControl.css';

/* ── Column Definitions ── */
const VER_COL = { k: 'ver', l: 'VER', w: 68, ver: true };
const COLS = {
  sub: [
    { k: 'no', l: '#', w: 36 }, { k: 'ci', l: '契約項次', w: 88 },
    { k: 'name', l: '材料/設備名稱', w: 200, wrap: true }, { k: 'qty', l: '數量', w: 72 },
    { k: 'test', l: '取樣', w: 46, tog: ['V', 'X'] }, { k: 'p_date', l: '預定送審', w: 84 },
    { k: 'a_date', l: '實際送審', w: 84 }, { k: 'factory', l: '驗廠', w: 46, tog: ['是', '否'] },
    { k: 'vendor', l: '廠商', w: 40, tog: ['V', ''] }, { k: 'cat', l: '型錄', w: 40, tog: ['V', ''] },
    { k: 'rpt', l: '報告', w: 40, tog: ['V', ''] }, { k: 'smp', l: '樣品', w: 40, tog: ['V', ''] },
    { k: 'other', l: '其他', w: 150, wrap: true },
    { k: 'result', l: '審查結果', w: 84 }, { k: 'r_date', l: '審查日', w: 72 },
    VER_COL, { k: 'remark', l: '備註/歸檔', w: 140, wrap: true },
  ],
  pln: [
    { k: 'no', l: '#', w: 36 }, { k: 'item', l: '提報項目', w: 190, wrap: true },
    { k: 'deadline', l: '期限', w: 84 }, { k: 'submit', l: '提送日期/文號', w: 160, wrap: true },
    { k: 'reject', l: '檢退日期/文號', w: 160, wrap: true }, { k: 'approve', l: '核定日期/文號', w: 160, wrap: true },
    { k: 'basis', l: '依據', w: 110 }, VER_COL, { k: 'remark', l: '備註', w: 100 },
  ],
};
const TNAMES = ['材料送審管制表', '計畫書送審管制表'];
const TKEYS = ['sub', 'pln'];
const DB_TABLES = ['mcs_submission', 'mcs_plan'];
const VER_COLORS = ['#1565C0', '#0a8a4a', '#c2410c', '#6d28d9', '#0f766e', '#b45309'];

/* ── Check if row is approved ── */
function isApproved(row, tkey) {
  if (tkey === 'sub') return row.result === '同意備查';
  if (tkey === 'pln') return !!(row.approve && row.approve.trim());
  return false;
}

/* ── Badge Component ── */
function Badge({ val, onClick }) {
  const v = val || '';
  let cls = 'mcs-badge mcs-badge-x';
  if (v === 'V') cls = 'mcs-badge mcs-badge-v';
  else if (v === '是') cls = 'mcs-badge mcs-badge-yes';
  else if (v === '否') cls = 'mcs-badge mcs-badge-no';
  else if (v === '同意備查') cls = 'mcs-badge mcs-badge-ok';
  return <span className={cls} onClick={onClick} style={{ cursor: 'pointer' }}>{v || '—'}</span>;
}

function VerBadge({ val, color, onDblClick, onCycleColor }) {
  const c = color || VER_COLORS[0];
  return (
    <div style={{ textAlign: 'center' }}>
      <span className="mcs-ver-badge" style={{ color: c, borderColor: c, background: c + '18' }} onDoubleClick={onDblClick} title="雙擊編輯版本號">
        {val || '—'}
      </span>
      <span className="mcs-ver-cc" onClick={onCycleColor} title="切換顏色">⬤</span>
    </div>
  );
}

/* ── Archive Toast ── */
function ArchiveToast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
      background: 'var(--color-success)', color: '#fff',
      padding: '10px 16px', borderRadius: '8px',
      display: 'flex', alignItems: 'center', gap: '8px',
      fontSize: '0.82rem', fontWeight: 600,
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    }}>
      <CheckCircle size={16} />
      {message}
    </div>
  );
}

/* ── Main Component ── */
export function Submission() {
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [tables, setTables] = useState([[], []]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [editCell, setEditCell] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [showCols, setShowCols] = useState(false);
  const [hiddenCols, setHiddenCols] = useState({ sub: new Set(), pln: new Set() });
  const [archivingId, setArchivingId] = useState(null);
  const [toast, setToast] = useState(null);
  const saveQueueRef = useRef({});
  const editInputRef = useRef(null);

  const tkey = TKEYS[tab];
  const dbTable = DB_TABLES[tab];
  const cols = COLS[tkey];
  const rows = tables[tab];

  const loadTable = useCallback(async (ti) => {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from(DB_TABLES[ti]).select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) { console.error(error); return []; }
    return (data || []).map(r => ({ ...r, _localId: r.id }));
  }, [projectId]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const [sub, pln] = await Promise.all([loadTable(0), loadTable(1)]);
      setTables([sub, pln]);
      setLoading(false);
    }
    if (projectId) init();
  }, [projectId, loadTable]);

  useEffect(() => {
    if (editCell) setTimeout(() => { editInputRef.current?.focus(); editInputRef.current?.select?.(); }, 10);
  }, [editCell]);

  async function addRow() {
    if (!supabase) return;
    const newRow = { ver: 'v1', ver_color: VER_COLORS[0], project_id: projectId, created_by: user?.id, sort_order: rows.length };
    cols.forEach(c => { if (!(c.k in newRow)) newRow[c.k] = ''; });
    const { data, error } = await supabase.from(dbTable).insert([newRow]).select().single();
    if (error) { console.error(error); return; }
    setTables(prev => prev.map((t, i) => i === tab ? [...t, { ...data, _localId: data.id }] : t));
  }

  async function deleteSel() {
    if (!selected.size || !supabase) return;
    const ids = Array.from(selected).filter(id => id && id !== 'undefined');
    await supabase.from(dbTable).delete().in('id', ids);
    setTables(prev => prev.map((t, i) => i === tab ? t.filter(r => !selected.has(r.id)) : t));
    setSelected(new Set());
  }

  function toggleField(rowId, field, opts) {
    setTables(prev => {
      const updated = prev[tab].map(r => {
        if (r.id !== rowId) return r;
        const cur = r[field] || '';
        const next = opts[(opts.indexOf(cur) + 1) % opts.length];
        scheduleDbUpdate(rowId, { [field]: next });
        return { ...r, [field]: next };
      });
      return prev.map((t, i) => i === tab ? updated : t);
    });
  }

  function cycleVerColor(rowId) {
    setTables(prev => {
      const updated = prev[tab].map(r => {
        if (r.id !== rowId) return r;
        const idx = VER_COLORS.indexOf(r.ver_color || VER_COLORS[0]);
        const next = VER_COLORS[(idx + 1) % VER_COLORS.length];
        scheduleDbUpdate(rowId, { ver_color: next });
        return { ...r, ver_color: next };
      });
      return prev.map((t, i) => i === tab ? updated : t);
    });
  }

  function startEdit(rowId, field, val) {
    setEditCell({ rowId, field });
    setEditVal((val || '').replace(/\\n/g, '\n'));
  }

  function commitEdit() {
    if (!editCell) return;
    const { rowId, field } = editCell;
    setTables(prev => {
      const updated = prev[tab].map(r => r.id === rowId ? { ...r, [field]: editVal } : r);
      return prev.map((t, i) => i === tab ? updated : t);
    });
    scheduleDbUpdate(rowId, { [field]: editVal }, dbTable);
    setEditCell(null); setEditVal('');
  }

  function cancelEdit() { setEditCell(null); setEditVal(''); }

  function scheduleDbUpdate(rowId, patch, targetTable = dbTable) {
    if (!supabase) return;
    if (saveQueueRef.current[rowId]) clearTimeout(saveQueueRef.current[rowId]);
    saveQueueRef.current[rowId] = setTimeout(async () => {
      setSaving(true);
      const { error } = await supabase.from(targetTable).update(patch).eq('id', rowId);
      if (error) console.error('update error:', error);
      setSaving(false);
      setLastSaved(new Date());
    }, 800);
  }

  /* ── Archive approved row ── */
  async function archiveRow(row) {
    if (!supabase) return;
    setArchivingId(row.id);
    try {
      const title = tkey === 'sub' ? (row.name || '材料送審') : (row.item || '計畫書送審');
      const docNo = row.remark || '';
      const docDate = tkey === 'sub' ? (row.r_date || null) : null;
      const tags = tkey === 'sub' ? ['材料送審'] : ['施工計畫'];
      const category = 'submission';

      const { error } = await supabase.from('archive_docs').insert([{
        project_id: projectId,
        title,
        doc_no: docNo,
        category,
        version: row.ver || 'v1',
        doc_date: docDate,
        submission_id: row.id,
        source_table: dbTable,
        tags,
        created_by: user?.id,
      }]);

      if (error) {
        console.error('archive error:', error);
        setToast('歸檔失敗，請確認 archive_docs 資料表欄位');
      } else {
        setToast('已自動建立歸檔記錄 ✓');
      }
    } finally {
      setArchivingId(null);
    }
  }

  function togSel(id) {
    setSelected(prev => { const ns = new Set(prev); ns.has(id) ? ns.delete(id) : ns.add(id); return ns; });
  }
  function togAll() {
    setSelected(prev => prev.size === rows.length && rows.length > 0 ? new Set() : new Set(rows.map(r => r.id)));
  }
  function togHidCol(k) {
    setHiddenCols(prev => { const ns = new Set(prev[tkey]); ns.has(k) ? ns.delete(k) : ns.add(k); return { ...prev, [tkey]: ns }; });
  }
  function resetHidCols() { setHiddenCols(prev => ({ ...prev, [tkey]: new Set() })); }

  function exportJSON() {
    const data = { version: '1.0-pmis-sub', projectId, exportedAt: new Date().toISOString(), sub: tables[0], pln: tables[1] };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `submission_${projectId}_${Date.now()}.json`; a.click();
  }

  const visibleCols = cols.filter(c => !hiddenCols[tkey].has(c.k));
  const approvedCount = rows.filter(r => isApproved(r, tkey)).length;

  return (
    <div className="mcs-root">
      {/* Header */}
      <div className="mcs-header">
        <div className="mcs-header-left">
          <Send size={18} className="mcs-header-icon" />
          <h1 className="mcs-title">送審管理</h1>
          {saving && <span className="mcs-saving"><Loader2 size={12} className="mcs-spin" /> 儲存中…</span>}
          {!saving && lastSaved && <span className="mcs-saved">已儲存 {lastSaved.toLocaleTimeString()}</span>}
        </div>
        <div className="mcs-header-right">
          {approvedCount > 0 && (
            <span style={{ fontSize: '0.72rem', color: 'var(--color-success)', fontWeight: 600 }}>
              {approvedCount} 項已核定
            </span>
          )}
          <button className="mcs-btn" onClick={() => setShowCols(v => !v)}>
            <Columns size={14} /> 欄位
          </button>
          <button className="mcs-btn" onClick={exportJSON}>
            <Download size={14} /> 匯出
          </button>
          <button className="mcs-btn mcs-btn-danger" onClick={deleteSel} disabled={!selected.size}>
            <Trash2 size={14} /> 刪除({selected.size})
          </button>
          <button className="mcs-btn mcs-btn-primary" onClick={addRow}>
            <Plus size={14} /> 新增
          </button>
        </div>
      </div>

      {/* Column visibility panel */}
      {showCols && (
        <div className="mcs-col-panel">
          <div className="mcs-col-panel-inner">
            {cols.map(c => (
              <label key={c.k} className="mcs-col-chk">
                <input type="checkbox" checked={!hiddenCols[tkey].has(c.k)} onChange={() => togHidCol(c.k)} />
                {c.l}
              </label>
            ))}
          </div>
          <button className="mcs-btn" onClick={resetHidCols}><RotateCcw size={12} /> 重設</button>
        </div>
      )}

      {/* Tabs */}
      <div className="mcs-tabs">
        {TNAMES.map((name, i) => (
          <button key={i} className={`mcs-tab${tab === i ? ' active' : ''}`} onClick={() => { setTab(i); setSelected(new Set()); setEditCell(null); }}>
            {name}
            <span className="mcs-tab-count">{tables[i].length}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="mcs-table-wrap">
        {loading ? (
          <div className="mcs-loading"><Loader2 size={20} className="mcs-spin" /><span>載入中…</span></div>
        ) : (
          <table className="mcs-table">
            <thead>
              <tr>
                <th className="mcs-th mcs-th-chk">
                  <input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={togAll} />
                </th>
                {visibleCols.map(c => (
                  <th key={c.k} className="mcs-th" style={{ minWidth: c.w, width: c.w }}>{c.l}</th>
                ))}
                <th className="mcs-th" style={{ minWidth: 72 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={visibleCols.length + 2} className="mcs-empty">尚無資料 — 點擊「新增」建立第一筆</td></tr>
              )}
              {rows.map(row => (
                <tr key={row.id} className={`mcs-tr${selected.has(row.id) ? ' mcs-tr-sel' : ''}${isApproved(row, tkey) ? ' mcs-tr-approved' : ''}`}>
                  <td className="mcs-td mcs-td-chk">
                    <input type="checkbox" checked={selected.has(row.id)} onChange={() => togSel(row.id)} />
                  </td>
                  {visibleCols.map(c => {
                    const isEditing = editCell?.rowId === row.id && editCell?.field === c.k;
                    const val = row[c.k] ?? '';

                    if (c.ver) {
                      return (
                        <td key={c.k} className="mcs-td">
                          <VerBadge val={val} color={row.ver_color} onDblClick={() => startEdit(row.id, c.k, val)} onCycleColor={() => cycleVerColor(row.id)} />
                        </td>
                      );
                    }
                    if (c.tog) {
                      return (
                        <td key={c.k} className="mcs-td mcs-td-center">
                          <Badge val={val} onClick={() => toggleField(row.id, c.k, c.tog)} />
                        </td>
                      );
                    }
                    if (isEditing) {
                      return (
                        <td key={c.k} className="mcs-td">
                          {c.wrap
                            ? <textarea ref={editInputRef} className="mcs-cell-input mcs-cell-textarea" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Escape') cancelEdit(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); } }} rows={3} />
                            : <input ref={editInputRef} className="mcs-cell-input" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }} />
                          }
                        </td>
                      );
                    }
                    return (
                      <td key={c.k} className={`mcs-td${c.wrap ? ' mcs-td-wrap' : ''}`} onDoubleClick={() => startEdit(row.id, c.k, val)}>
                        {val || <span className="mcs-placeholder">—</span>}
                      </td>
                    );
                  })}
                  {/* Action column */}
                  <td className="mcs-td mcs-td-center">
                    {isApproved(row, tkey) && (
                      <button
                        className="mcs-btn mcs-btn-archive"
                        onClick={() => archiveRow(row)}
                        disabled={archivingId === row.id}
                        title="建立歸檔記錄"
                        style={{ fontSize: '0.68rem', padding: '3px 7px', gap: '3px' }}
                      >
                        {archivingId === row.id
                          ? <Loader2 size={11} className="mcs-spin" />
                          : <Archive size={11} />
                        }
                        →歸檔
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Toast */}
      {toast && <ArchiveToast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
