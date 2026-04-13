import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Cloud, ChevronDown, ChevronUp, RefreshCcw, Loader2, Trash2, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { DriveSyncModal } from '../components/DriveSyncModal';
import './DiaryJournal.css';

const EDGE_FN_URL = 'https://xbdchvmxgmypcyawavju.supabase.co/functions/v1/sync-diary';
async function runBackgroundSync(projectId, startDate) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  const syncSecret = import.meta.env.VITE_SYNC_SECRET || '';
  const listRes = await fetch(EDGE_FN_URL, {
    method: 'POST', headers,
    body: JSON.stringify({ mode: 'list', projectId, startDate, secret: syncSecret }),
  });
  if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);
  const { files = [] } = await listRes.json();
  if (files.length === 0) return 0;
  // 最新檔案已包含所有日期，只同步它即可
  const latest = files[files.length - 1];
  await fetch(EDGE_FN_URL, {
    method: 'POST', headers,
    body: JSON.stringify({ mode: 'sync_one', projectId, fileId: latest.id, fileName: latest.name, secret: syncSecret }),
  }).catch(() => {});
  return 1;
}

const DOW = ['日', '一', '二', '三', '四', '五', '六'];

function toKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDow(y, m)    { return new Date(y, m, 1).getDay(); }

/** 過濾施工日誌模板樣板文字，保留真正的備註 */
function cleanNotes(raw) {
  if (!raw) return '';
  const lines = raw.split('\n');
  const cutIdx = lines.findIndex(l => /^[一二三四五六七八九十]+[、]/.test(l.trim()));
  return (cutIdx === -1 ? lines : lines.slice(0, cutIdx)).join('\n').trim();
}

/** 格式化百分比，最多 2 位小數 */
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

