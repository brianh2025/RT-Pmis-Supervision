/* ============================================================
   MaterialControl.jsx — 材料管制
   Tab 0: 材料進場紀錄（material_entries）
   Tab 1: 檢試驗管制表（mcs_test）
   ============================================================ */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ClipboardCheck, Plus, Trash2, Download, Columns, RotateCcw, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import './MaterialControl.css';

/* ── Column Definitions ── */
const VER_COL = { k: 'ver', l: 'VER', w: 68, ver: true };

/* 材料進場紀錄 columns */
const ENTRY_COLS = [
  { k: 'entry_date', l: '進場日期', w: 90 },
  { k: 'name', l: '材料名稱', w: 180, wrap: true },
  { k: 'spec', l: '規格', w: 130, wrap: true },
  { k: 'qty', l: '數量', w: 80 },
  { k: 'vendor', l: '廠商', w: 120 },
  { k: 'inspector', l: '驗收人員', w: 90 },
  { k: 'remark', l: '備註', w: 200, wrap: true },
];

/* 檢試驗管制表 columns */
const TST_COLS = [
  { k: 'no', l: '#', w: 36 }, { k: 'ci', l: '契約項次', w: 88 },
  { k: 'name', l: '材料/設備名稱', w: 175, wrap: true }, { k: 'p_date', l: '預定進場', w: 82 },
  { k: 'a_date', l: '實際進場', w: 82 }, { k: 'qty', l: '數量', w: 70 },
  { k: 's_date', l: '抽樣日', w: 72 }, { k: 's_qty', l: '抽樣量', w: 66 },
  { k: 'freq', l: '抽樣頻率', w: 240, wrap: true }, { k: 'cum_qty', l: '累積進場', w: 72 },
  { k: 'cum_smp', l: '累積抽樣', w: 72 }, { k: 'result', l: '試驗結果', w: 92 },
  { k: 'personnel', l: '人員', w: 100 }, VER_COL, { k: 'remark', l: '備註/歸檔', w: 130, wrap: true },
];

const TNAMES = ['材料進場紀錄', '檢試驗管制表'];
const VER_COLORS = ['#1565C0', '#0a8a4a', '#c2410c', '#6d28d9', '#0f766e', '#b45309'];

/* ── Seed Data for 檢試驗管制 ── */
const SEED_TST = [
  { no: '1', ci: '壹.一.3', name: '構造物回填，回填土，機械', freq: '現地回填，無須試驗' },
  { no: '2', ci: '壹.一.7', name: '結構用混凝土，預拌140kgf/cm2', freq: '提出檢驗試驗報告，不需抽樣' },
  { no: '2', ci: '壹.一.8', name: '結構用混凝土，預拌210kgf/cm2', freq: '坍度/氯離子:每次澆置；圓柱試體:100m³一組；鑽心:每100m一組' },
  { no: '3', ci: '壹.一.9', name: '鋼筋SD280', freq: '物性檢驗(拉伸彎曲外觀)：各尺度每50T取1支', remark: '需附無輻射證明' },
  { no: '3', ci: '壹.一.10', name: '鋼筋SD420', freq: '物性檢驗(拉伸彎曲外觀)：各尺度每50T取1支', remark: '需附無輻射證明' },
  { no: '4', ci: '壹.一.31', name: '混凝土基樁Ø30cm L=6m', freq: '基樁試驗(含破壞檢視鋼絞線)：每500支取1支' },
  { no: '5', ci: '壹.一.14', name: '銲接鋼線網 D=10mm', freq: '銲接鋼絲網試驗：每1,000m²取1次' },
  { no: '6', ci: '壹.一.15', name: '瀝青混凝土鋪面 密級配 10cm', freq: '含油量/篩分析:每6,000m²；鑽心厚度/壓實度:每1,000m²；容積比重:每批' },
  { no: '6', ci: '壹.一.16', name: '瀝青黏層', freq: '黏滯度試驗：每1,000m²取1組' },
  { no: '7', ci: '壹.一.18', name: '控制性低強度回填材料', freq: '圓柱試體抗壓：100m³一組，餘數>20m³加組' },
  { no: '8', ci: '壹.一.19', name: '地工織布', freq: '每批進場檢驗1次' },
  { no: '9', ci: '壹.一.20', name: 'PS版', freq: '每批進場檢驗1次' },
  { no: '10', ci: '壹.一.21', name: 'PVC止水帶', freq: '每批進場檢驗1次' },
  { no: '11', ci: '壹.一.29', name: '不銹鋼爬梯 ∮19mm', freq: '每批進場檢驗1次' },
  { no: '12', ci: '壹.五.1(4)', name: '化學植筋', freq: '植筋拉拔：施工前3支，施工後每100支取1支' },
];

