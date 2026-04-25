/* ============================================================
   MaterialControl.jsx — 材料管制
   Tab 0: 材料進場紀錄（material_entries）
   Tab 1: 檢試驗管制表（mcs_test）
   ============================================================ */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ClipboardCheck, Plus, Trash2, Download, Columns, RotateCcw, ChevronDown, ChevronUp, Loader2, Camera } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import './MaterialControl.css';

/* ── Column Definitions ── */
const VER_COL = { k: 'ver', l: 'VER', w: 68, ver: true };

/* 材料進場紀錄 columns */
const ENTRY_COLS = [
  { k: 'entry_date', l: '進場日期', w: 90 },
  { k: 'photos', l: '照片', w: 52, photoLink: true },
  { k: 'name', l: '材料名稱', w: 180, wrap: true },
  { k: 'spec', l: '規格', w: 130, wrap: true },
  { k: 'qty', l: '數量', w: 80 },
  { k: 'vendor', l: '廠商', w: 120 },
  { k: 'inspector', l: '監造人員', w: 100, dropdown: true },
  { k: 'remark', l: '備註', w: 200, wrap: true },
  { k: 'result', l: '判定', w: 72, resultToggle: true },
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

const RESULT_CYCLE = ['合格', '不合格', ''];
const RESULT_CFG = {
  '合格':  { color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  '不合格': { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};
const ISSUE_STATUS_CFG = {
  open:        { label: '待改善', color: '#ef4444' },
  in_progress: { label: '改善中', color: '#f59e0b' },
  resolved:    { label: '已改善', color: '#10b981' },
  verified:    { label: '已判定', color: '#6366f1' },
  waived:      { label: '免改善', color: '#6b7280' },
};

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

/* ── 行動版材料進場卡片 ── */
function MobileEntryCard({ row, photoCountMap, photoNavMap, issueStatusMap, navigate, projectId, selected, onToggleSel }) {
  const [expanded, setExpanded] = useState(false);
  const count = photoCountMap[row.id] || 0;
  const nav = (photoNavMap || {})[row.id] || 'none';
  const cfg = RESULT_CFG[row.result];
  const issueStatus = issueStatusMap[row.id];
  const isVerified = issueStatus === 'verified';
  return (
    <div className={`mcs-mc${selected ? ' mcs-mc-sel' : ''}`}>
      <div className="mcs-mc-head" onClick={() => setExpanded(e => !e)}>
        <input type="checkbox" checked={selected} onChange={() => onToggleSel(row.id)}
          onClick={e => e.stopPropagation()} style={{ accentColor: 'var(--color-primary)', flexShrink: 0 }} />
        <span className="mcs-mc-date">{row.entry_date || '—'}</span>
        <button className="mcs-photo-btn" title={count > 0 ? `查看 ${count} 筆照片記錄` : '新增照片記錄'}
          onClick={e => {
            e.stopPropagation();
            const autoQ = nav === 'linked' ? 'open' : nav === 'date' ? 'date' : 'new';
            const dateQ = nav === 'date' && row.entry_date ? `&src_date=${row.entry_date}` : '';
            navigate(`/projects/${projectId}/photos?src_table=material_entries&src_id=${row.id}&src_name=${encodeURIComponent(row.name || '材料照片')}&auto=${autoQ}${dateQ}`);
          }}>
          <Camera size={11} />{count > 0 ? count : ''}
        </button>
        <span className="mcs-mc-name">{row.name || '—'}</span>
        {row.result === '不合格' && issueStatus
          ? <span className="mcs-result-badge" style={isVerified ? { color: '#6366f1', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' } : { color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
              {isVerified ? '✅' : '⚠️'}
            </span>
          : cfg && <span className="mcs-result-badge" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}40` }}>{row.result}</span>
        }
        <ChevronDown size={12} style={{ marginLeft: 'auto', flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>
      {expanded && (
        <div className="mcs-mc-body">
          {[
            { l: '規格', v: row.spec },
            { l: '數量', v: row.qty },
            { l: '廠商', v: row.vendor },
            { l: '監造人員', v: row.inspector },
            { l: '備註', v: row.remark },
          ].filter(i => i.v).map(({ l, v }) => (
            <div key={l} className="mcs-mc-row">
              <span className="mcs-mc-label">{l}</span>
              <span className="mcs-mc-val">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */
export function MaterialControl() {
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  // Tab 0: material_entries, Tab 1: mcs_test
  const [entries, setEntries] = useState([]);
  const [tstRows, setTstRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [editCell, setEditCell] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [showCols, setShowCols] = useState(false);
  const [hiddenCols, setHiddenCols] = useState({ entry: new Set(), tst: new Set() });
  const [seeding, setSeeding] = useState(false);
  const [supervisorOptions, setSupervisorOptions] = useState([]);
  const [isMobile, setIsMobile] = useState(false);

  // 照片計數 & 導航模式 & 缺失改善狀態 (僅 Tab 0 用)
  const [photoCountMap, setPhotoCountMap] = useState({});
  const [photoNavMap,   setPhotoNavMap]   = useState({}); // 'linked' | 'date' | 'none'
  const [issueStatusMap, setIssueStatusMap] = useState({});

  // 試驗管制材料提示 toast
  const [tstToast, setTstToast] = useState(null);
  // { type: 'match'|'nomatch', matched: tstRow|null, entry: entryRow }

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

  const loadSupervisor = useCallback(async () => {
    if (!supabase) return '';
    const { data } = await supabase.from('projects').select('supervisor_name').eq('id', projectId).single();
    return data?.supervisor_name || '';
  }, [projectId]);

  async function loadPhotoMaps(entries) {
    if (!supabase) return { countMap: {}, navMap: {} };
    const entryDates = [...new Set((entries || []).map(e => e.entry_date).filter(Boolean))];
    const [{ data: linked }, { data: dated }] = await Promise.all([
      supabase.from('archive_docs').select('submission_id')
        .eq('project_id', projectId).eq('category', 'photo').eq('source_table', 'material_entries'),
      entryDates.length > 0
        ? supabase.from('archive_docs').select('doc_date')
            .eq('project_id', projectId).eq('category', 'photo').in('doc_date', entryDates)
        : Promise.resolve({ data: [] }),
    ]);
    const linkedMap = {};
    for (const r of (linked || [])) {
      if (r.submission_id) linkedMap[r.submission_id] = (linkedMap[r.submission_id] || 0) + 1;
    }
    const dateCountMap = {};
    for (const r of (dated || [])) {
      if (r.doc_date) dateCountMap[r.doc_date] = (dateCountMap[r.doc_date] || 0) + 1;
    }
    const countMap = {}, navMap = {};
    for (const e of (entries || [])) {
      const lc = linkedMap[e.id] || 0;
      const dc = lc === 0 && e.entry_date ? (dateCountMap[e.entry_date] || 0) : 0;
      countMap[e.id] = lc + dc;
      navMap[e.id] = lc > 0 ? 'linked' : dc > 0 ? 'date' : 'none';
    }
    return { countMap, navMap };
  }

  async function loadIssueStatusMap() {
    if (!supabase) return {};
    const { data } = await supabase.from('quality_issues')
      .select('source_record_id, status')
      .eq('project_id', projectId)
      .eq('source_table', 'material_entries');
    const map = {};
    for (const row of (data || [])) {
      if (row.source_record_id) map[row.source_record_id] = row.status;
    }
    return map;
  }

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const [e, t, is, sv] = await Promise.all([
        loadEntries(), loadTst(), loadIssueStatusMap(), loadSupervisor(),
      ]);
      const { countMap, navMap } = await loadPhotoMaps(e);
      setEntries(e);
      setTstRows(t);
      setPhotoCountMap(countMap);
      setPhotoNavMap(navMap);
      setIssueStatusMap(is);
      setSupervisorOptions((sv || '').split('\n').map(s => s.trim()).filter(Boolean));
      setLoading(false);
    }
    if (projectId) init();
  }, [projectId, loadEntries, loadTst, loadSupervisor]);

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
    try {
      let newRow;
      if (tab === 0) {
        newRow = { project_id: projectId, created_by: user?.id, entry_date: new Date().toISOString().split('T')[0], name: '', spec: '', qty: '', vendor: '', inspector: '', remark: '' };
      } else {
        newRow = { ver: 'v1', ver_color: VER_COLORS[0], project_id: projectId, created_by: user?.id, sort_order: tstRows.length };
        TST_COLS.forEach(c => { if (!(c.k in newRow)) newRow[c.k] = ''; });
      }
      const { data, error } = await supabase.from(dbTable).insert([newRow]).select().single();
      if (error) throw error;
      if (tab === 0) setEntries(prev => [data, ...prev]);
      else setTstRows(prev => [...prev, data]);
    } catch (err) {
      console.error('新增資料列失敗:', err);
      alert(`新增失敗：${err.message || '未知錯誤'}`);
    }
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
    if (tab === 0) {
      setEntries(prev => prev.map(r => r.id === rowId ? { ...r, ...patch } : r));
      if (field === 'name' && editVal.trim()) {
        const entry = entries.find(r => r.id === rowId);
        if (entry) checkTestControlled({ ...entry, name: editVal });
      }
    } else {
      setTstRows(prev => prev.map(r => r.id === rowId ? { ...r, ...patch } : r));
    }
    scheduleDbUpdate(rowId, patch, dbTable);
    setEditCell(null); setEditVal('');
  }

  function cancelEdit() { setEditCell(null); setEditVal(''); }

  function checkTestControlled(entry) {
    if (!entry.name || !entry.name.trim()) return;
    const name4 = entry.name.trim().slice(0, 4);
    const matched = tstRows.find(t => t.name && t.name.includes(name4));
    setTstToast(matched
      ? { type: 'match', matched, entry }
      : { type: 'nomatch', matched: null, entry }
    );
  }

  async function confirmTstAction() {
    if (!tstToast) return;
    if (tstToast.type === 'match') {
      const { matched, entry } = tstToast;
      const today = new Date().toISOString().split('T')[0];
      await supabase.from('mcs_test').update({
        a_date: entry.entry_date || today,
        cum_qty: entry.qty || matched.cum_qty || '',
      }).eq('id', matched.id);
      setTstRows(prev => prev.map(r => r.id === matched.id
        ? { ...r, a_date: entry.entry_date || today, cum_qty: entry.qty || r.cum_qty }
        : r
      ));
      if (window.confirm(`同時建立「${entry.name}」的材料抽查記錄？`)) {
        await supabase.from('construction_inspections').insert({
          project_id: projectId,
          created_by: user?.id,
          inspect_date: entry.entry_date || today,
          work_item: entry.name,
          location: entry.spec || '',
          inspect_type: '材料抽查',
          result: '',
          inspector: '',
        });
      }
    } else {
      const name4 = tstToast.entry.name.trim().slice(0, 4);
      const newRow = {
        ver: 'v1', ver_color: VER_COLORS[0], project_id: projectId, created_by: user?.id,
        sort_order: tstRows.length, name: tstToast.entry.name,
        a_date: tstToast.entry.entry_date || '', qty: tstToast.entry.qty || '',
        no: '', ci: '', freq: '',
      };
      TST_COLS.forEach(c => { if (!(c.k in newRow)) newRow[c.k] = ''; });
      const { data } = await supabase.from('mcs_test').insert([newRow]).select().single();
      if (data) setTstRows(prev => [...prev, data]);
      setTab(1);
    }
    setTstToast(null);
  }

  async function handleMaterialResult(row) {
    const cur = row.result || '';
    const next = RESULT_CYCLE[(RESULT_CYCLE.indexOf(cur) + 1) % RESULT_CYCLE.length];
    const patch = { result: next || null };
    setEntries(prev => prev.map(r => r.id === row.id ? { ...r, result: next || null } : r));
    await supabase.from('material_entries').update(patch).eq('id', row.id);

    if (next === '不合格') {
      const { data: existing } = await supabase.from('quality_issues')
        .select('id').eq('project_id', projectId)
        .eq('source_table', 'material_entries').eq('source_record_id', row.id).maybeSingle();
      if (!existing && confirm(`「${row.name || '此材料'}」判定不合格，是否建立缺失改善單？`)) {
        const today = new Date().toISOString().split('T')[0];
        const { data: issue } = await supabase.from('quality_issues').insert([{
          project_id: projectId, created_by: user?.id,
          inspection_date: row.entry_date || today,
          item: row.name || '材料判定不合格',
          location: row.spec || '',
          severity: 'major', status: 'open',
          source_table: 'material_entries', source_record_id: row.id,
        }]).select('id, status').single();
        if (issue) setIssueStatusMap(prev => ({ ...prev, [row.id]: issue.status }));
      } else if (existing) {
        setIssueStatusMap(prev => ({ ...prev, [row.id]: prev[row.id] || 'open' }));
      }
    } else if (next === '合格' || next === '') {
      setIssueStatusMap(prev => { const m = { ...prev }; delete m[row.id]; return m; });
    }
  }

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
    const cs = cols.filter(c => !hiddenCols[tkey].has(c.k) && !c.photoLink);
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

    if (col.photoLink) {
      const count = photoCountMap[row.id] || 0;
      const nav = photoNavMap[row.id] || 'none';
      const autoQ = nav === 'linked' ? 'open' : nav === 'date' ? 'date' : 'new';
      const dateQ = nav === 'date' && row.entry_date ? `&src_date=${row.entry_date}` : '';
      return (
        <td key={col.k} style={{ width: col.w, minWidth: col.w, textAlign: 'center', padding: '1px 2px' }}>
          <button className="mcs-photo-btn" title={count > 0 ? `查看 ${count} 筆照片記錄` : '新增照片記錄'}
            onClick={() => navigate(`/projects/${projectId}/photos?src_table=material_entries&src_id=${row.id}&src_name=${encodeURIComponent(row.name || '材料照片')}&auto=${autoQ}${dateQ}`)}>
            <Camera size={11} />
            {count > 0 ? count : ''}
          </button>
        </td>
      );
    }

    if (col.dropdown) {
      return (
        <td key={col.k} style={{ width: col.w, minWidth: col.w, padding: '1px 2px' }}>
          <select className="mcs-sel" value={val}
            onChange={e => {
              const v = e.target.value;
              setEntries(prev => prev.map(r => r.id === row.id ? { ...r, [col.k]: v } : r));
              scheduleDbUpdate(row.id, { [col.k]: v });
            }}>
            <option value="">—</option>
            {supervisorOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            {val && !supervisorOptions.includes(val) && <option value={val}>{val}</option>}
          </select>
        </td>
      );
    }

    if (col.resultToggle) {
      const issueStatus = issueStatusMap[row.id];
      if (row.result === '不合格' && issueStatus) {
        const cfg = ISSUE_STATUS_CFG[issueStatus] || ISSUE_STATUS_CFG.open;
        const isVerified = issueStatus === 'verified';
        return (
          <td key={col.k} style={{ width: col.w, minWidth: col.w, textAlign: 'center', padding: '1px 2px' }}>
            <span className={`mcs-result-badge${isVerified ? ' closed' : ' fail'}`}
              title={isVerified ? '缺失已判定結案' : `缺失${cfg.label}，點擊切換`}
              onClick={() => !isVerified && handleMaterialResult(row)}
              style={{ cursor: isVerified ? 'default' : 'pointer' }}>
              {isVerified ? '✅ 結案' : `⚠️ ${cfg.label}`}
            </span>
          </td>
        );
      }
      const cfg = RESULT_CFG[row.result];
      return (
        <td key={col.k} style={{ width: col.w, minWidth: col.w, textAlign: 'center', padding: '1px 2px' }}>
          <span className="mcs-result-badge" title="點擊切換判定結果"
            onClick={() => handleMaterialResult(row)}
            style={cfg ? { color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}40`, cursor: 'pointer' } : { cursor: 'pointer' }}>
            {row.result || '—'}
          </span>
        </td>
      );
    }

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
  const failCount = entries.filter(r => r.result === '不合格').length;
  const okCount = entries.filter(r => r.result === '合格').length;

  if (loading) return (
    <div className="mcs-loading"><Loader2 size={28} className="animate-spin" /><span>載入材料管制資料中…</span></div>
  );

  return (
    <div className="mcs-root">
      {/* Stats */}
      <div className="mcs-stats">
        {(tab === 0 ? [
          { val: entries.length, label: '進場紀錄', cls: '' },
          { val: okCount, label: '判定合格', cls: 'mcs-stat-ok' },
          { val: failCount, label: '判定不合格', cls: failCount > 0 ? 'mcs-stat-warn' : '' },
          { val: entries.filter(r => !r.result).length, label: '待判定', cls: '' },
        ] : [
          { val: entries.length, label: '進場紀錄', cls: '' },
          { val: tstRows.length, label: '試驗項目', cls: '' },
          { val: tstPending, label: '待試驗', cls: 'mcs-stat-warn' },
          { val: tstRows.filter(r => r.result && r.result.trim()).length, label: '試驗完成', cls: 'mcs-stat-ok' },
        ]).map(s => (
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
          {cols.filter(c => !c.photoLink && !c.resultToggle).map(c => (
            <span key={c.k} className={`mcs-col-chip${hiddenCols[tkey].has(c.k) ? ' hidden' : ''}`} onClick={() => togHidCol(c.k)}>{c.l}</span>
          ))}
          <span className={`mcs-col-chip mcs-col-reset${hasHidden ? '' : ' disabled'}`} onClick={() => hasHidden && resetHidCols()}>還原預設</span>
        </div>
      )}

      {isMobile && tab === 0 ? (
        <div className="mcs-card-list">
          {rows.length === 0 ? (
            <div className="mcs-empty">
              <ClipboardCheck size={32} style={{ opacity: 0.2, margin: '0 auto 8px', display: 'block' }} />
              <div>尚無進場紀錄 — 點擊「新增」建立第一筆</div>
            </div>
          ) : rows.map(row => (
            <MobileEntryCard key={row.id} row={row} photoCountMap={photoCountMap} photoNavMap={photoNavMap}
              issueStatusMap={issueStatusMap} navigate={navigate} projectId={projectId}
              selected={selected.has(row.id)} onToggleSel={togSel} />
          ))}
        </div>
      ) : (
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
      )}

      <div className="mcs-footer">
        <span>共 {rows.length} 筆 · 已選 {selected.size} 筆 · {TNAMES[tab]}</span>
        <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '0.7rem' }}>
          {isMobile && tab === 0
            ? '點擊卡片展開詳情'
            : `雙擊儲存格編輯 · Esc 取消 · Enter 確認${tab === 1 ? ' · 點擊標記切換 · ⬤ 版本顏色' : ' · 點擊判定欄切換結果 · 點擊📷查看照片'}`
          }
        </span>
      </div>

      {/* 試驗管制材料提示 Toast */}
      {tstToast && (
        <div className="mcs-tst-toast">
          <div className="mcs-tst-toast-msg">
            {tstToast.type === 'match'
              ? <>⚗️ 「{tstToast.entry.name}」已列於試驗管制表第 {tstToast.matched.no} 項，是否更新實際進場日期？</>
              : <>📋 「{tstToast.entry.name}」未在試驗管制表中，是否加入？</>
            }
          </div>
          <div className="mcs-tst-toast-actions">
            <button className="mcs-btn mcs-btn-add" onClick={confirmTstAction}>
              {tstToast.type === 'match' ? '更新管制表' : '加入管制表'}
            </button>
            <button className="mcs-btn" onClick={() => setTstToast(null)}>略過</button>
          </div>
        </div>
      )}
    </div>
  );
}
