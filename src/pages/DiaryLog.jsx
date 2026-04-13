import React, { useState, useEffect, useMemo, useContext, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CloudDownload, Calendar, CloudOff, RefreshCcw, PlusCircle, BookOpen, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { C } from './DailyReport/utils';
import { DailyReportProvider, DailyReportContext } from './DailyReport/DailyReportContext';
import { DailyReportView } from './DailyReport/DailyReportView';
import { DiaryImportModal } from '../components/DiaryImportModal';
import { QuickDiaryModal } from '../components/QuickDiaryModal';
import { DriveSyncModal } from '../components/DriveSyncModal';

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
  // 累積型日誌：最新檔案已包含所有歷史日期，只同步它即可
  const latest = files[files.length - 1];
  await fetch(EDGE_FN_URL, {
    method: 'POST', headers,
    body: JSON.stringify({ mode: 'sync_one', projectId, fileId: latest.id, fileName: latest.name, secret: syncSecret }),
  }).catch(() => {});
  return 1;
}
import './DiaryLog.css';

const dowHeaders = ["日", "一", "二", "三", "四", "五", "六"];

function cleanNotes(raw) {
  if (!raw) return '';
  const lines = raw.split('\n');
  const cut = lines.findIndex(l => /^[一二三四五六七八九十]+[、]/.test(l.trim()));
  return (cut === -1 ? lines : lines.slice(0, cut)).join('\n').trim();
}
function fmtPct(v) {
  if (v == null) return '—';
  const n = parseFloat(v);
  return isNaN(n) ? '—' : parseFloat(n.toFixed(2)) + '%';
}
function progressColor(actual, planned) {
  if (actual == null) return 'var(--color-primary)';
  if (actual >= planned) return '#10b981';
  if (actual >= planned * 0.95) return '#f59e0b';
  return '#ef4444';
}

