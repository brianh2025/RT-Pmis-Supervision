/* ============================================================
   Quality.jsx — 品質管理
   Tab 0: 施工檢驗管制（construction_inspections）
   Tab 1: 缺失改善管制（quality_issues）
   ============================================================ */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Plus, Trash2, Loader2, ShieldCheck, AlertTriangle, ClipboardCheck, X, FileText, Upload, ScanText } from 'lucide-react';
import InspectionFormModal from '../components/InspectionFormModal';
import {
  renderPdfPagesToImages, recognizeInspectionImage, collectOcrParagraphs,
  parseInspectionHeader, extractItemsFromParagraphs,
} from '../utils/inspectionOcr';
import { InspectionImportModal } from '../components/InspectionImportModal';
import { guessTemplateCode, getTemplateByCode, INSPECTION_TEMPLATES } from '../config/inspectionFormTemplates';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../hooks/useProject';
import { useQualityIssueCreator } from '../hooks/useQualityIssueCreator';
import { splitWorkItemEntry, NON_INSPECT_RE, extractLocation, classifyWorkItem } from '../utils/workItemAutoSplit';
import {
  SEVERITY_CONFIG, RESOLVE_STATUS, RESOLVE_CYCLE, INSPECT_RESULT, RESULT_CYCLE,
  TEST_RESULT_CYCLE, TEST_RESULT_CFG,
} from './quality/qualityConfig';
import { ConstructionInspectionTable } from './quality/ConstructionInspectionTable';
import { QualityIssueTable } from './quality/QualityIssueTable';
import { TestReportTable } from './quality/TestReportTable';
import { InspectionPrintView } from './quality/InspectionPrintView';
import './MaterialControl.css';
import '../components/Modal.css';

const TNAMES = ['施工檢驗管制', '缺失改善管制', '試驗報告管制'];

/* 分項工程項目：與施工抽查紀錄表的工項分類一致 */
const WORK_ITEMS_PRESET = INSPECTION_TEMPLATES.map(t => t.label);

const INSPECT_TYPE_CHOICES = ['檢驗停留點', '不定期抽查'];
const INSPECT_CATEGORY_CHOICES = ['施工檢驗', '材料檢驗'];

const EMPTY_INSPECT = {
  inspect_date: new Date().toISOString().split('T')[0],
  work_item: '', location: '', inspect_type: INSPECT_TYPE_CHOICES[0], inspect_category: INSPECT_CATEGORY_CHOICES[0],
  inspector: '', result: '待複驗', remark: '',
  fail_action: '',   // 不合格處置：improved = 當日已改善完成、issue = 開立缺失改善單（不寫入資料表）
};
const EMPTY_QUALITY = {
  inspection_date: new Date().toISOString().split('T')[0],
  location: '', item: '', severity: 'major', description: '', responsible: '', deadline: '', remark: '',
};