export function DiaryJournal() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();

  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState(null);

  const [calCollapsed, setCalCollapsed] = useState(false);

  const [project,        setProject]        = useState(null);
  const [showDriveSync,  setShowDriveSync]  = useState(false);
  const [autoSyncing,    setAutoSyncing]    = useState(false);
  const autoSyncedRef = useRef(false);
  const [refreshKey,     setRefreshKey]     = useState(0);

  const [diaryDates,       setDiaryDates]       = useState(new Set());
  const [supervisionDates, setSupervisionDates] = useState(new Set());
  const [summary,          setSummary]          = useState(null);
  const [loadingSummary,   setLoadingSummary]   = useState(false);

  // ── 取工程資訊（drive_folder_id）─────────────────────────────
  useEffect(() => {
    supabase.from('projects')
      .select('drive_folder_id, start_date')
      .eq('id', projectId).single()
      .then(({ data }) => { if (data) setProject(data); });
  }, [projectId]);

  // ── 進頁自動背景同步 ──────────────────────────────────────────
  useEffect(() => {
    if (!project?.drive_folder_id || autoSyncedRef.current) return;
    autoSyncedRef.current = true;
    setAutoSyncing(true);
    runBackgroundSync(projectId, project.start_date)
      .then(count => { if (count > 0) setRefreshKey(k => k + 1); })
      .catch(() => {})
      .finally(() => setAutoSyncing(false));
  }, [project?.drive_folder_id, projectId]);

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
      // 藍點：daily_report_items 或 daily_logs 有資料（手動填寫 or Drive 同步皆涵蓋）
      const combined = new Set([
        ...(dri.data || []).map(r => r.log_date),
        ...dlDates,
      ]);
      setDiaryDates(combined);
      // 綠點：daily_logs 有資料（Drive 同步寫入）
      setSupervisionDates(dlDates);
    });
    return () => { cancelled = true; };
  }, [projectId, year, month, refreshKey]);

  // ── 取選定日期摘要 ─────────────────────────────────────────
  useEffect(() => {
    if (!selectedKey) { setSummary(null); return; }
    setLoadingSummary(true);
    Promise.all([
      supabase.from('daily_report_items')
        .select('item_name, unit, today_qty')
        .eq('project_id', projectId).eq('log_date', selectedKey),
      supabase.from('daily_logs')
        .select('weather_am, weather_pm, notes, actual_progress, planned_progress')
        .eq('project_id', projectId).eq('log_date', selectedKey).maybeSingle(),
      supabase.from('progress_records')
        .select('planned_progress, actual_progress')
        .eq('project_id', projectId).eq('report_date', selectedKey).maybeSingle(),
    ]).then(([items, log, prog]) => {
      setSummary({
        workItems: items.data || [],
        log:       log.data   || null,
        progress:  prog.data  || null,
      });
      setLoadingSummary(false);
    });
  }, [projectId, selectedKey]);

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

  // 行動版：前後一天
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

  // 刪除選定日期的所有日誌資料
  const handleDeleteDate = async () => {
    if (!selectedKey) return;
    if (!window.confirm(`確定刪除 ${selectedKey} 的所有日誌及監造資料？此操作無法復原。`)) return;
    await Promise.all([
      supabase.from('daily_logs').delete().eq('project_id', projectId).eq('log_date', selectedKey),
      supabase.from('daily_report_items').delete().eq('project_id', projectId).eq('log_date', selectedKey),
      supabase.from('progress_records').delete().eq('project_id', projectId).eq('report_date', selectedKey),
    ]);
    // 清 localStorage
    try {
      const stored = JSON.parse(localStorage.getItem(`daily_reports_${projectId}`) || '[]');
      localStorage.setItem(`daily_reports_${projectId}`, JSON.stringify(stored.filter(r => r.date !== selectedKey)));
    } catch {}
    setSelectedKey(null);
    setRefreshKey(k => k + 1);
  };

  const selActual  = summary?.progress?.actual_progress  ?? summary?.log?.actual_progress  ?? null;
  const selPlanned = summary?.progress?.planned_progress ?? summary?.log?.planned_progress ?? null;

  // 過濾有意義的施工項（排除合約比例型小數）
  const meaningfulItems = (summary?.workItems || []).filter(wi => wi.today_qty >= 0.1);
  const noteText = cleanNotes(summary?.log?.notes);

  // 選日期：行動版自動收合日曆
  function handleSelectDate(key, isSelected) {
    setSelectedKey(isSelected ? null : key);
    if (!isSelected && window.innerWidth <= 768) setCalCollapsed(true);
  }

  // ── 日曆 ────────────────────────────────────────────────────
  const calendarEl = (
    <div className="dj-calendar">
      <div className="dj-month-nav">
        <button onClick={prevMonth}><ChevronLeft size={16} /></button>
        <span className="dj-month-label">{year} 年 {month + 1} 月</span>
        <button onClick={nextMonth}><ChevronRight size={16} /></button>
        {autoSyncing
          ? <span className="dj-sync-status"><Loader2 size={11} className="animate-spin" />同步中</span>
          : project?.drive_folder_id && (
            <button className="dj-sync-btn" onClick={() => setShowDriveSync(true)}>
              <RefreshCcw size={11} />同步
            </button>
          )
        }
        {/* 收合切換 */}
        <button className="dj-cal-toggle" onClick={() => setCalCollapsed(c => !c)} title={calCollapsed ? '展開日曆' : '收合日曆'}>
          {calCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {/* 收合時：若有選定日期則顯示日期 + 前後一天導覽 */}
      {calCollapsed && selectedKey && (
        <div className="dj-cal-collapsed-date">
          <button className="dj-nav-btn" onClick={() => changeDay(-1)}><ChevronLeft size={15} /></button>
          <span className="dj-collapsed-datetext">{selectedKey}</span>
          <button className="dj-nav-btn" onClick={() => changeDay(1)}><ChevronRight size={15} /></button>
        </div>
      )}

      {/* 展開時：完整日曆 */}
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
            {hasDiary && (
              <button className="dj-goto-btn" onClick={() => navigate(`/projects/${projectId}/diary?date=${selectedKey}`)} title="前往施工日誌">
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
              {hasDiary ? '尚無施工工項記錄' : '施工日誌尚未上傳'}
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

  return (
    <div className="dj-root">

      {/* Header：標題 + Drive同步按鈕 + PC端選定日期 */}
      <div className="dj-header">
        <h1 className="dj-title">日誌報表</h1>
        {selectedKey && <div className="dj-header-date">{selectedKey}</div>}
      </div>

      {/* 主體 */}
      <div className={`dj-body${selectedKey ? ' has-selection' : ''}`}>
        <div className="dj-cal-col">
          {calendarEl}
        </div>

        {/* 摘要欄 */}
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
          onSuccess={() => { setShowDriveSync(false); setRefreshKey(k => k + 1); }}
        />
      )}
    </div>
  );
}
