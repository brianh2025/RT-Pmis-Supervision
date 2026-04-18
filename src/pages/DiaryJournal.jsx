import React, { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Cloud, ChevronDown, ChevronUp, RefreshCcw, Loader2, Trash2, ExternalLink, Plus, FileText, Package, ClipboardCheck, AlertTriangle, Edit3 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { DriveSyncModal } from '../components/DriveSyncModal';
import { DailyReportProvider, DailyReportContext } from './DailyReport/DailyReportContext';
import { DailyReportView } from './DailyReport/DailyReportView';
import { DailyReportForm } from './DailyReport/DailyReportForm';
import { DiaryImportModal } from '../components/DiaryImportModal';
import { InspectionQuickModal } from '../components/InspectionQuickModal';
import './DiaryJournal.css';

const EDGE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-diary`;

/* 自主檢查關鍵字 */
const SELF_INSP_KEYWORDS = ['自主檢查', '自主品管', '品管作業', 'QC'];

function detectSelfInspection(workItems, reportItems) {
  const text = (workItems || '') + ' ' + (reportItems || []).map(i => i.item_name || '').join(' ');
  return SELF_INSP_KEYWORDS.some(k => text.includes(k));
}

/* 重點施工項目 → 材料管制觸發清單 */
const MATERIAL_TRIGGERS = [
  { keyword: '模板',   label: '模板' },
  { keyword: '混凝土', label: '混凝土' },
  { keyword: '鋼筋',   label: '鋼筋' },
  { keyword: '瀝青',   label: '瀝青混凝土' },
  { keyword: '地工織布', label: '地工織布' },
  { keyword: '基樁',   label: '基樁' },
  { keyword: '植筋',   label: '化學植筋' },
];

function detectKeyMaterials(workItems, reportItems) {
  const raw = (workItems || '') + ' ' + (reportItems || []).map(i => i.item_name || '').join(' ');
  // 「混凝土用模板 / 混凝土模板」屬模板類，先移除「混凝土」前綴避免誤判
  const text = raw.replace(/混凝土用?模板/g, '模板');
  return MATERIAL_TRIGGERS.filter(t => text.includes(t.keyword));
}

/**
 * 補漏同步：
 * 1. 查 DB 現有日期
 * 2. 同步最新累積檔（含所有歷史日期）
 * 3. 回傳新增日期數（0 = 無缺漏或同步無新增）
 */
async function runBackgroundSync(projectId, startDate) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  const syncSecret = import.meta.env.VITE_SYNC_SECRET || '';

  const { data: before } = await supabase
    .from('daily_logs').select('log_date')
    .eq('project_id', projectId)
    .gte('log_date', startDate || '2020-01-01');
  const beforeSet = new Set((before || []).map(r => r.log_date));

  const listRes = await fetch(EDGE_FN_URL, {
    method: 'POST', headers,
    body: JSON.stringify({ mode: 'list', projectId, startDate, secret: syncSecret }),
  });
  if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);
  const { files = [] } = await listRes.json();
  if (files.length === 0) return 0;
  for (const f of files) {
    await fetch(EDGE_FN_URL, {
      method: 'POST', headers,
      body: JSON.stringify({ mode: 'sync_one', projectId, fileId: f.id, fileName: f.name, secret: syncSecret }),
    }).catch(() => {});
  }

  const { data: after } = await supabase
    .from('daily_logs').select('log_date')
    .eq('project_id', projectId)
    .gte('log_date', startDate || '2020-01-01');
  const newDates = (after || []).filter(r => !beforeSet.has(r.log_date));
  return newDates.length;
}

const DOW = ['日', '一', '二', '三', '四', '五', '六'];

function toKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDow(y, m)    { return new Date(y, m, 1).getDay(); }

function cleanNotes(raw) {
  if (!raw) return '';
  const lines = raw.split('\n');
  const cutIdx = lines.findIndex(l => /^[一二三四五六七八九十]+[、]/.test(l.trim()));
  return (cutIdx === -1 ? lines : lines.slice(0, cutIdx)).join('\n').trim();
}

function fmtPct(v) {
  if (v == null) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  return parseFloat(n.toFixed(2)) + '%';
}

function progressColor(actual, planned) {
  if (actual == null) return 'var(--color-primary)';
  if (actual >= planned) return '#10b981';
  if (actual >= planned * 0.95) return '#f59e0b';
  return '#ef4444';
}

// ── 內部元件（使用 DailyReportContext）──────────────────────────
function DiaryJournalInner() {
  const { id: projectId } = useParams();
  const navigate = useNavigate(); // 監造報表仍需跳轉
  const { reports, loading: reportsLoading, refresh: refreshReports } = useContext(DailyReportContext);

  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState(null);

  const [calCollapsed, setCalCollapsed] = useState(false);

  const [project,        setProject]        = useState(null);
  const [showDriveSync,  setShowDriveSync]  = useState(false);
  const [autoSyncing,    setAutoSyncing]    = useState(false);
  const [syncFilled,     setSyncFilled]     = useState(0);
  const autoSyncedRef = useRef(false);
  const [refreshKey,     setRefreshKey]     = useState(0);

  const [diaryDates,       setDiaryDates]       = useState(new Set());
  const [supervisionDates, setSupervisionDates] = useState(new Set());
  const [summary,          setSummary]          = useState(null);
  const [loadingSummary,   setLoadingSummary]   = useState(false);
  const [materialStatus,   setMaterialStatus]   = useState({ entries: [], tests: [] });
  const [inspections,      setInspections]      = useState([]);
  const [showInspModal,    setShowInspModal]    = useState(false);
  const [inspEditing,      setInspEditing]      = useState(null);
  const [inspPrefill,      setInspPrefill]      = useState('');

  // ── 施工日誌內嵌模式 ─────────────────────────────────────────
  const [viewMode, setViewMode] = useState('summary'); // 'summary' | 'view' | 'form'
  const [diaryFormExisting, setDiaryFormExisting] = useState(null);
  const [showImport, setShowImport] = useState(false);

  // 日期切換時回到摘要
  useEffect(() => { setViewMode('summary'); }, [selectedKey]);

  const diaryReport = (!reportsLoading && selectedKey)
    ? reports.find(r => r.date === selectedKey) ?? null
    : null;

  const mockProject = {
    name: project?.name || '',
    contractor: project?.contractor || '',
    supervisorName: '',
  };

  // ── 取工程資訊 ────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('projects')
      .select('drive_folder_id, start_date, name, contractor')
      .eq('id', projectId).single()
      .then(({ data }) => { if (data) setProject(data); });
  }, [projectId]);

  // ── 進頁自動背景同步 ──────────────────────────────────────────
  useEffect(() => {
    if (!project?.drive_folder_id || autoSyncedRef.current) return;
    autoSyncedRef.current = true;
    setAutoSyncing(true);
    runBackgroundSync(projectId, project.start_date)
      .then(count => {
        if (count > 0) {
          setSyncFilled(count);
          setRefreshKey(k => k + 1);
          refreshReports();
        }
      })
      .catch(() => {})
      .finally(() => setAutoSyncing(false));
  }, [project?.drive_folder_id, projectId, refreshReports]);

  // ── 取當月有資料的日期 ──────────────────────────────────────
  useEffect(() => {
    setDiaryDates(new Set());
    setSupervisionDates(new Set());
    const start = toKey(year, month, 1);
    const end   = toKey(year, month, getDaysInMonth(year, month));
    let cancelled = false;
    Promise.all([
      supabase.from('daily_report_items').select('log_date')
        .eq('project_id', projectId).gte('log_date', start).lte('log_date', end),
      supabase.from('daily_logs').select('log_date')
        .eq('project_id', projectId).gte('log_date', start).lte('log_date', end),
    ]).then(([dri, dl]) => {
      if (cancelled) return;
      const dlDates = new Set((dl.data || []).map(r => r.log_date));
      const combined = new Set([
        ...(dri.data || []).map(r => r.log_date),
        ...dlDates,
      ]);
      setDiaryDates(combined);
      setSupervisionDates(dlDates);
    });
    return () => { cancelled = true; };
  }, [projectId, year, month, refreshKey]);

  // ── 取選定日期摘要 ─────────────────────────────────────────
  useEffect(() => {
    if (!selectedKey) {
      setSummary(null);
      setMaterialStatus({ entries: [], tests: [] });
      setInspections([]);
      return;
    }
    setLoadingSummary(true);
    Promise.all([
      supabase.from('daily_report_items')
        .select('item_name, unit, today_qty')
        .eq('project_id', projectId).eq('log_date', selectedKey),
      supabase.from('daily_logs')
        .select('weather_am, weather_pm, notes, actual_progress, planned_progress, work_items')
        .eq('project_id', projectId).eq('log_date', selectedKey).maybeSingle(),
      supabase.from('progress_records')
        .select('planned_progress, actual_progress')
        .eq('project_id', projectId).eq('report_date', selectedKey).maybeSingle(),
      supabase.from('material_entries')
        .select('id, name')
        .eq('project_id', projectId).eq('entry_date', selectedKey),
      supabase.from('mcs_test')
        .select('id, name, s_date')
        .eq('project_id', projectId).eq('s_date', selectedKey),
      supabase.from('construction_inspections')
        .select('*')
        .eq('project_id', projectId).eq('inspect_date', selectedKey)
        .order('created_at', { ascending: true }),
    ]).then(([items, log, prog, matEntries, matTests, insp]) => {
      setSummary({
        workItems: items.data || [],
        log:       log.data   || null,
        progress:  prog.data  || null,
      });
      setMaterialStatus({
        entries: matEntries.data || [],
        tests:   matTests.data   || [],
      });
      setInspections(insp.data || []);
      setLoadingSummary(false);
    });
  }, [projectId, selectedKey, refreshKey]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDow    = getFirstDow(year, month);
  const todayKey    = toKey(today.getFullYear(), today.getMonth(), today.getDate());

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedKey(null);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedKey(null);
  };

  function changeDay(delta) {
    if (!selectedKey) return;
    const d = new Date(selectedKey + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const newKey = toKey(d.getFullYear(), d.getMonth(), d.getDate());
    setSelectedKey(newKey);
    if (d.getFullYear() !== year || d.getMonth() !== month) {
      setYear(d.getFullYear());
      setMonth(d.getMonth());
    }
  }

  const hasDiary = selectedKey ? diaryDates.has(selectedKey) : false;
  const hasSup   = selectedKey ? supervisionDates.has(selectedKey) : false;

  const handleDeleteDate = async () => {
    if (!selectedKey) return;
    if (!window.confirm(`確定刪除 ${selectedKey} 的所有日誌及監造資料？此操作無法復原。`)) return;
    await Promise.all([
      supabase.from('daily_logs').delete().eq('project_id', projectId).eq('log_date', selectedKey),
      supabase.from('daily_report_items').delete().eq('project_id', projectId).eq('log_date', selectedKey),
      supabase.from('progress_records').delete().eq('project_id', projectId).eq('report_date', selectedKey),
    ]);
    try {
      const stored = JSON.parse(localStorage.getItem(`daily_reports_${projectId}`) || '[]');
      localStorage.setItem(`daily_reports_${projectId}`, JSON.stringify(stored.filter(r => r.date !== selectedKey)));
    } catch {}
    setSelectedKey(null);
    setRefreshKey(k => k + 1);
    refreshReports();
  };

  function handleSelectDate(key, isSelected) {
    setSelectedKey(isSelected ? null : key);
    if (!isSelected && window.innerWidth <= 768) setCalCollapsed(true);
  }

  // ── 施工日誌操作 ──────────────────────────────────────────────
  const handleOpenDiary = () => {
    if (diaryReport) {
      setViewMode('view');
    } else {
      setDiaryFormExisting({ date: selectedKey });
      setViewMode('form');
    }
  };

  const handleEditDiary = () => {
    setDiaryFormExisting(diaryReport);
    setViewMode('form');
  };

  const handleSaveDiary = () => {
    setViewMode('view');
    setRefreshKey(k => k + 1);
  };

  // ── 抽查操作 ───────────────────────────────────────────────
  const handleOpenInspModal = (prefillItem = '', editing = null) => {
    setInspPrefill(prefillItem);
    setInspEditing(editing);
    setShowInspModal(true);
  };
  const handleCloseInspModal = () => {
    setShowInspModal(false);
    setInspEditing(null);
    setInspPrefill('');
  };
  const handleInspSaved = () => {
    setRefreshKey(k => k + 1);
  };
  const handleDeleteInspection = async (id) => {
    if (!window.confirm('確定刪除此抽查記錄？')) return;
    await supabase.from('construction_inspections').delete().eq('id', id);
    setRefreshKey(k => k + 1);
  };

  // ── 施工日誌：檢視模式 ─────────────────────────────────────
  if (viewMode === 'view' && diaryReport) {
    return (
      <div className="dj-root">
        <DailyReportView
          report={diaryReport}
          onBack={() => setViewMode('summary')}
          onEdit={handleEditDiary}
        />
      </div>
    );
  }

  // ── 施工日誌：表單模式 ─────────────────────────────────────
  if (viewMode === 'form') {
    return (
      <div className="dj-root">
        <DailyReportForm
          existing={diaryFormExisting}
          projectId={projectId}
          project={mockProject}
          onBack={() => diaryFormExisting?.id ? setViewMode('view') : setViewMode('summary')}
          onSave={handleSaveDiary}
        />
      </div>
    );
  }

  // ── 摘要相關運算 ──────────────────────────────────────────────
  const selActual  = summary?.progress?.actual_progress  ?? summary?.log?.actual_progress  ?? null;
  const selPlanned = summary?.progress?.planned_progress ?? summary?.log?.planned_progress ?? null;
  const meaningfulItems = (summary?.workItems || []).filter(wi => wi.today_qty >= 0.1);
  const noteText = cleanNotes(summary?.log?.notes);
  const detectedMaterials = detectKeyMaterials(summary?.log?.work_items, summary?.workItems);
  const hasSelfInsp = detectSelfInspection(summary?.log?.work_items, summary?.workItems);

  // ── 日曆 ────────────────────────────────────────────────────
  const calendarEl = (
    <div className="dj-calendar">
      {/* 選取日期置頂顯示（教學牌上方） */}
      {selectedKey && (
        <div className="dj-date-topbar">
          <span className="dj-date-topbar-text">
            {selectedKey?.replace(/^(\d+)-(\d+)-(\d+)$/, (_, y, m, d) => `${y} 年 ${+m} 月 ${+d} 日`)}
          </span>
        </div>
      )}
      <div className="dj-month-nav">
        <button onClick={prevMonth}><ChevronLeft size={16} /></button>
        <span className="dj-month-label">{year} 年 {month + 1} 月</span>
        <button onClick={nextMonth}><ChevronRight size={16} /></button>
        {autoSyncing
          ? <span className="dj-sync-status"><Loader2 size={11} className="animate-spin" />同步中</span>
          : project?.drive_folder_id && (
            <button className="dj-sync-btn" onClick={() => { setSyncFilled(0); setShowDriveSync(true); }}>
              <RefreshCcw size={11} />同步
            </button>
          )
        }
        {syncFilled > 0 && (
          <span className="dj-sync-filled" title={`補漏同步新增 ${syncFilled} 個日期`}>
            +{syncFilled}
          </span>
        )}
        <button className="dj-cal-toggle" onClick={() => setCalCollapsed(c => !c)} title={calCollapsed ? '展開日曆' : '收合日曆'}>
          {calCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {calCollapsed && selectedKey && (
        <div className="dj-cal-collapsed-date">
          <button className="dj-nav-btn" onClick={() => changeDay(-1)}><ChevronLeft size={15} /></button>
          <span className="dj-collapsed-datetext">{selectedKey}</span>
          <button className="dj-nav-btn" onClick={() => changeDay(1)}><ChevronRight size={15} /></button>
        </div>
      )}

      {!calCollapsed && (
        <>
          <div className="dj-dow-row">
            {DOW.map(d => <div key={d} className="dj-dow-cell">{d}</div>)}
          </div>
          <div className="dj-day-grid">
            {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const d   = i + 1;
              const key = toKey(year, month, d);
              const hasDi = diaryDates.has(key);
              const hasSu = supervisionDates.has(key);
              const isToday    = key === todayKey;
              const isSelected = key === selectedKey;
              const dow = (firstDow + i) % 7;
              return (
                <button
                  key={d}
                  className={`dj-day-btn${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`}
                  style={{ color: dow === 0 ? '#ef4444' : dow === 6 ? '#3b82f6' : undefined }}
                  onClick={() => handleSelectDate(key, isSelected)}
                >
                  {d}
                  {(hasDi || hasSu) && (
                    <div className="dj-day-dots">
                      <span className={`dj-dot${hasDi ? ' diary' : ''}`} />
                      <span className={`dj-dot${hasSu ? ' sup' : ''}`} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="dj-legend">
            <span><span className="dj-dot diary" />施工日誌</span>
            <span><span className="dj-dot sup" />監造報表</span>
          </div>
        </>
      )}
    </div>
  );

  // ── 摘要面板 ────────────────────────────────────────────────
  const summaryEl = selectedKey ? (
    loadingSummary ? (
      <div className="dj-empty" style={{ padding: '20px 0' }}>載入中…</div>
    ) : !summary ? null : (
      <div className="dj-summary">

        {/* 標題列：日期 + 刪除按鈕 */}
        <div className="dj-summary-header">
          <span className="dj-summary-date">{selectedKey}</span>
          {(hasDiary || hasSup) && (
            <button className="dj-delete-btn" onClick={handleDeleteDate} title="刪除此日所有資料">
              <Trash2 size={13} /> 刪除
            </button>
          )}
        </div>

        {/* 天氣 */}
        {(summary.log?.weather_am || summary.log?.weather_pm) && (
          <div className="dj-weather-row">
            <Cloud size={12} />
            <span>上午 {summary.log.weather_am || '—'}</span>
            <span className="dj-weather-sep" />
            <span>下午 {summary.log.weather_pm || '—'}</span>
          </div>
        )}

        {/* ── 施工日誌區塊 ── */}
        <div className="dj-coexist-block diary-block">
          <div className="dj-coexist-title">
            {hasDiary ? <CheckCircle2 size={13} /> : <Circle size={13} />}
            施工日誌
            {/* 已有日誌：查看按鈕 */}
            {hasDiary && (
              <button className="dj-goto-btn" onClick={handleOpenDiary} title="查看施工日誌">
                <ExternalLink size={11} />
              </button>
            )}
          </div>
          {meaningfulItems.length > 0 ? (
            <div className="dj-item-list">
              {meaningfulItems.map((wi, i) => (
                <div key={i} className="dj-item-row">
                  <span className="dj-item-name">{wi.item_name}</span>
                  <span className="dj-item-qty">{wi.today_qty} {wi.unit || ''}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="dj-empty">
              {hasDiary ? '尚無施工工項記錄' : '施工日誌尚未填寫'}
            </div>
          )}
          {/* 尚無日誌：新增按鈕 */}
          {!hasDiary && (
            <button
              className="dj-new-diary-btn"
              onClick={handleOpenDiary}
            >
              <Plus size={12} /> 新增施工日誌
            </button>
          )}
        </div>

        {/* ── 材料進場管制區塊 ── */}
        <div className="dj-coexist-block material-block">
          <div className="dj-coexist-title">
            <Package size={13} />
            材料進場管制
            <span className="dj-mat-summary-badge">
              進場 {materialStatus.entries.length} 筆 · 試驗 {materialStatus.tests.length} 筆
            </span>
          </div>
          {detectedMaterials.length > 0 ? (
            <div className="dj-mat-rows">
              {detectedMaterials.map(mat => {
                const ec = materialStatus.entries.filter(e => (e.name || '').includes(mat.keyword)).length;
                const tc = materialStatus.tests.filter(t => (t.name || '').includes(mat.keyword)).length;
                return (
                  <div key={mat.keyword} className="dj-mat-row">
                    <span className="dj-mat-name">{mat.label}</span>
                    <span className={`dj-mat-badge${ec > 0 ? ' ok' : ' warn'}`}>
                      進場 {ec > 0 ? `${ec} 筆` : '未登錄'}
                    </span>
                    <span className={`dj-mat-badge${tc > 0 ? ' ok' : ' warn'}`}>
                      試驗 {tc > 0 ? `${tc} 筆` : '未登錄'}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="dj-empty" style={{ marginBottom: 6 }}>
              {hasDiary ? '日誌未記載重點管制材料（混凝土／鋼筋／瀝青等）' : '尚無施工日誌'}
            </div>
          )}
          <button className="dj-mat-link" onClick={() => navigate(`/projects/${projectId}/material`)}>
            前往材料管制 →
          </button>
        </div>

        {/* ── 當日抽查區塊 ── */}
        <div className="dj-coexist-block insp-block">
          <div className="dj-coexist-title">
            <ClipboardCheck size={13} />
            當日抽查
            <span className="dj-insp-count-badge">
              已登錄 {inspections.length} 筆
              {inspections.filter(i => i.result === '不合格').length > 0 &&
                ` · 不合格 ${inspections.filter(i => i.result === '不合格').length}`}
            </span>
            <button
              className="dj-insp-add-btn"
              onClick={() => handleOpenInspModal('')}
              title="新增抽查記錄"
            >
              <Plus size={11} /> 新增
            </button>
          </div>

          {/* 自主檢查提示 */}
          {hasSelfInsp && inspections.filter(i => i.inspect_type === '施工抽查').length === 0 && (
            <div className="dj-selfinsp-prompt" onClick={() => handleOpenInspModal('')}>
              <AlertTriangle size={12} />
              廠商本日有自主檢查記錄，尚未登錄施工抽查，點此新增
            </div>
          )}

          {/* 已登錄的抽查清單 */}
          {inspections.length > 0 && (
            <div className="dj-insp-list">
              {inspections.map(ins => (
                <div key={ins.id} className="dj-insp-row">
                  <span className={`dj-insp-result-dot ${
                    ins.result === '合格' ? 'ok'
                    : ins.result === '不合格' ? 'bad'
                    : 'warn'
                  }`}>
                    {ins.result === '合格' ? '✓' : ins.result === '不合格' ? '✗' : '○'}
                  </span>
                  <span className="dj-insp-item" title={ins.work_item}>{ins.work_item}</span>
                  <span className="dj-insp-meta">
                    {ins.location && <span className="dj-insp-loc">{ins.location}</span>}
                    {ins.inspector && <span className="dj-insp-person">· {ins.inspector}</span>}
                  </span>
                  <span className={`dj-insp-result-tag ${
                    ins.result === '合格' ? 'ok'
                    : ins.result === '不合格' ? 'bad'
                    : 'warn'
                  }`}>{ins.result}</span>
                  {ins.result === '不合格' && (
                    <AlertTriangle size={11} className="dj-insp-alert" />
                  )}
                  <button className="dj-insp-icon-btn" onClick={() => handleOpenInspModal('', ins)} title="編輯">
                    <Edit3 size={11} />
                  </button>
                  <button className="dj-insp-icon-btn danger" onClick={() => handleDeleteInspection(ins.id)} title="刪除">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 未抽查的工項（從廠商同步的工項中過濾已抽查過的） */}
          {meaningfulItems.filter(wi =>
            !inspections.some(ins => ins.work_item === wi.item_name)
          ).length > 0 && (
            <div className="dj-insp-pending">
              <div className="dj-insp-pending-title">待抽查工項</div>
              <div className="dj-insp-pending-list">
                {meaningfulItems
                  .filter(wi => !inspections.some(ins => ins.work_item === wi.item_name))
                  .map((wi, i) => (
                    <button
                      key={i}
                      className="dj-insp-pending-chip"
                      onClick={() => handleOpenInspModal(wi.item_name)}
                      title={`對「${wi.item_name}」新增抽查`}
                    >
                      <Plus size={10} /> {wi.item_name}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {inspections.length === 0 && meaningfulItems.length === 0 && (
            <div className="dj-empty" style={{ marginTop: 4 }}>
              尚無抽查記錄，點擊「新增」開始登錄
            </div>
          )}
        </div>

        {/* ── 監造報表區塊 ── */}
        <div className="dj-coexist-block sup-block">
          <div className="dj-coexist-title">
            {hasSup ? <CheckCircle2 size={13} /> : <Circle size={13} />}
            監造報表
            {hasSup && (
              <button className="dj-goto-btn" onClick={() => navigate(`/projects/${projectId}/supervision?date=${selectedKey}`)} title="前往監造報表">
                <ExternalLink size={11} />
              </button>
            )}
          </div>
          {noteText ? (
            <div className="dj-note-text">{noteText}</div>
          ) : (
            <div className="dj-empty">
              {hasSup ? '尚無備註' : '監造報表尚未上傳'}
            </div>
          )}
        </div>

        {/* 進度 */}
        <div className="dj-section">
          <div className="dj-section-title">進度</div>
          {(selActual != null || selPlanned != null) ? (
            <>
              <div className="dj-progress-nums">
                <span>預定 {fmtPct(selPlanned)}</span>
                <span style={{ color: progressColor(selActual, selPlanned) }}>實際 {fmtPct(selActual)}</span>
              </div>
              <div className="dj-progress-bar-bg">
                {selPlanned != null && (
                  <div className="dj-progress-bar planned" style={{ width: `${Math.min(selPlanned, 100)}%` }} />
                )}
                {selActual != null && (
                  <div className="dj-progress-bar actual" style={{
                    width: `${Math.min(selActual, 100)}%`,
                    background: progressColor(selActual, selPlanned),
                  }} />
                )}
              </div>
            </>
          ) : <div className="dj-empty">尚無進度資料</div>}
        </div>

      </div>
    )
  ) : null;

  // ── 摘要模式主體 ─────────────────────────────────────────────
  return (
    <div className="dj-root">

      {/* Header */}
      <div className="dj-header">
        <h1 className="dj-title">日誌報表</h1>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {selectedKey && <div className="dj-header-date">{selectedKey}</div>}
          <button
            className="btn-dash-action"
            onClick={() => setShowImport(true)}
            title="PDF 匯入施工日誌"
          >
            <FileText size={14} /><span>PDF 匯入</span>
          </button>
          <button
            className="btn-dash-action"
            onClick={() => {
              setDiaryFormExisting(selectedKey ? { date: selectedKey } : null);
              setViewMode('form');
            }}
            title="新增施工日誌"
          >
            <Plus size={14} /><span>新增日誌</span>
          </button>
        </div>
      </div>

      {/* 主體 */}
      <div className={`dj-body${selectedKey ? ' has-selection' : ''}`}>
        <div className="dj-cal-col">
          {calendarEl}
        </div>

        {summaryEl
          ? <div className="dj-summary-col">{summaryEl}</div>
          : <div className="dj-placeholder">點選日期查看摘要</div>
        }
      </div>

      {showDriveSync && (
        <DriveSyncModal
          projectId={projectId}
          startDate={project?.start_date || ''}
          onClose={() => setShowDriveSync(false)}
          onSuccess={() => { setShowDriveSync(false); setRefreshKey(k => k + 1); refreshReports(); }}
        />
      )}

      {showImport && (
        <DiaryImportModal
          projectId={projectId}
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); setRefreshKey(k => k + 1); refreshReports(); }}
        />
      )}

      {showInspModal && (
        <InspectionQuickModal
          projectId={projectId}
          inspectDate={selectedKey}
          existing={inspEditing || (inspPrefill ? { work_item: inspPrefill } : null)}
          onClose={handleCloseInspModal}
          onSuccess={handleInspSaved}
        />
      )}
    </div>
  );
}

// ── 外層元件：提供 DailyReportContext ──────────────────────────
export function DiaryJournal() {
  const { id: projectId } = useParams();
  return (
    <DailyReportProvider projectId={projectId}>
      <DiaryJournalInner />
    </DailyReportProvider>
  );
}