/* ── Main Component ── */
export function Quality() {
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { project } = useProject(projectId);
  const { createIssueFromInspection } = useQualityIssueCreator();
  const [printRow, setPrintRow] = useState(null);
  const [formRow,  setFormRow]  = useState(null);
  const [tab, setTab] = useState(0);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  // Tab 0: construction_inspections
  const [inspections, setInspections] = useState([]);
  const [inspFilter, setInspFilter] = useState('all');
  const [showInspModal, setShowInspModal] = useState(false);
  const [showInspImportModal, setShowInspImportModal] = useState(false);
  const [inspForm, setInspForm] = useState({ ...EMPTY_INSPECT });

  // Tab 1: quality_issues
  const [issues, setIssues] = useState([]);
  const [issueFilter, setIssueFilter] = useState('all');
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueForm, setIssueForm] = useState({ ...EMPTY_QUALITY });

  // Tab 2: mcs_test 試驗報告
  const [tests, setTests] = useState([]);
  const [testFilter, setTestFilter] = useState('all');

  // 手機快速查驗
  const [showQuickMobile, setShowQuickMobile] = useState(false);
  const [quickForm, setQuickForm] = useState({ work_item: '', result: '待複驗', location: '' });

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

  // 依施工日誌 / 材料進場產生的待建立查驗（自動直接建檔）
  const [diaryItems, setDiaryItems] = useState([]);
  const [matEntries, setMatEntries] = useState([]);
  const [autoCreated, setAutoCreated] = useState(0); // 本次自動建立筆數（提示 banner）
  const autoCreateRan = useRef(false);

  // 自動建檔 tombstone：使用者刪除過的查驗不再自動重建（localStorage，per-browser）
  const dismissKey = `pmis-insp-auto-dismissed-${projectId}`;
  const tombOf = (date, name) => `${date}|${guessTemplateCode(name) || name}`;
  const readDismissed = () => {
    try { return new Set(JSON.parse(localStorage.getItem(dismissKey) || '[]')); } catch { return new Set(); }
  };
  const addDismissed = (rows) => {
    const set = readDismissed();
    for (const r of rows) set.add(tombOf(r.inspect_date, r.work_item));
    localStorage.setItem(dismissKey, JSON.stringify([...set]));
  };

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
      const [ins, iss, tsts, diaryRes, matRes] = await Promise.all([
        loadInspections(), loadIssues(), loadTests(),
        supabase ? supabase.from('daily_report_items').select('item_name, log_date, today_qty, is_construction').eq('project_id', projectId) : { data: [] },
        supabase ? supabase.from('material_entries').select('name, entry_date').eq('project_id', projectId) : { data: [] },
      ]);
      setInspections(ins);
      setIssues(iss);
      setTests(tsts);
      setDiaryItems(diaryRes.data || []);
      setMatEntries(matRes.data || []);
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

  // 從任務看板「前往抽查」帶入：自動開啟抽查單並預填第一個待查驗工項
  useEffect(() => {
    if (location.state?.addInsp) {
      const firstItem = location.state.items?.[0] || '';
      setFormRow({ work_item: firstItem });
    }
  }, []);

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
      const { fail_action, ...fields } = inspForm;
      const { data, error } = await supabase.from('construction_inspections').insert([{
        project_id: projectId, created_by: user?.id, ...fields,
        remark: fail_action === 'improved'
          ? [fields.remark, '當日已改善完成'].filter(Boolean).join('；')
          : fields.remark,
      }]).select().single();
      if (error) throw error;
      if (data) {
        setInspections(prev => [data, ...prev]);
        if (inspForm.result === '不合格') {
          const today = new Date().toISOString().split('T')[0];
          const issueBase = {
            projectId, userId: user?.id, sourceRecordId: data.id,
            inspectionDate: inspForm.inspect_date || today,
            location: inspForm.location, item: inspForm.work_item,
            description: inspForm.remark || null,
          };
          if (fail_action === 'improved') {
            // 當日已改善完成：缺失單直接以「已改善」建檔留存軌跡，改善日期即檢驗日期
            const issue = await createIssueFromInspection({
              ...issueBase, status: 'resolved',
              resolveDate: inspForm.inspect_date || today,
              remark: '當日已改善完成',
            });
            if (issue) setIssues(prev => [issue, ...prev]);
          } else if (fail_action === 'issue') {
            const issue = await createIssueFromInspection({ ...issueBase, status: 'open' });
            if (issue) setIssues(prev => [issue, ...prev]);
          } else if (confirm(`此抽查結果為「不合格」，是否立即建立缺失改善單？\n\n工項：${inspForm.work_item}\n位置：${inspForm.location || '（未填）'}`)) {
            const issue = await createIssueFromInspection({ ...issueBase, status: 'open' });
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
        const issue = await createIssueFromInspection({
          projectId, userId: user?.id, sourceRecordId: id,
          inspectionDate: row.inspect_date || today,
          location: row.location, item: row.work_item, status: 'open',
        });
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
    const { error } = await supabase.from(table).update(patch).eq('id', id);
    if (error) { alert(`儲存失敗：${error.message}`); setEditCell(null); setEditVal(''); return; }
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
    const table = tab === 0 ? 'construction_inspections' : tab === 1 ? 'quality_issues' : 'mcs_test';
    const { error } = await supabase.from(table).delete().in('id', ids);
    if (error) { alert(`刪除失敗：${error.message}`); return; }
    if (tab === 0) addDismissed(inspections.filter(r => selected.has(r.id)));
    if (tab === 0) setInspections(prev => prev.filter(r => !selected.has(r.id)));
    else if (tab === 1) setIssues(prev => prev.filter(r => !selected.has(r.id)));
    else setTests(prev => prev.filter(r => !selected.has(r.id)));
    setSelected(new Set());
  }

  /* 單筆刪除（列尾垃圾桶鈕） */
  async function deleteOneInsp(row) {
    if (!supabase || !window.confirm(`確定刪除「${row.work_item || '（未命名）'}」這筆檢驗記錄？`)) return;
    const { error } = await supabase.from('construction_inspections').delete().eq('id', row.id);
    if (error) { alert(`刪除失敗：${error.message}`); return; }
    addDismissed([row]);
    setInspections(prev => prev.filter(r => r.id !== row.id));
  }

  function togSel(id) {
    setSelected(prev => { const ns = new Set(prev); ns.has(id) ? ns.delete(id) : ns.add(id); return ns; });
  }

  /* 以函式呼叫（非 JSX 元件）使用：內部元件每次渲染型別都不同，會導致 input 重掛載失焦 */
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
    .filter(r => inspFilter === 'all' || r.result === inspFilter);
  const filteredIssues = issueFilter === 'all' ? issues : issues.filter(r => r.status === issueFilter);

  /* 施工抽查 — 依工項分組統計（帶最近檢驗日期，依日期新→舊排序） */
  const workItemGroups = React.useMemo(() => {
    const map = {};
    inspections.forEach(r => {
      const k = r.work_item || '未分類';
      if (!map[k]) map[k] = { name: k, pass: 0, fail: 0, pending: 0, date: '' };
      if (r.result === '合格') map[k].pass++;
      else if (r.result === '不合格') map[k].fail++;
      else map[k].pending++;
      if ((r.inspect_date || '') > map[k].date) map[k].date = r.inspect_date || '';
    });
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
  }, [inspections]);
  const openIssues = (issueStats.open || 0) + (issueStats.in_progress || 0);

  /* ── 依施工日誌待建立查驗：日誌有施工或材料進場、當日尚無對應查驗記錄 ── */
  const pendingInspGroups = useMemo(() => {
    // 工項相符判定：字面互含，或抽查表代碼相同（解決「1F鋼筋綁紮」vs「鋼筋工程」對不上）
    const matches = (a, b) => {
      if (!a || !b) return false;
      if (a === b || a.includes(b) || b.includes(a)) return true;
      const ca = guessTemplateCode(a), cb = guessTemplateCode(b);
      return !!ca && ca === cb;
    };
    const hasInsp = (date, name) => inspections.some(r => r.inspect_date === date && matches(r.work_item, name));

    const map = new Map();
    for (const r of diaryItems) {
      if (!r.item_name || !r.log_date) continue;
      if (r.is_construction === false) continue;
      if (!(parseFloat(r.today_qty) >= 0.1)) continue;
      // 敘述式工項拆解：位置/部位切出、多項活動各自成列
      for (const piece of splitWorkItemEntry(r.item_name)) {
        if (!piece.item || NON_INSPECT_RE.test(piece.item)) continue;
        // 工項含「進場」視為材料進場，建立時歸類材料檢驗
        const src = /進場/.test(piece.item) ? '材料進場' : '施工';
        // 樁位里程歸入工程位置及部位，工項再依分項工程歸類
        const { rest, loc } = extractLocation(piece.item);
        const name = classifyWorkItem(rest || piece.item);
        const location = `${piece.location || ''}${loc}`;
        const key = `${r.log_date}|${name}|${location}|${src}`;
        if (map.has(key) || hasInsp(r.log_date, name)) continue;
        map.set(key, { date: r.log_date, name, location, source: src });
      }
    }
    for (const m of matEntries) {
      if (!m.name || !m.entry_date) continue;
      const key = `${m.entry_date}|${m.name}|材料`;
      if (map.has(key) || hasInsp(m.entry_date, m.name)) continue;
      map.set(key, { date: m.entry_date, name: m.name, source: '材料進場' });
    }

    const byDate = {};
    for (const it of map.values()) (byDate[it.date] = byDate[it.date] || []).push(it);
    return Object.entries(byDate)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({ date, items: items.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')) }));
  }, [diaryItems, matEntries, inspections]);

  /* ── 自動直接建立待編輯查驗：初載完成後將候選一次寫入管制表（結果「待複驗」），
     冪等由 hasInsp 保證（建檔後下次載入候選自然消失）；刪除過的由 tombstone 過濾不再重建 ── */
  useEffect(() => {
    if (loading || autoCreateRan.current || !supabase) return;
    autoCreateRan.current = true; // 本次載入僅執行一次
    const dismissed = readDismissed();
    const candidates = pendingInspGroups.flatMap(g => g.items)
      .filter(it => !dismissed.has(tombOf(it.date, it.name)));
    if (!candidates.length) return;
    (async () => {
      const payload = candidates.map(it => ({
        project_id: projectId, created_by: user?.id,
        inspect_date: it.date, work_item: it.name,
        inspect_type: INSPECT_TYPE_CHOICES[0],
        inspect_category: it.source === '材料進場' ? '材料檢驗' : '施工檢驗',
        location: it.location || '', inspector: '', result: '待複驗', remark: '',
      }));
      const { data, error } = await supabase.from('construction_inspections').insert(payload).select();
      if (error || !data?.length) return;
      setInspections(prev => [...data, ...prev]);
      setAutoCreated(data.length);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, pendingInspGroups]);

  /* ── 新增檢驗：匯入抽查紀錄 PDF 掃描檔辨識（重用標準抽查單的 OCR 管線） ── */
  const inspPdfInputRef = useRef(null);
  const [inspOcrLoading, setInspOcrLoading] = useState(false);
  const [inspPdfPages, setInspPdfPages] = useState([]);
  const [inspPdfPickerOpen, setInspPdfPickerOpen] = useState(false);

  async function handleInspPdfFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!import.meta.env.VITE_GOOGLE_API_KEY) { alert('尚未設定 VITE_GOOGLE_API_KEY，無法使用 PDF 辨識匯入'); return; }
    setInspOcrLoading(true);
    try {
      const pages = await renderPdfPagesToImages(file);
      setInspPdfPages(pages);
      setInspPdfPickerOpen(true);
    } catch (err) {
      alert(`PDF 讀取失敗：${err.message}`);
    } finally {
      setInspOcrLoading(false);
    }
  }

  async function pickInspPdfPage(dataUrl) {
    setInspPdfPickerOpen(false);
    setInspOcrLoading(true);
    try {
      const visionResponse = await recognizeInspectionImage(dataUrl);
      const paragraphs = collectOcrParagraphs(visionResponse);
      if (!paragraphs.length) { alert('未辨識到任何文字，請確認掃描檔清晰度'); return; }
      const parsed = parseInspectionHeader(paragraphs);

      // 由表單標題推工項範本，再依各項 ○╳ 計算整體結果（同標準抽查單邏輯）
      const code = guessTemplateCode(parsed.formTitle) || guessTemplateCode(inspForm.work_item);
      const template = code ? getTemplateByCode(code) : null;
      let overall = '', itemHits = 0;
      if (template) {
        const items = extractItemsFromParagraphs(paragraphs, template);
        itemHits = Object.keys(items).length;
        const results = Object.values(items).map(v => v.result).filter(Boolean);
        overall = results.includes('fail') ? '不合格'
          : results.length > 0 && results.every(r => r === 'pass') ? '合格' : '';
      }

      setInspForm(prev => ({
        ...prev,
        ...(parsed.date     ? { inspect_date: parsed.date } : {}),
        ...(parsed.location ? { location: parsed.location } : {}),
        ...(template && !prev.work_item ? { work_item: template.label } : {}),
        ...(overall ? { result: overall } : {}),
      }));
      const hits = (parsed.date ? 1 : 0) + (parsed.location ? 1 : 0) + (template ? 1 : 0);
      alert(`辨識完成：帶入 ${hits} 項基本資料、${itemHits} 項抽查結果（整體結果：${overall || '無法判定'}）。手寫辨識準確度有限，請覆核後再新增。`);
    } catch (err) {
      alert(`辨識失敗：${err.message}`);
    } finally {
      setInspOcrLoading(false);
    }
  }

  async function saveQuickInsp() {
    if (!quickForm.work_item || !supabase) return;
    setSaving(true);
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase.from('construction_inspections').insert([{
      project_id: projectId, created_by: user?.id,
      inspect_date: today,
      work_item: quickForm.work_item,
      location: quickForm.location,
      inspect_type: '查驗',
      result: quickForm.result,
      inspector: '',
    }]).select().single();
    setSaving(false);
    if (error || !data) { alert('儲存失敗，請重試'); return; }
    setInspections(prev => [data, ...prev]);
    if (quickForm.result === '不合格') {
      if (window.confirm(`「${quickForm.work_item}」不合格，是否自動建立缺失改善單？`)) {
        await createIssueFromInspection({
          projectId, userId: user?.id, sourceRecordId: data.id,
          inspectionDate: today, item: quickForm.work_item, location: quickForm.location, status: 'open',
        });
        const [ins, iss] = await Promise.all([loadInspections(), loadIssues()]);
        setInspections(ins); setIssues(iss);
      }
    }
    setShowQuickMobile(false);
    if (window.confirm('查驗記錄已建立，是否立即前往拍照？')) {
      navigate(`/projects/${projectId}/photos?src_table=construction_inspections&src_id=${data.id}&src_name=${encodeURIComponent(quickForm.work_item + (quickForm.location ? ' ' + quickForm.location : ''))}`);
    }
  }

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
                onClick={() => { setTab(i); setSelected(new Set()); setEditCell(null); setInspFilter('all'); setIssueFilter('all'); setTestFilter('all'); }}>
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
          {tab === 0 && (
            <button className="mcs-btn mcs-btn-add" onClick={() => setShowInspImportModal(true)}>
              <Upload size={12} /> 匯入抽查單
            </button>
          )}
        </div>
      </div>

      {/* Tab 0: 依施工日誌自動建立查驗的結果提示（可關閉） */}
      {tab === 0 && autoCreated > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', marginBottom: '8px',
          borderRadius: '8px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
          color: 'var(--color-success)', fontSize: 'var(--fs-sm)',
        }}>
          <ClipboardCheck size={14} style={{ flexShrink: 0 }} />
          <span>已依施工日誌自動建立 {autoCreated} 筆待複驗查驗，請於表列中編修內容與結果</span>
          <button onClick={() => setAutoCreated(0)} title="關閉提示"
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex' }}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* Tab 0: 施工檢驗管制 */}
      {tab === 0 && (
        <ConstructionInspectionTable
          isMobile={isMobile}
          filteredInsp={filteredInsp}
          inspPhotoMap={inspPhotoMap}
          issueByInspMap={issueByInspMap}
          navigate={navigate}
          projectId={projectId}
          selected={selected}
          togSel={togSel}
          setSelected={setSelected}
          cycleInspResult={cycleInspResult}
          setFormRow={setFormRow}
          setPrintRow={setPrintRow}
          deleteOneInsp={deleteOneInsp}
          EditableCell={EditableCell}
        />
      )}

      {/* Tab 1: 缺失改善管制 */}
      {tab === 1 && (
        <QualityIssueTable
          isMobile={isMobile}
          filteredIssues={filteredIssues}
          selected={selected}
          togSel={togSel}
          setSelected={setSelected}
          cycleIssueStatus={cycleIssueStatus}
          openVerify={openVerify}
          EditableCell={EditableCell}
        />
      )}

      {/* Tab 2: 試驗報告管制 */}
      {tab === 2 && (
        <TestReportTable
          isMobile={isMobile}
          filteredTests={filteredTests}
          selected={selected}
          togSel={togSel}
          setSelected={setSelected}
          cycleTestResult={cycleTestResult}
          EditableCell={EditableCell}
        />
      )}


      <div className="mcs-footer">
        {tab === 0
          ? <span>共 {filteredInsp.length} 筆 · 合格 {inspStats['合格'] || 0} · 不合格 {inspStats['不合格'] || 0} · 待複驗 {inspStats['待複驗'] || 0}</span>
          : tab === 1
          ? <span>共 {filteredIssues.length} 筆 · 待改善 {openIssues} 筆</span>
          : <span>共 {filteredTests.length} 筆 · 可入 {testStats['可入'] || 0} · 不可入 {testStats['不可入'] || 0} · 待審閱 {testStats['待審閱'] || 0}</span>
        }
        <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '0.7rem' }}>
          {isMobile ? '點擊卡片展開詳情' : '雙擊儲存格編輯 · 點擊狀態/結果切換'}
        </span>
      </div>

      {/* Modal: 新增施工檢驗 */}
      {showInspModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowInspModal(false)}>
          <div className="modal-box" style={{ maxWidth: '520px', width: '92%' }}>
            <div className="modal-header">
              <div className="modal-title"><ShieldCheck size={16} style={{ color: 'var(--color-primary-light)' }} /><span>新增查驗紀錄</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button className="mcs-btn mcs-btn-add" disabled={inspOcrLoading}
                  onClick={() => inspPdfInputRef.current?.click()} title="匯入已填寫的抽查紀錄掃描檔，自動辨識帶入欄位">
                  {inspOcrLoading ? <Loader2 size={12} className="animate-spin" /> : <ScanText size={12} />} PDF辨識匯入
                </button>
                <button className="modal-close" onClick={() => setShowInspModal(false)}>✕</button>
              </div>
            </div>
            <input ref={inspPdfInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleInspPdfFile} />
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <datalist id="work-items-list">
                  {[...WORK_ITEMS_PRESET,
                    ...workItemGroups.map(g => g.name).filter(n => !WORK_ITEMS_PRESET.includes(n))
                  ].map(item => <option key={item} value={item} />)}
                </datalist>
                {[
                  { label: '檢驗日期', field: 'inspect_date', type: 'date' },
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
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>查驗類別</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {INSPECT_CATEGORY_CHOICES.map(c => {
                      const active = inspForm.inspect_category === c;
                      return (
                        <button key={c} onClick={() => setInspForm(prev => ({ ...prev, inspect_category: c }))}
                          style={{ flex: 1, padding: '6px 6px', borderRadius: '5px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                            background: active ? 'rgba(var(--color-primary-rgb),0.12)' : 'transparent',
                            color: active ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
                            border: `1px solid ${active ? 'var(--color-primary-light)' : 'var(--color-border)'}` }}>
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>檢驗類型</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {INSPECT_TYPE_CHOICES.map(t => {
                      const active = inspForm.inspect_type === t;
                      return (
                        <button key={t} onClick={() => setInspForm(prev => ({ ...prev, inspect_type: t }))}
                          style={{ flex: 1, padding: '6px 6px', borderRadius: '5px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                            background: active ? 'rgba(var(--color-primary-rgb),0.12)' : 'transparent',
                            color: active ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
                            border: `1px solid ${active ? 'var(--color-primary-light)' : 'var(--color-border)'}` }}>
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {[
                  { label: '工程項目', field: 'work_item', type: 'text', placeholder: '例：混凝土工程', full: true, list: 'work-items-list' },
                  { label: '工程位置及部位', field: 'location', type: 'text', placeholder: '例：南岸1K+683~1K+844' },
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
                        <button key={r} onClick={() => setInspForm(prev => ({ ...prev, result: r, ...(r !== '不合格' ? { fail_action: '' } : {}) }))}
                          style={{ flex: 1, padding: '5px 8px', borderRadius: '5px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                            background: active ? cfg.bg : 'transparent', color: active ? cfg.color : 'var(--color-text-muted)',
                            border: `1px solid ${active ? cfg.color + '60' : 'var(--color-border)'}` }}>
                          {r}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {inspForm.result === '不合格' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#ef4444', marginBottom: '4px' }}>不合格處置</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[
                        { key: 'improved', label: '當日已改善完成', color: '#10b981' },
                        { key: 'issue',    label: '開立缺失改善單', color: '#f97316' },
                      ].map(({ key, label, color }) => {
                        const active = inspForm.fail_action === key;
                        return (
                          <button key={key}
                            onClick={() => setInspForm(prev => ({ ...prev, fail_action: prev.fail_action === key ? '' : key }))}
                            style={{ flex: 1, padding: '5px 8px', borderRadius: '5px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                              background: active ? `${color}1f` : 'transparent', color: active ? color : 'var(--color-text-muted)',
                              border: `1px solid ${active ? color + '80' : 'var(--color-border)'}` }}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
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

      {/* 新增檢驗：PDF 掃描檔頁面選取 overlay */}
      {inspPdfPickerOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setInspPdfPickerOpen(false)}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 20, maxWidth: 640, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: 12, color: 'var(--color-text1)' }}>
              請選擇「施工抽查紀錄表」所在頁面
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              {inspPdfPages.map(p => (
                <button key={p.pageNum} onClick={() => pickInspPdfPage(p.dataUrl)}
                  style={{ padding: 0, border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden', cursor: 'pointer', background: 'var(--color-bg2)' }}>
                  <img src={p.dataUrl} alt={`第 ${p.pageNum} 頁`} style={{ width: '100%', display: 'block' }} />
                  <div style={{ fontSize: '12px', padding: '4px 0', color: 'var(--color-text-muted)' }}>第 {p.pageNum} 頁</div>
                </button>
              ))}
            </div>
            <button onClick={() => setInspPdfPickerOpen(false)}
              style={{ marginTop: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text-muted)' }}>
              取消
            </button>
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
          onSave={rec => setInspections(prev => prev.some(r => r.id === rec.id)
            ? prev.map(r => r.id === rec.id ? rec : r)
            : [rec, ...prev])}
          onDelete={id => setInspections(prev => prev.filter(r => r.id !== id))}
        />
      )}

      {/* Excel 匯入抽查單 */}
      {showInspImportModal && (
        <InspectionImportModal
          projectId={projectId}
          onClose={() => setShowInspImportModal(false)}
          onSuccess={() => loadInspections().then(setInspections)}
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

      {/* 手機現場一條龍 FAB */}
      {isMobile && tab === 0 && (
        <button className="mcs-quick-fab" onClick={() => { setQuickForm({ work_item: '', result: '待複驗', location: '' }); setShowQuickMobile(true); }} title="快速新增查驗">
          <Plus size={22} />
        </button>
      )}

      {/* 快速查驗 Modal */}
      {showQuickMobile && (
        <div className="modal-backdrop" onClick={() => setShowQuickMobile(false)}>
          <div className="modal-content" style={{ maxWidth: 360, margin: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 15 }}>快速查驗記錄</h3>
              <button className="modal-close" onClick={() => setShowQuickMobile(false)}><X size={16} /></button>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>查驗工項</div>
                <select value={quickForm.work_item} onChange={e => setQuickForm(f => ({ ...f, work_item: e.target.value }))}
                  style={{ width: '100%', padding: '7px 8px', border: '1px solid var(--color-border)', borderRadius: 6, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14 }}>
                  <option value="">— 選擇工項 —</option>
                  {WORK_ITEMS_PRESET.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>工程位置及部位</div>
                <input value={quickForm.location} onChange={e => setQuickForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="如：南岸1K+683~1K+844" style={{ width: '100%', padding: '7px 8px', border: '1px solid var(--color-border)', borderRadius: 6, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>查驗結果</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['合格', '不合格', '待複驗'].map(r => {
                    const cfg = INSPECT_RESULT[r] || {};
                    return (
                      <button key={r} onClick={() => setQuickForm(f => ({ ...f, result: r }))}
                        style={{ flex: 1, padding: '9px 0', borderRadius: 6, border: `2px solid ${quickForm.result === r ? cfg.color : 'var(--color-border)'}`, background: quickForm.result === r ? cfg.bg : 'transparent', color: quickForm.result === r ? cfg.color : 'var(--color-text-muted)', fontWeight: quickForm.result === r ? 700 : 400, cursor: 'pointer', fontSize: 13 }}>
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button onClick={saveQuickInsp} disabled={!quickForm.work_item || saving}
                style={{ padding: '11px', borderRadius: 8, background: quickForm.work_item ? 'var(--color-primary)' : 'var(--color-border)', color: quickForm.work_item ? '#fff' : 'var(--color-text-muted)', border: 'none', fontWeight: 600, fontSize: 15, cursor: quickForm.work_item ? 'pointer' : 'default' }}>
                {saving ? '儲存中…' : '建立查驗記錄 →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