/* ── Badge Components ── */
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

/* ── Main Component ── */
export function MaterialControl() {
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const [tab, setTab] = useState(0);

  // Tab 0: material_entries, Tab 1: mcs_test
  const [entries, setEntries] = useState([]);     // material_entries
  const [tstRows, setTstRows] = useState([]);     // mcs_test
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [editCell, setEditCell] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [showCols, setShowCols] = useState(false);
  const [hiddenCols, setHiddenCols] = useState({ entry: new Set(), tst: new Set() });
  const [seeding, setSeeding] = useState(false);
  const saveQueueRef = useRef({});
  const editInputRef = useRef(null);

  const tkey = tab === 0 ? 'entry' : 'tst';
  const cols = tab === 0 ? ENTRY_COLS : TST_COLS;
  const rows = tab === 0 ? entries : tstRows;
  const dbTable = tab === 0 ? 'material_entries' : 'mcs_test';

  const loadEntries = useCallback(async () => {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('material_entries').select('*')
      .eq('project_id', projectId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return []; }
    return data || [];
  }, [projectId]);

  const loadTst = useCallback(async () => {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('mcs_test').select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) { console.error(error); return []; }
    return data || [];
  }, [projectId]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const [e, t] = await Promise.all([loadEntries(), loadTst()]);
      setEntries(e);
      setTstRows(t);
      setLoading(false);
    }
    if (projectId) init();
  }, [projectId, loadEntries, loadTst]);

  useEffect(() => {
    if (editCell) setTimeout(() => { editInputRef.current?.focus(); editInputRef.current?.select?.(); }, 10);
  }, [editCell]);

  async function seedTst() {
    if (!supabase) return;
    if (!confirm('將載入預設檢試驗管制範例資料（不覆蓋現有資料）。確定繼續？')) return;
    setSeeding(true);
    const inserts = SEED_TST.map((r, idx) => ({
      ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? ''])),
      ver: 'v1', ver_color: VER_COLORS[0], project_id: projectId, created_by: user?.id, sort_order: idx,
    }));
    await supabase.from('mcs_test').insert(inserts);
    const t = await loadTst();
    setTstRows(t);
    setSeeding(false);
  }

  async function addRow() {
    if (!supabase) return;
    let newRow;
    if (tab === 0) {
      newRow = { project_id: projectId, created_by: user?.id, entry_date: new Date().toISOString().split('T')[0], name: '', spec: '', qty: '', vendor: '', inspector: '', remark: '' };
    } else {
      newRow = { ver: 'v1', ver_color: VER_COLORS[0], project_id: projectId, created_by: user?.id, sort_order: tstRows.length };
      TST_COLS.forEach(c => { if (!(c.k in newRow)) newRow[c.k] = ''; });
    }
    const { data, error } = await supabase.from(dbTable).insert([newRow]).select().single();
    if (error) { console.error(error); return; }
    if (tab === 0) setEntries(prev => [data, ...prev]);
    else setTstRows(prev => [...prev, data]);
  }

  async function deleteSel() {
    if (!selected.size || !supabase) return;
    const ids = Array.from(selected).filter(id => id && id !== 'undefined');
    await supabase.from(dbTable).delete().in('id', ids);
    if (tab === 0) setEntries(prev => prev.filter(r => !selected.has(r.id)));
    else setTstRows(prev => prev.filter(r => !selected.has(r.id)));
    setSelected(new Set());
  }

  function toggleField(rowId, field, opts) {
    setTstRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const cur = r[field] || '';
      const next = opts[(opts.indexOf(cur) + 1) % opts.length];
      scheduleDbUpdate(rowId, { [field]: next });
      return { ...r, [field]: next };
    }));
  }

  function cycleVerColor(rowId) {
    setTstRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const idx = VER_COLORS.indexOf(r.ver_color || VER_COLORS[0]);
      const next = VER_COLORS[(idx + 1) % VER_COLORS.length];
      scheduleDbUpdate(rowId, { ver_color: next });
      return { ...r, ver_color: next };
    }));
  }

  function startEdit(rowId, field, val) {
    setEditCell({ rowId, field });
    setEditVal((val || '').replace(/\\n/g, '\n'));
  }

  function commitEdit() {
    if (!editCell) return;
    const { rowId, field } = editCell;
    const patch = { [field]: editVal };
    if (tab === 0) setEntries(prev => prev.map(r => r.id === rowId ? { ...r, ...patch } : r));
    else setTstRows(prev => prev.map(r => r.id === rowId ? { ...r, ...patch } : r));
    scheduleDbUpdate(rowId, patch, dbTable);
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

  function exportCSV() {
    const cs = cols.filter(c => !hiddenCols[tkey].has(c.k));
    const header = cs.map(c => `"${c.l}"`).join(',');
    const lines = rows.map(r => cs.map(c => `"${(r[c.k] || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`).join(','));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + header + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `${TNAMES[tab]}_${new Date().toLocaleDateString('zh-TW').replace(/\//g, '')}.csv`;
    a.click();
  }

  function renderCell(row, col) {
    if (hiddenCols[tkey].has(col.k)) return null;
    const isEd = editCell?.rowId === row.id && editCell?.field === col.k;
    const val = row[col.k] || '';

    if (col.ver) {
      return (
        <td key={col.k} style={{ width: col.w, minWidth: col.w, textAlign: 'center', padding: '1px 2px' }}>
          {isEd
            ? <input ref={editInputRef} className="mcs-ce" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Escape') cancelEdit(); if (e.key === 'Enter') { e.preventDefault(); commitEdit(); } }} style={{ width: '100%' }} />
            : <VerBadge val={val} color={row.ver_color} onDblClick={() => startEdit(row.id, 'ver', val)} onCycleColor={() => cycleVerColor(row.id)} />
          }
        </td>
      );
    }

    if (col.tog) {
      return (
        <td key={col.k} style={{ width: col.w, minWidth: col.w, textAlign: 'center', padding: '1px 2px' }}>
          <Badge val={val} onClick={() => toggleField(row.id, col.k, col.tog)} />
        </td>
      );
    }

    if (isEd) {
      return (
        <td key={col.k} style={{ width: col.w, minWidth: col.w, padding: '1px 2px' }}>
          {col.wrap
            ? <textarea ref={editInputRef} className="mcs-ce mcs-ce-long" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Escape') cancelEdit(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); } }} style={{ width: '100%' }} />
            : <input ref={editInputRef} className="mcs-ce" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Escape') cancelEdit(); if (e.key === 'Enter') { e.preventDefault(); commitEdit(); } }} style={{ width: '100%' }} />
          }
        </td>
      );
    }

    return (
      <td key={col.k} style={{ width: col.w, minWidth: col.w, padding: '1px 2px' }}>
        <div className={`mcs-cv${col.wrap ? ' mcs-cv-wrap' : ''}`} onDoubleClick={() => startEdit(row.id, col.k, val)} title={val}>
          {val || <span className="mcs-placeholder">·</span>}
        </div>
      </td>
    );
  }

  const tstPending = tstRows.filter(r => !r.result || !r.result.trim()).length;
  const allSel = selected.size === rows.length && rows.length > 0;
  const hasHidden = hiddenCols[tkey].size > 0;

  if (loading) return (
    <div className="mcs-loading"><Loader2 size={28} className="animate-spin" /><span>載入材料管制資料中…</span></div>
  );

  return (
    <div className="mcs-root">
      {/* Stats */}
      <div className="mcs-stats">
        {[
          { val: entries.length, label: '進場紀錄', cls: '' },
          { val: tstRows.length, label: '試驗項目', cls: '' },
          { val: tstPending, label: '待試驗', cls: 'mcs-stat-warn' },
          { val: tstRows.filter(r => r.result && r.result.trim()).length, label: '試驗完成', cls: 'mcs-stat-ok' },
        ].map(s => (
          <div key={s.label} className="mcs-stat">
            <span className={`mcs-stat-val ${s.cls}`}>{s.val}</span>
            <span className="mcs-stat-label">{s.label}</span>
          </div>
        ))}
        <div className="mcs-stat-sync">
          <span className={`mcs-sync-dot${saving ? ' saving' : ''}`} />
          <span className="mcs-sync-text">
            {saving ? '儲存中…' : lastSaved ? `已儲存 ${lastSaved.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : '即時同步至 Supabase'}
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mcs-toolbar">
        <div className="mcs-toolbar-group">
          <span className="mcs-grp-label">管制表</span>
          <div className="mcs-tabs">
            {TNAMES.map((n, i) => (
              <button key={i} className={`mcs-tab${tab === i ? ' active' : ''}`} onClick={() => { setTab(i); setSelected(new Set()); setEditCell(null); }}>{n}</button>
            ))}
          </div>
        </div>
        <div className="mcs-toolbar-group">
          <span className="mcs-grp-label">檔案</span>
          <button className="mcs-btn" onClick={exportCSV}><Download size={12} /> CSV</button>
          {tab === 1 && tstRows.length === 0 && (
            <button className="mcs-btn mcs-btn-seed" onClick={seedTst} disabled={seeding}>
              {seeding ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              載入預設範本
            </button>
          )}
        </div>
        <div className="mcs-toolbar-group">
          <span className="mcs-grp-label">表格</span>
          <button className="mcs-btn mcs-btn-add" onClick={addRow}><Plus size={12} /> 新增</button>
          <button className="mcs-btn mcs-btn-del" onClick={deleteSel} disabled={!selected.size}><Trash2 size={12} /> 刪除({selected.size})</button>
          <button className={`mcs-btn${showCols ? ' mcs-btn-active' : ''}`} onClick={() => setShowCols(v => !v)}>
            <Columns size={12} /> 欄位 {showCols ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        </div>
      </div>

      {showCols && (
        <div className="mcs-col-strip">
          <span className="mcs-col-label">欄位▸</span>
          {cols.map(c => (
            <span key={c.k} className={`mcs-col-chip${hiddenCols[tkey].has(c.k) ? ' hidden' : ''}`} onClick={() => togHidCol(c.k)}>{c.l}</span>
          ))}
          <span className={`mcs-col-chip mcs-col-reset${hasHidden ? '' : ' disabled'}`} onClick={() => hasHidden && resetHidCols()}>還原預設</span>
        </div>
      )}

      <div className="mcs-tbl-wrap">
        <table className="mcs-table">
          <thead>
            <tr>
              <th style={{ width: 28 }}>
                <input type="checkbox" checked={allSel} onChange={togAll} style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }} />
              </th>
              {cols.map(c => hiddenCols[tkey].has(c.k) ? null : (
                <th key={c.k} style={{ width: c.w, minWidth: c.w }}>{c.l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={cols.length + 1} className="mcs-empty">
                  <ClipboardCheck size={32} style={{ opacity: 0.2, margin: '0 auto 8px', display: 'block' }} />
                  <div>
                    {tab === 0
                      ? '尚無進場紀錄 — 點擊「新增」建立第一筆'
                      : '目前無資料 — 點擊「載入預設範本」插入範例資料，或「新增」手動建立'}
                  </div>
                </td>
              </tr>
            ) : rows.map(row => (
              <tr key={row.id} className={selected.has(row.id) ? 'sel' : ''}>
                <td style={{ textAlign: 'center', padding: '1px 2px' }}>
                  <input type="checkbox" checked={selected.has(row.id)} onChange={() => togSel(row.id)} style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }} />
                </td>
                {cols.map(c => renderCell(row, c))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mcs-footer">
        <span>共 {rows.length} 筆 · 已選 {selected.size} 筆 · {TNAMES[tab]}</span>
        <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '0.7rem' }}>
          雙擊儲存格編輯 · Esc 取消 · Enter 確認
          {tab === 1 && ' · 點擊標記切換 · ⬤ 版本顏色'}
        </span>
      </div>
    </div>
  );
}
