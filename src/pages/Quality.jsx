/* ============================================================
   Quality.jsx — 品質管理
   Tab 0: 施工檢驗管制（construction_inspections）
   Tab 1: 缺失改善管制（quality_issues）
   ============================================================ */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Plus, Trash2, Loader2, ShieldCheck, AlertTriangle, ClipboardCheck, X, FlaskConical, CheckCircle2, Camera, Printer, FileText } from 'lucide-react';
import InspectionFormModal from '../components/InspectionFormModal';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../hooks/useProject';
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

const TNAMES = ['施工檢驗管制', '缺失改善管制', '試驗報告管制'];

const WORK_ITEMS_PRESET = [
  '基礎開挖', '鋼筋綁紮', '模板安裝', '混凝土澆置', '土方回填',
  '瀝青鋪設', '基樁施工', '植筋工程', '防水工程', '安全設施',
  '鋼筋進場', '混凝土進場', '材料進場驗收',
];

const EMPTY_INSPECT = {
  inspect_date: new Date().toISOString().split('T')[0],
  work_item: '', location: '', inspect_type: '', inspector: '', result: '待複驗', remark: '',
};
const EMPTY_QUALITY = {
  inspection_date: new Date().toISOString().split('T')[0],
  location: '', item: '', severity: 'major', description: '', responsible: '', deadline: '', remark: '',
};