function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDow(y, m) { return new Date(y, m, 1).getDay(); }
function toKey(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function toRoc(y, m, d) {
    return `${y - 1911}.${String(m + 1).padStart(2, "0")}.${String(d).padStart(2, "0")}`;
}

export function DiaryLog() {
  const { id: projectId } = useParams();
  return (
    <DailyReportProvider projectId={projectId}>
      <DiaryLogInner />
    </DailyReportProvider>
  );
}

function DiaryLogInner() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initDate = searchParams.get('date');

  const { reports, loading: reportsLoading, refresh } = useContext(DailyReportContext);

  const today = new Date();
  const [year, setYear] = useState(() => initDate ? parseInt(initDate.slice(0, 4)) : today.getFullYear());
  const [month, setMonth] = useState(() => initDate ? parseInt(initDate.slice(5, 7)) - 1 : today.getMonth());
  const [selectedDay, setSelectedDay] = useState(() => initDate ? parseInt(initDate.slice(8, 10)) : null);

  const [project, setProject] = useState(null);
  const [logs, setLogs] = useState([]);
  const [_loading, setLoading] = useState(true);
  const [_error, setError] = useState(null);
  
  const [showImportModal,  setShowImportModal]  = useState(false);
  const [showQuickModal,   setShowQuickModal]   = useState(false);
  const [quickInitialData, setQuickInitialData] = useState(null);
  const [refreshTrigger,   setRefreshTrigger]   = useState(0);
  const [showDriveSync,    setShowDriveSync]    = useState(false);
  const [autoSyncing,      setAutoSyncing]      = useState(false);
  const autoSyncedRef = useRef(false);
  const [diaryDataCache,   setDiaryDataCache]   = useState({}); // dateKey → initialData
  const [tabD, setTabD] = useState('work');

  useEffect(() => {
    setLogs([]);
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setError(null);

      // Fetch project name
      const { data: proj } = await supabase
        .from('projects')
        .select('name, contractor, status, start_date, drive_folder_id')
        .eq('id', projectId)
        .single();
      setProject(proj);

      const startOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;
      
      const { data, error: logErr } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('project_id', projectId)
        .gte('log_date', startOfMonth)
        .lte('log_date', endOfMonth);

      if (cancelled) return;
      if (logErr) setError(logErr.message);
      else setLogs(data ?? []);

      setLoading(false);
    }
    if (projectId) fetchData();
    return () => { cancelled = true; };
  }, [projectId, year, month, refreshTrigger]);


  const daysInMonth = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const firstDow = useMemo(() => getFirstDow(year, month), [year, month]);
  const todayKey = toKey(today.getFullYear(), today.getMonth(), today.getDate());

  const prevMonth = () => { if (month === 0) { setYear(year - 1); setMonth(11); } else setMonth(month - 1); setSelectedDay(null); };
  const nextMonth = () => { if (month === 11) { setYear(year + 1); setMonth(0); } else setMonth(month + 1); setSelectedDay(null); };

  // Map logs to importedData
  const importedData = useMemo(() => {
    const map = {};
    logs.forEach(l => {
        let weatherStr = l.weather_am;
        if (l.weather_pm && l.weather_pm !== l.weather_am) weatherStr += ` / ${l.weather_pm}`;
        if (!weatherStr) weatherStr = '--';

        map[l.log_date] = {
            weather: weatherStr,
            summary: l.work_items || l.notes || '無施工記事',
            tags: ['監造報表'],
            progress: l.actual_progress || l.cumulative_progress || 0,
            syncSource: l.sync_source || 'manual',
            syncedAt: l.synced_at,
        };
    });
    return map;
  }, [logs]);

  const selectedKey    = selectedDay ? toKey(year, month, selectedDay) : null;
  const selectedLog    = selectedKey ? (logs.find(l => l.log_date === selectedKey) ?? null) : null;
  const selectedReport = selectedKey ? (reports.find(r => r.date === selectedKey) ?? null) : null;
  const importedCount  = Object.keys(importedData).length;

  // 選擇日期時，從施工日誌（DB + localStorage）預取資料供「從施工日誌帶出」使用
  const fetchDiaryInitialData = async (dateKey) => {
    if (diaryDataCache[dateKey] !== undefined) return;

    // 1. 先查 daily_report_items（Drive 同步寫入的工項）
    const { data: dbItems } = await supabase
      .from('daily_report_items')
      .select('item_name, unit, today_qty')
      .eq('project_id', projectId)
      .eq('log_date', dateKey);

    // 2. 再查 localStorage（手動建立的施工日誌）
    let localMatch = null;
    try {
      const stored = JSON.parse(localStorage.getItem(`daily_reports_${projectId}`) || '[]');
      localMatch = stored.find(r => r.date === dateKey) || null;
    } catch {}

    // 3. 組合工項文字
    const dbWorkText = (dbItems || [])
      .map(it => `${it.item_name}：${it.today_qty} ${it.unit || ''}`.trim())
      .join('\n');
    const localWorkText = localMatch
      ? [...(localMatch.quantities || []).map(q => `${q.item}：${q.todayQty} ${q.unit}`).filter(s => s.trim() !== '：'), localMatch.specialNote]
          .filter(Boolean).join('\n')
      : '';

    const workText = dbWorkText || localWorkText;
    if (!workText && !localMatch) {
      setDiaryDataCache(prev => ({ ...prev, [dateKey]: null }));
      return;
    }

    setDiaryDataCache(prev => ({
      ...prev,
      [dateKey]: {
        weather_am: localMatch?.weather || '晴',
        weather_pm: localMatch?.weather || '晴',
        work_items: workText,
        notes: localMatch?.progressNote || '',
        planned_progress: localMatch?.plannedProgress || null,
        actual_progress:  localMatch?.actualProgress  || null,
      },
    }));
  };

  // ── initDate 模式：直接從 DiaryJournal 跳入，不顯示日曆 ─────────────
  if (initDate) {
    const goBack = () => navigate(`/projects/${projectId}/journal`);
    if (reportsLoading) return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: C.textMuted, fontSize: '0.82rem' }}>載入中…</div>
    );
    if (selectedReport) return (
      <div style={{ padding: '16px', overflow: 'auto', height: '100%', boxSizing: 'border-box' }}>
        <DailyReportView
          report={selectedReport}
          supervision={true}
          onBack={goBack}
          onEdit={() => navigate(`/projects/${projectId}/diary?date=${initDate}`)}
        />
      </div>
    );
    // 施工日誌尚未建立
    return (
      <div style={{ padding: '16px', overflow: 'auto', height: '100%', boxSizing: 'border-box' }}>
        <header className="page-section-header" style={{ marginBottom: 12 }}>
          <div className="header-left">
            <button className="btn-dash-action" onClick={goBack} style={{ marginRight: 8 }}>
              <ArrowLeft size={13} /><span>返回日誌報表</span>
            </button>
            <span className="section-label">監造報表　{initDate}</span>
          </div>
        </header>
        <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
          <CloudOff size={36} color="var(--color-border)" style={{ margin: '0 auto 12px', display: 'block' }} />
          <p style={{ fontSize: '0.85rem', color: C.textMuted, marginBottom: 4 }}>尚未建立施工日誌</p>
          <p style={{ fontSize: '0.75rem', color: C.textMuted, marginBottom: 16 }}>請先建立施工日誌，監造報表將自動複製其內容</p>
          <button onClick={() => navigate(`/projects/${projectId}/diary?date=${initDate}`)}
            style={{ padding: '8px 20px', borderRadius: 8, border: '1.5px solid var(--color-primary)', background: 'rgba(37,99,235,0.07)', color: 'var(--color-primary)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
            前往建立施工日誌
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="diary-log-page">
      <header className="page-section-header">
        <div className="header-left">
          <span className="section-label">監造報表檢索</span>
          <span className="section-sub-label">MAPPING SYSTEM</span>
        </div>
        <div className="header-actions">
            <span className="status-badge success">本月 {importedCount} 筆已匯入</span>
            {project?.drive_folder_id && (
              <button
                onClick={() => setShowDriveSync(true)}
                className="btn-dash-action"
                disabled={autoSyncing}
                style={{ background: 'rgba(59,130,246,0.1)', color: '#2563eb', borderColor: 'rgba(59,130,246,0.3)', opacity: autoSyncing ? 0.7 : 1 }}
              >
                {autoSyncing
                  ? <><Loader2 size={13} className="animate-spin" /><span>同步中…</span></>
                  : <><RefreshCcw size={13} /><span>Drive 回朔同步</span></>
                }
              </button>
            )}
            <button
                onClick={() => setShowImportModal(true)}
                className="btn-dash-action"
            >
                <CloudDownload size={14} />
                <span>PDF 匯入</span>
            </button>
        </div>
      </header>
      
      {/* B-version Calendar and details grid */}
      <div className={initDate ? '' : 'b-dash-content-grid'}>
         {/* Left: Calendar — hidden when navigated from DiaryJournal */}
         {!initDate && <div className="b-content-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <button onClick={prevMonth} style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: 'var(--color-bg2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text2)' }}>
                    &lt;
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select value={year} onChange={e => { setYear(Number(e.target.value)); setSelectedDay(null); }}
                        style={{ fontSize: '13px', background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer', color: 'var(--color-text1)' }}>
                        {Array.from({ length: 10 }, (_, i) => 2020 + i).map(y => <option key={y} value={y}>{y - 1911} 年 ({y})</option>)}
                    </select>
                    <select value={month} onChange={e => { setMonth(Number(e.target.value)); setSelectedDay(null); }}
                        style={{ fontSize: '13px', background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer', color: 'var(--color-text1)' }}>
                        {Array.from({ length: 12 }, (_, i) => i).map(m => <option key={m} value={m}>{m + 1} 月</option>)}
                    </select>
                </div>
                <button onClick={nextMonth} style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: 'var(--color-bg2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text2)' }}>
                    &gt;
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '2px' }}>
                {dowHeaders.map(d => (<div key={d} style={{ textAlign: 'center', fontSize: '11px', color: 'var(--color-text-muted)', padding: '4px 0' }}>{d}</div>))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                {Array.from({ length: firstDow }).map((_, i) => <div key={`b${i}`} style={{ aspectRatio: '1/1' }} />)}
                {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const key = toKey(year, month, day);
                    const isToday = key === todayKey;
                    const isFuture = new Date(year, month, day) > today;
                    const hasData = !!importedData[key];
                    const isSelected = selectedDay === day;
                    const isSun = new Date(year, month, day).getDay() === 0;
                    const isSat = new Date(year, month, day).getDay() === 6;
                    
                    let btnBg = 'transparent';
                    if (isSelected) btnBg = 'rgba(15,82,186,0.1)';
                    else if (isToday && !isSelected) btnBg = 'var(--color-bg2)';

                    let color = 'var(--color-text-muted)';
                    if (isFuture) color = 'var(--color-border)';
                    else if (isSun) color = '#ef4444';
                    else if (isSat) color = '#0ea5e9';
                    else color = 'var(--color-text2)';
                    if (isToday) color = 'var(--color-primary)';
                    if (isSelected) color = 'var(--color-primary)';

                    return (
                        <button key={day} disabled={isFuture} onClick={() => { const d = isSelected ? null : day; setSelectedDay(d); if (d) fetchDiaryInitialData(toKey(year, month, d)); }}
                            style={{ 
                                aspectRatio: '1/1', borderRadius: '8px', border: isSelected ? '1px solid var(--color-primary)' : '1px solid transparent',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                background: btnBg, cursor: isFuture ? 'not-allowed' : 'pointer', color: color,
                                transition: 'all 0.2s', padding: 0
                            }}
                        >
                            <span style={{ fontSize: '13px', fontWeight: isToday || isSelected ? 600 : 400 }}>{day}</span>
                            {!isFuture && (
                                <div style={{
                                    width: '6px', height: '6px', borderRadius: '50%', marginTop: '4px',
                                    background: hasData
                                        ? (importedData[key]?.syncSource === 'google_drive' ? '#2563eb' : 'var(--color-success)')
                                        : 'var(--color-border)'
                                }} />
                            )}
                        </button>
                    );
                })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--color-block-border)', fontSize: '11px', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-success)' }} />手動建檔</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb' }} />Drive 同步</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-border)' }} />未匯入</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-primary)' }} />今天</span>
            </div>
         </div>}

         {/* Right: Detail panel */}
         <div style={{ overflow: 'auto' }}>
            {selectedDay && selectedKey ? (
              selectedReport ? (
                <DailyReportView
                  report={selectedReport}
                  supervision={true}
                  onBack={() => setSelectedDay(null)}
                  onEdit={() => navigate(`/projects/${projectId}/diary?date=${selectedKey}`)}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
                  <CloudOff size={32} color="var(--color-border)" style={{ margin: '0 auto 10px', display: 'block' }} />
                  <p style={{ fontSize: '0.82rem', color: C.textMuted, marginBottom: 4 }}>尚未建立施工日誌</p>
                  <p style={{ fontSize: '0.72rem', color: C.textMuted, marginBottom: 14 }}>請先建立施工日誌，監造報表將自動複製其內容</p>
                  <button onClick={() => navigate(`/projects/${projectId}/diary?date=${selectedKey}`)}
                    style={{ padding: '7px 16px', borderRadius: 8, border: '1.5px solid var(--color-primary)', background: 'rgba(37,99,235,0.07)', color: 'var(--color-primary)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                    前往建立施工日誌
                  </button>
                </div>
              )
            ) : (
              <div className="b-content-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
                <Calendar size={36} color="var(--color-border)" style={{ marginBottom: '12px' }} />
                <p style={{ fontSize: '13px', color: C.textMuted }}>點選左方日期查看報表內容</p>
              </div>
            )}

            {/* 本月匯入統計 — 直接進入模式時隱藏 */}
            {!initDate && (
              <div className="b-content-panel" style={{ padding: '20px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '16px' }}>本月匯入統計</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-success)' }}>{importedCount}</span>
                    <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>已匯入</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                      {(() => {
                        let c = 0;
                        for (let d = 1; d <= daysInMonth; d++) {
                          const dt = new Date(year, month, d);
                          if (dt <= today && !importedData[toKey(year, month, d)] && dt.getDay() !== 0 && dt.getDay() !== 6) c++;
                        }
                        return c;
                      })()}
                    </span>
                    <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>未匯入(工作日)</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-border)' }}>
                      {(() => { let c = 0; for (let d = 1; d <= daysInMonth; d++) { if (new Date(year, month, d) > today) c++; } return c; })()}
                    </span>
                    <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>未到日期</span>
                  </div>
                </div>
              </div>
            )}
         </div>
      </div>
      
      {showImportModal && (
        <DiaryImportModal
          projectId={projectId}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => setRefreshTrigger(prev => prev + 1)}
        />
      )}
      {showQuickModal && selectedKey && (
        <QuickDiaryModal
          projectId={projectId}
          logDate={selectedKey}
          initialData={quickInitialData}
          onClose={() => { setShowQuickModal(false); setQuickInitialData(null); }}
          onSuccess={() => { setShowQuickModal(false); setQuickInitialData(null); setRefreshTrigger(prev => prev + 1); }}
        />
      )}
      {showDriveSync && (
        <DriveSyncModal
          projectId={projectId}
          startDate={project?.start_date || ''}
          onClose={() => setShowDriveSync(false)}
          onSuccess={() => { setShowDriveSync(false); setRefreshTrigger(t => t + 1); refresh?.(); }}
        />
      )}
    </div>
  );
}