/* ── Mobile Card: 施工檢驗 ── */
function MobileInspCard({ row, inspPhotoMap, issueByInspMap, navigate, projectId, selected, onToggleSel, onCycleResult }) {
  const [expanded, setExpanded] = useState(false);
  const resCfg = INSPECT_RESULT[row.result] || INSPECT_RESULT['待複驗'];
  const iss = issueByInspMap[row.id];
  const issueCfg = iss ? (RESOLVE_STATUS[iss.status] || RESOLVE_STATUS.open) : null;
  const issueClosed = iss && (iss.status === 'verified' || iss.status === 'waived');
  const photoCount = inspPhotoMap[row.id] || 0;

  return (
    <div className={`mcs-mc${selected ? ' mcs-mc-sel' : ''}`}>
      <div className="mcs-mc-head" onClick={() => setExpanded(e => !e)}>
        <input type="checkbox" checked={selected} onChange={onToggleSel} onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }} />
        <span className="mcs-mc-date">{row.inspect_date || '—'}</span>
        <button className="mcs-photo-btn" title="照片"
          onClick={e => { e.stopPropagation(); navigate(`/projects/${projectId}/photos?src_table=construction_inspections&src_id=${row.id}&src_name=${encodeURIComponent((row.work_item || '施工抽查') + (row.location ? ' ' + row.location : ''))}`); }}>
          <Camera size={11} />{photoCount > 0 ? photoCount : ''}
        </button>
        <span className="mcs-mc-name">{row.work_item || '—'}</span>
        <span onClick={e => { e.stopPropagation(); onCycleResult(row.id, row.result); }}
          style={{ flexShrink: 0, padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            color: resCfg.color, background: resCfg.bg, border: `1px solid ${resCfg.color}40` }}>
          {row.result || '待複驗'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '14px', color: 'var(--color-text-muted)', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="mcs-mc-body">
          {[
            { label: '部位', value: row.location },
            { label: '檢驗類型', value: row.inspect_type },
            { label: '人員', value: row.inspector },
            { label: '缺失狀態', value: iss ? (issueClosed ? '✅ 結案' : issueCfg?.label) : (row.result === '不合格' ? '無缺失單' : null) },
            { label: '備註', value: row.remark },
          ].filter(f => f.value).map(f => (
            <div key={f.label} className="mcs-mc-row">
              <span className="mcs-mc-label">{f.label}</span>
              <span className="mcs-mc-val">{f.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */
export function Quality() {
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { project } = useProject(projectId);
  const [printRow, setPrintRow] = useState(null);
  const [formRow,  setFormRow]  = useState(null);
  const [tab, setTab] = useState(0);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  // Tab 0: construction_inspections
  const [inspections, setInspections] = useState([]);
  const [inspFilter, setInspFilter] = useState('all');
  const [inspItemFilter, setInspItemFilter] = useState(null);
  const [showInspModal, setShowInspModal] = useState(false);
  const [inspForm, setInspForm] = useState({ ...EMPTY_INSPECT });

  // Tab 1: quality_issues
  const [issues, setIssues] = useState([]);
  const [issueFilter, setIssueFilter] = useState('all');
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueForm, setIssueForm] = useState({ ...EMPTY_QUALITY });

  // Tab 2: mcs_test 試驗報告
  const [tests, setTests] = useState([]);
  const [testFilter, setTestFilter] = useState('all');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [editCell, setEditCell] = useState(null);
  const [editVal, setEditVal] = useState('');
  const editInputRef = useRef(null);
  const [verifyTarget, setVerifyTarget] = useState(null); // { id, item, location }
  const [verifyChecks, setVerifyChecks] = useState([]);
  const [verifyNote, setVerifyNote] = useState('');

  // 施工抽查照片計數
  const [inspPhotoMap, setInspPhotoMap] = useState({});

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

  const loadTests = useCallback(async () => {
    if (!supabase) return [];
    const { data } = await supabase.from('mcs_test').select('*')
      .eq('project_id', projectId).order('created_at', { ascending: false });
    return data || [];
  }, [projectId]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const [ins, iss, tsts] = await Promise.all([loadInspections(), loadIssues(), loadTests()]);
      setInspections(ins);
      setIssues(iss);
      setTests(tsts);
      // 照片計數
      if (supabase) {
        const { data: photoDocs } = await supabase.from('archive_docs').select('submission_id')
          .eq('project_id', projectId).eq('source_table', 'construction_inspections');
        const map = {};
        for (const r of (photoDocs || [])) {
          if (r.submission_id) map[r.submission_id] = (map[r.submission_id] || 0) + 1;
        }
        setInspPhotoMap(map);
      }
      setLoading(false);
    }
    if (projectId) init();
  }, [projectId, loadInspections, loadIssues, loadTests]);

  useEffect(() => {
    if (editCell) setTimeout(() => editInputRef.current?.focus(), 10);
  }, [editCell]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 以 source_record_id 索引缺失改善（施工抽查用）
  const issueByInspMap = useMemo(() => {
    const map = {};
    for (const iss of issues) {
      if (iss.source_table === 'construction_inspections' && iss.source_record_id) {
        map[iss.source_record_id] = iss;
      }
    }
    return map;
  }, [issues]);

  /* ── Tab 0: Inspections ── */
  async function addInspection() {
    if (!supabase || !inspForm.work_item.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('construction_inspections').insert([{
        project_id: projectId, created_by: user?.id, ...inspForm,
      }]).select().single();
      if (error) throw error;
      if (data) {
        setInspections(prev => [data, ...prev]);
        if (inspForm.result === '不合格') {
          const today = new Date().toISOString().split('T')[0];
          if (confirm(`此抽查結果為「不合格」，是否立即建立缺失改善單？\n\n工項：${inspForm.work_item}\n位置：${inspForm.location || '（未填）'}`)) {
            const { data: issue } = await supabase.from('quality_issues').insert([{
              project_id: projectId, created_by: user?.id,
              inspection_date: inspForm.inspect_date || today,
              location: inspForm.location || null,
              item: inspForm.work_item,
              severity: 'major', status: 'open',
              description: inspForm.remark || null,
              source_table: 'construction_inspections', source_record_id: data.id,
            }]).select().single();
            if (issue) setIssues(prev => [issue, ...prev]);
          }
        }
      }
      setShowInspModal(false);
      setInspForm({ ...EMPTY_INSPECT });
    } catch (err) {
      console.error('新增檢驗失敗:', err);
      alert(`新增檢驗失敗：${err.message || '未知錯誤'}`);
    }
    setSaving(false);
  }

  async function cycleInspResult(id, cur) {
    if (!supabase) return;
    const next = RESULT_CYCLE[(RESULT_CYCLE.indexOf(cur) + 1) % RESULT_CYCLE.length];
    await supabase.from('construction_inspections').update({ result: next }).eq('id', id);
    setInspections(prev => prev.map(r => r.id === id ? { ...r, result: next } : r));
    if (next === '不合格' && !issueByInspMap[id]) {
      const row = inspections.find(r => r.id === id);
      const today = new Date().toISOString().split('T')[0];
      if (row && confirm(`抽查結果改為「不合格」，是否建立缺失改善單？\n\n工項：${row.work_item}\n位置：${row.location || '（未填）'}`)) {
        const { data: issue } = await supabase.from('quality_issues').insert([{
          project_id: projectId, created_by: user?.id,
          inspection_date: row.inspect_date || today,
          location: row.location || null,
          item: row.work_item,
          severity: 'major', status: 'open',
          source_table: 'construction_inspections', source_record_id: id,
        }]).select().single();
        if (issue) setIssues(prev => [issue, ...prev]);
      }
    }
  }

  /* ── Tab 1: Quality Issues ── */
  async function addIssue() {
    if (!supabase || !issueForm.item.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('quality_issues').insert([{
        project_id: projectId, created_by: user?.id, status: 'open',
        ...issueForm, deadline: issueForm.deadline || null,
      }]).select().single();
      if (error) throw error;
      if (data) setIssues(prev => [data, ...prev]);
      setShowIssueModal(false);
      setIssueForm({ ...EMPTY_QUALITY });
    } catch (err) {
      console.error('新增缺失失敗:', err);
      alert(`新增缺失失敗：${err.message || '未知錯誤'}`);
    }
    setSaving(false);
  }

  async function cycleIssueStatus(id, cur) {
    if (!supabase) return;
    const next = RESOLVE_CYCLE[(RESOLVE_CYCLE.indexOf(cur) + 1) % RESOLVE_CYCLE.length];
    await supabase.from('quality_issues').update({ status: next }).eq('id', id);
    setIssues(prev => prev.map(r => r.id === id ? { ...r, status: next } : r));
  }

  /* ── Tab 2: 試驗報告 ── */
  const TEST_RESULT_CYCLE = ['待審閱', '審閱中', '可入', '不可入'];
  const TEST_RESULT_CFG = {
    '待審閱': { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
    '審閱中': { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    '可入':   { color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    '不可入': { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  };

  async function cycleTestResult(id, cur) {
    if (!supabase) return;
    const next = TEST_RESULT_CYCLE[(TEST_RESULT_CYCLE.indexOf(cur) + 1) % TEST_RESULT_CYCLE.length];
    await supabase.from('mcs_test').update({ result: next }).eq('id', id);
    setTests(prev => prev.map(r => r.id === id ? { ...r, result: next } : r));
  }

  const testStats = TEST_RESULT_CYCLE.reduce((acc, r) => {
    acc[r] = tests.filter(t => (t.result || '待審閱') === r).length;
    return acc;
  }, {});
  const filteredTests = testFilter === 'all' ? tests : tests.filter(t => (t.result || '待審閱') === testFilter);

  /* ── 驗收申請 ── */
  const VERIFY_CHECKLIST = [
    '缺失改善項目已完成',
    '改善工法符合規範要求',
    '相關材料已通過送審',
    '現場照片已留存',
    '廠商已確認簽章',
  ];

  function openVerify(row) {
    setVerifyTarget({ id: row.id, item: row.item, location: row.location });
    setVerifyChecks([]);
    setVerifyNote('');
  }

  async function submitVerify() {
    if (!verifyTarget || !supabase) return;
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('quality_issues').update({
      status: 'verified',
      resolve_date: today,
      remark: verifyNote ? `驗收確認：${verifyNote}` : '驗收確認完成',
    }).eq('id', verifyTarget.id);
    setIssues(prev => prev.map(r => r.id === verifyTarget.id
      ? { ...r, status: 'verified', resolve_date: today, remark: verifyNote ? `驗收確認：${verifyNote}` : '驗收確認完成' }
      : r
    ));
    setVerifyTarget(null);
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
    } else if (table === 'quality_issues') {
      setIssues(prev => prev.map(r => r.id === id ? { ...r, [field]: editVal } : r));
    } else if (table === 'mcs_test') {
      setTests(prev => prev.map(r => r.id === id ? { ...r, [field]: editVal } : r));
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
    } else if (tab === 1) {
      await supabase.from('quality_issues').delete().in('id', ids);
      setIssues(prev => prev.filter(r => !selected.has(r.id)));
    } else if (tab === 2) {
      await supabase.from('mcs_test').delete().in('id', ids);
      setTests(prev => prev.filter(r => !selected.has(r.id)));
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
  const filteredInsp = inspections
    .filter(r => inspFilter === 'all' || r.result === inspFilter)
    .filter(r => !inspItemFilter || (r.work_item || '未分類') === inspItemFilter);
  const filteredIssues = issueFilter === 'all' ? issues : issues.filter(r => r.status === issueFilter);

  /* 施工抽查 — 依工項分組統計 */
  const workItemGroups = React.useMemo(() => {
    const map = {};
    inspections.forEach(r => {
      const k = r.work_item || '未分類';
      if (!map[k]) map[k] = { name: k, pass: 0, fail: 0, pending: 0 };
      if (r.result === '合格') map[k].pass++;
      else if (r.result === '不合格') map[k].fail++;
      else map[k].pending++;
    });
    return Object.values(map).sort((a, b) => (b.pass + b.fail + b.pending) - (a.pass + a.fail + a.pending));
  }, [inspections]);
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
        ) : tab === 1 ? (
          RESOLVE_CYCLE.map(s => {
            const cfg = RESOLVE_STATUS[s];
            return (
              <div key={s} className="mcs-stat" style={{ cursor: 'pointer' }} onClick={() => setIssueFilter(f => f === s ? 'all' : s)}>
                <span className="mcs-stat-val" style={{ color: cfg.color }}>{issueStats[s] || 0}</span>
                <span className="mcs-stat-label">{cfg.label}</span>
              </div>
            );
          })
        ) : (
          TEST_RESULT_CYCLE.map(r => {
            const cfg = TEST_RESULT_CFG[r];
            return (
              <div key={r} className="mcs-stat" style={{ cursor: 'pointer' }} onClick={() => setTestFilter(f => f === r ? 'all' : r)}>
                <span className="mcs-stat-val" style={{ color: cfg.color }}>{testStats[r] || 0}</span>
                <span className="mcs-stat-label">{r}</span>
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
                onClick={() => { setTab(i); setSelected(new Set()); setEditCell(null); setInspFilter('all'); setIssueFilter('all'); setTestFilter('all'); setInspItemFilter(null); }}>
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
          {tab < 2 && (
            <button className="mcs-btn mcs-btn-add" onClick={() => tab === 0 ? setShowInspModal(true) : setShowIssueModal(true)}>
              <Plus size={12} /> 新增{tab === 0 ? '檢驗' : '缺失'}
            </button>
          )}
          {tab === 0 && (
            <button className="mcs-btn mcs-btn-add" onClick={() => setFormRow({})}>
              <FileText size={12} /> 新增抽查單
            </button>
          )}
        </div>
      </div>

      {/* Tab 0: 施工抽查 — 工項分組總覽 */}
      {tab === 0 && workItemGroups.length > 0 && (
        <div style={{ padding: '0 0 8px 0', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg2)', color: 'var(--color-text-muted)' }}>
                <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>工項</th>
                <th style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid var(--color-border)', color: '#10b981' }}>合格</th>
                <th style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid var(--color-border)', color: '#ef4444' }}>不合格</th>
                <th style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid var(--color-border)', color: '#f59e0b' }}>待複驗</th>
                <th style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>合計</th>
                <th style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>合格率</th>
              </tr>
            </thead>
            <tbody>
              {workItemGroups.map(g => {
                const total = g.pass + g.fail + g.pending;
                const rate = total > 0 ? Math.round((g.pass / total) * 100) : 0;
                const isActive = inspItemFilter === g.name;
                return (
                  <tr key={g.name}
                    onClick={() => setInspItemFilter(f => f === g.name ? null : g.name)}
                    style={{ cursor: 'pointer', background: isActive ? 'rgba(var(--color-primary-rgb),0.08)' : undefined,
                      borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '3px 8px', fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--color-primary-light)' : 'var(--color-text1)' }}>
                      {g.name}
                    </td>
                    <td style={{ padding: '3px 8px', textAlign: 'center', color: '#10b981', fontWeight: 600 }}>{g.pass || '—'}</td>
                    <td style={{ padding: '3px 8px', textAlign: 'center', color: g.fail > 0 ? '#ef4444' : 'var(--color-text-muted)', fontWeight: g.fail > 0 ? 600 : 400 }}>{g.fail || '—'}</td>
                    <td style={{ padding: '3px 8px', textAlign: 'center', color: g.pending > 0 ? '#f59e0b' : 'var(--color-text-muted)' }}>{g.pending || '—'}</td>
                    <td style={{ padding: '3px 8px', textAlign: 'center', color: 'var(--color-text2)' }}>{total}</td>
                    <td style={{ padding: '3px 8px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', padding: '1px 5px', borderRadius: 3, fontSize: '10px', fontWeight: 600,
                        background: rate === 100 ? 'rgba(16,185,129,0.1)' : rate >= 80 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                        color: rate === 100 ? '#10b981' : rate >= 80 ? '#f59e0b' : '#ef4444' }}>
                        {rate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {inspItemFilter && (
            <div style={{ padding: '4px 8px', fontSize: '10px', color: 'var(--color-text-muted)' }}>
              篩選工項：<strong style={{ color: 'var(--color-primary-light)' }}>{inspItemFilter}</strong>
              <span onClick={() => setInspItemFilter(null)} style={{ marginLeft: 8, cursor: 'pointer', color: 'var(--color-danger)', textDecoration: 'underline' }}>清除篩選</span>
            </div>
          )}
        </div>
      )}

      {/* Tab 0: 施工檢驗管制 */}
      {tab === 0 && (
        isMobile ? (
          <div className="mcs-card-list">
            {filteredInsp.length === 0 ? (
              <div className="mcs-empty" style={{ padding: '32px 16px', textAlign: 'center' }}>
                <ShieldCheck size={28} style={{ opacity: 0.2, margin: '0 auto 8px', display: 'block' }} />
                <div>尚無施工檢驗記錄 — 點擊「新增檢驗」建立</div>
              </div>
            ) : filteredInsp.map(row => (
              <MobileInspCard key={row.id}
                row={row}
                inspPhotoMap={inspPhotoMap}
                issueByInspMap={issueByInspMap}
                navigate={navigate}
                projectId={projectId}
                selected={selected.has(row.id)}
                onToggleSel={() => togSel(row.id)}
                onCycleResult={cycleInspResult}
              />
            ))}
          </div>
        ) : (
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
                  <th style={{ width: 90 }}>缺失狀態</th>
                  <th style={{ width: 52 }}>照片</th>
                  <th>備註</th>
                  <th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredInsp.length === 0 ? (
                  <tr><td colSpan={10} className="mcs-empty">
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
                      <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                        {(() => {
                          const iss = issueByInspMap[row.id];
                          if (!iss) return row.result === '不合格' ? <span style={{ fontSize: '10px', color: '#94a3b8' }}>無缺失單</span> : null;
                          const cfg = RESOLVE_STATUS[iss.status] || RESOLVE_STATUS.open;
                          const closed = iss.status === 'verified' || iss.status === 'waived';
                          return (
                            <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                              color: cfg.color, background: `${cfg.color}15`, border: `1px solid ${cfg.color}40` }}>
                              {closed ? '✅ 結案' : cfg.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                        <button className="mcs-photo-btn" title="點擊查看/上傳照片記錄"
                          onClick={() => navigate(`/projects/${projectId}/photos?src_table=construction_inspections&src_id=${row.id}&src_name=${encodeURIComponent((row.work_item || '施工抽查') + (row.location ? ' ' + row.location : ''))}`)}>
                          <Camera size={11} />
                          {inspPhotoMap[row.id] > 0 ? inspPhotoMap[row.id] : ''}
                        </button>
                      </td>
                      <td style={{ padding: '2px 4px' }}>
                        <EditableCell id={row.id} field="remark" table="construction_inspections" val={row.remark} />
                      </td>
                      <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                        <button className="mcs-photo-btn" title="填寫標準抽查單" onClick={() => setFormRow(row)}>
                          <FileText size={11} />
                        </button>
                        <button className="mcs-photo-btn" title="列印抽查單" onClick={() => setPrintRow(row)}>
                          <Printer size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
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
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                        <span onClick={() => cycleIssueStatus(row.id, row.status)} title="點擊切換狀態"
                          style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer',
                            color: resCfg.color, border: `1px solid ${resCfg.color}40`, background: `${resCfg.color}10` }}>
                          {resCfg.label}
                        </span>
                        {row.status === 'resolved' && (
                          <button onClick={() => openVerify(row)}
                            style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '1px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: 600,
                              background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer' }}>
                            <ClipboardCheck size={9} />申請驗收
                          </button>
                        )}
                      </div>
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

      {/* Tab 2: 試驗報告管制 */}
      {tab === 2 && (
        <div className="mcs-tbl-wrap">
          <table className="mcs-table">
            <thead>
              <tr>
                <th style={{ width: 28 }}>
                  <input type="checkbox"
                    checked={filteredTests.length > 0 && selected.size === filteredTests.length}
                    onChange={() => setSelected(selected.size === filteredTests.length ? new Set() : new Set(filteredTests.map(r => r.id)))} />
                </th>
                <th style={{ width: 36 }}>#</th>
                <th style={{ width: 88 }}>契約項次</th>
                <th style={{ width: 180 }}>材料/設備名稱</th>
                <th style={{ width: 200 }}>抽樣頻率</th>
                <th style={{ width: 82 }}>預定進場</th>
                <th style={{ width: 82 }}>實際進場</th>
                <th style={{ width: 76 }}>累積進場</th>
                <th style={{ width: 72 }}>累積抽樣</th>
                <th style={{ width: 80 }}>可入判定</th>
                <th>備註</th>
              </tr>
            </thead>
            <tbody>
              {filteredTests.length === 0 ? (
                <tr><td colSpan={11} className="mcs-empty">
                  <FlaskConical size={28} style={{ opacity: 0.2, margin: '0 auto 8px', display: 'block' }} />
                  <div>尚無試驗報告記錄 — 請至「材料管制」頁面的「檢試驗管制表」新增資料</div>
                </td></tr>
              ) : filteredTests.map(row => {
                const resultKey = row.result || '待審閱';
                const cfg = TEST_RESULT_CFG[resultKey] || TEST_RESULT_CFG['待審閱'];
                return (
                  <tr key={row.id} className={selected.has(row.id) ? 'sel' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={selected.has(row.id)} onChange={() => togSel(row.id)} />
                    </td>
                    <td style={{ padding: '2px 6px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-text-muted)' }}>{row.no || '—'}</td>
                    <td style={{ padding: '2px 4px' }}>
                      <EditableCell id={row.id} field="ci" table="mcs_test" val={row.ci} />
                    </td>
                    <td style={{ padding: '2px 4px' }}>
                      <EditableCell id={row.id} field="name" table="mcs_test" val={row.name} />
                    </td>
                    <td style={{ padding: '2px 4px' }}>
                      <EditableCell id={row.id} field="freq" table="mcs_test" val={row.freq} />
                    </td>
                    <td style={{ padding: '2px 4px' }}>
                      <EditableCell id={row.id} field="p_date" table="mcs_test" val={row.p_date} />
                    </td>
                    <td style={{ padding: '2px 4px' }}>
                      <EditableCell id={row.id} field="a_date" table="mcs_test" val={row.a_date} />
                    </td>
                    <td style={{ padding: '2px 4px' }}>
                      <EditableCell id={row.id} field="cum_qty" table="mcs_test" val={row.cum_qty} />
                    </td>
                    <td style={{ padding: '2px 4px' }}>
                      <EditableCell id={row.id} field="cum_smp" table="mcs_test" val={row.cum_smp} />
                    </td>
                    <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                      <span onClick={() => cycleTestResult(row.id, resultKey)} title="點擊切換可入判定"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 600,
                          color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}40` }}>
                        {resultKey === '可入' && <CheckCircle2 size={10} />}
                        {resultKey}
                      </span>
                    </td>
                    <td style={{ padding: '2px 4px' }}>
                      <EditableCell id={row.id} field="remark" table="mcs_test" val={row.remark} />
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
          : tab === 1
          ? <span>共 {filteredIssues.length} 筆 · 待改善 {openIssues} 筆</span>
          : <span>共 {filteredTests.length} 筆 · 可入 {testStats['可入'] || 0} · 不可入 {testStats['不可入'] || 0} · 待審閱 {testStats['待審閱'] || 0}</span>
        }
        <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '0.7rem' }}>
          {isMobile && tab === 0 ? '點擊卡片展開詳情' : '雙擊儲存格編輯 · 點擊狀態/結果切換'}
        </span>
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
                <datalist id="work-items-list">
                  {[...WORK_ITEMS_PRESET,
                    ...workItemGroups.map(g => g.name).filter(n => !WORK_ITEMS_PRESET.includes(n))
                  ].map(item => <option key={item} value={item} />)}
                </datalist>
                {[
                  { label: '檢驗日期', field: 'inspect_date', type: 'date' },
                  { label: '檢驗類型', field: 'inspect_type', type: 'text', placeholder: '例：施工抽查' },
                  { label: '工程項目', field: 'work_item', type: 'text', placeholder: '例：混凝土澆置', full: true, list: 'work-items-list' },
                  { label: '部位/位置', field: 'location', type: 'text', placeholder: '例：B2F 柱位 A3' },
                  { label: '檢驗人員', field: 'inspector', type: 'text', placeholder: '姓名' },
                  { label: '備註', field: 'remark', type: 'text', placeholder: '備註說明', full: true },
                ].map(({ label, field, type, placeholder, full, list }) => (
                  <div key={field} style={{ gridColumn: full ? '1 / -1' : undefined }}>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>{label}</label>
                    <input type={type} placeholder={placeholder} value={inspForm[field] || ''}
                      list={list}
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

      {/* Modal: 驗收申請確認 */}
      {verifyTarget && (
        <div className="modal-overlay" onClick={() => setVerifyTarget(null)}>
          <div className="modal-box" style={{ maxWidth: '480px', width: '92%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <ClipboardCheck size={16} style={{ color: '#6366f1' }} />
                <span>缺失驗收申請</span>
              </div>
              <button className="modal-close" onClick={() => setVerifyTarget(null)}><X size={14} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '10px 12px', background: 'var(--color-bg2)', borderRadius: '7px', fontSize: '12px', color: 'var(--color-text2)' }}>
                <div style={{ fontWeight: 600, color: 'var(--color-text1)', marginBottom: '4px' }}>{verifyTarget.item}</div>
                {verifyTarget.location && <div style={{ color: 'var(--color-text-muted)' }}>位置：{verifyTarget.location}</div>}
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '8px', fontWeight: 600 }}>驗收確認清單</div>
                {VERIFY_CHECKLIST.map((item, i) => (
                  <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text2)', borderBottom: i < VERIFY_CHECKLIST.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                    <input type="checkbox"
                      checked={verifyChecks.includes(i)}
                      onChange={() => setVerifyChecks(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                    />
                    {item}
                  </label>
                ))}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>驗收說明（選填）</label>
                <input type="text" placeholder="驗收人員、方式或補充說明…"
                  value={verifyNote} onChange={e => setVerifyNote(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text1)', fontSize: '13px', boxSizing: 'border-box' }} />
              </div>
              {verifyChecks.length < VERIFY_CHECKLIST.length && (
                <div style={{ fontSize: '11px', color: 'var(--color-warning)', padding: '6px 10px', background: 'rgba(245,158,11,0.08)', borderRadius: 6 }}>
                  尚有 {VERIFY_CHECKLIST.length - verifyChecks.length} 項未確認，仍可送出但建議全數勾選
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setVerifyTarget(null)}>取消</button>
              <button className="btn-primary" onClick={submitVerify}
                style={{ background: '#6366f1', borderColor: '#6366f1' }}>
                <ClipboardCheck size={12} /> 確認已驗收
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 填寫標準工項抽查單 */}
      {formRow !== null && (
        <InspectionFormModal
          inspection={formRow}
          project={project}
          onClose={() => setFormRow(null)}
        />
      )}

      {/* 列印：施工抽查記錄表 */}
      {printRow && (
        <InspectionPrintView
          row={printRow}
          project={project}
          issue={issueByInspMap[printRow.id] || null}
          onClose={() => setPrintRow(null)}
        />
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

/* ── 施工抽查記錄表列印元件 ── */
function InspectionPrintView({ row, project, issue, onClose }) {
  const resCfg = INSPECT_RESULT[row.result] || INSPECT_RESULT['待複驗'];
  const issueCfg = issue ? (RESOLVE_STATUS[issue.status] || RESOLVE_STATUS.open) : null;
  const docNo = `Q-${(row.inspect_date || '').replace(/-/g, '')}-${String(row.id).slice(-4).padStart(4, '0')}`;

  function doPrint() { window.print(); }

  return (
    <div className="insp-print-overlay">
      <div className="insp-print-toolbar">
        <span style={{ fontWeight: 600, fontSize: '14px' }}>施工抽查記錄表預覽</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="mcs-btn mcs-btn-add" onClick={doPrint}><Printer size={13} /> 列印 / 存 PDF</button>
          <button className="mcs-btn" onClick={onClose}><X size={13} /> 關閉</button>
        </div>
      </div>

      <div className="insp-print-page">
        {/* 表頭 */}
        <table className="insp-pt-header-tbl">
          <tbody>
            <tr>
              <td colSpan={4} className="insp-pt-title">施工抽查記錄表</td>
            </tr>
            <tr>
              <td className="insp-pt-label">工程名稱</td>
              <td colSpan={3} className="insp-pt-val">{project?.name || '—'}</td>
            </tr>
            <tr>
              <td className="insp-pt-label">承包廠商</td>
              <td className="insp-pt-val">{project?.contractor || '—'}</td>
              <td className="insp-pt-label">記錄編號</td>
              <td className="insp-pt-val insp-pt-mono">{docNo}</td>
            </tr>
          </tbody>
        </table>

        {/* 抽查內容 */}
        <table className="insp-pt-body-tbl">
          <tbody>
            <tr>
              <td className="insp-pt-label">檢驗日期</td>
              <td className="insp-pt-val">{row.inspect_date || '—'}</td>
              <td className="insp-pt-label">檢驗類型</td>
              <td className="insp-pt-val">{row.inspect_type || '—'}</td>
            </tr>
            <tr>
              <td className="insp-pt-label">工程項目</td>
              <td colSpan={3} className="insp-pt-val">{row.work_item || '—'}</td>
            </tr>
            <tr>
              <td className="insp-pt-label">部位 / 位置</td>
              <td colSpan={3} className="insp-pt-val">{row.location || '—'}</td>
            </tr>
            <tr>
              <td className="insp-pt-label">檢驗人員</td>
              <td className="insp-pt-val">{row.inspector || '—'}</td>
              <td className="insp-pt-label">檢驗結果</td>
              <td className="insp-pt-val">
                <span style={{ fontWeight: 700, color: resCfg.color }}>{row.result || '待複驗'}</span>
              </td>
            </tr>
            <tr>
              <td className="insp-pt-label">備註說明</td>
              <td colSpan={3} className="insp-pt-val insp-pt-remark">{row.remark || '—'}</td>
            </tr>
            {issue && (
              <tr>
                <td className="insp-pt-label">缺失改善</td>
                <td colSpan={3} className="insp-pt-val">
                  <span style={{ fontWeight: 600, color: issueCfg?.color }}>{issueCfg?.label}</span>
                  {issue.deadline ? `  ／  改善期限：${issue.deadline}` : ''}
                  {issue.responsible ? `  ／  責任廠商：${issue.responsible}` : ''}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* 簽名欄 */}
        <table className="insp-pt-sign-tbl">
          <tbody>
            <tr>
              <td className="insp-pt-sign-label">監造人員</td>
              <td className="insp-pt-sign-field"></td>
              <td className="insp-pt-sign-label">承包廠商</td>
              <td className="insp-pt-sign-field"></td>
              <td className="insp-pt-sign-label">業主代表</td>
              <td className="insp-pt-sign-field"></td>
            </tr>
            <tr>
              <td className="insp-pt-sign-label">簽章日期</td>
              <td className="insp-pt-sign-field"></td>
              <td className="insp-pt-sign-label">簽章日期</td>
              <td className="insp-pt-sign-field"></td>
              <td className="insp-pt-sign-label">簽章日期</td>
              <td className="insp-pt-sign-field"></td>
            </tr>
          </tbody>
        </table>

        <div className="insp-pt-footer">本表單由 RT-PMIS 監造管理系統自動產生 · 列印日期：{new Date().toLocaleDateString('zh-TW')}</div>
      </div>
    </div>
  );
}
