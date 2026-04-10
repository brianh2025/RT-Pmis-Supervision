import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CloudDownload, Calendar, Edit, FileText, CloudOff, RefreshCcw, PlusCircle, BookOpen, Cloud } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { DiaryImportModal } from '../components/DiaryImportModal';
import { QuickDiaryModal } from '../components/QuickDiaryModal';
import './DiaryLog.css'; // Minimal specific styles, relying mostly on inline and generic styles

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initDate = searchParams.get('date');

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
  const [diaryDataCache,   setDiaryDataCache]   = useState({}); // dateKey → initialData

  useEffect(() => {
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

      if (logErr) setError(logErr.message);
      else setLogs(data ?? []);

      setLoading(false);
    }
    if (projectId) fetchData();
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

  const selectedKey = selectedDay ? toKey(year, month, selectedDay) : null;
  const selectedData = selectedKey ? importedData[selectedKey] : null;
  const selectedLog  = selectedKey ? (logs.find(l => l.log_date === selectedKey) ?? null) : null;
  const importedCount = Object.keys(importedData).length;

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

  return (
    <div className="diary-log-page">
      <header className="page-section-header">
        <div className="header-left">
          {initDate && (
            <button className="btn-dash-action" onClick={() => navigate(`/projects/${projectId}/journal`)} style={{ marginRight: 8 }}>
              <ArrowLeft size={13} /><span>返回日誌報表</span>
            </button>
          )}
          <span className="section-label">{initDate ? `監造報表　${initDate}` : '監造報表檢索'}</span>
          {!initDate && <span className="section-sub-label">MAPPING SYSTEM</span>}
        </div>
        <div className="header-actions">
            {!initDate && <span className="status-badge success">本月 {importedCount} 筆已匯入</span>}
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
         <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedDay && selectedKey ? (
              <>
                {/* 標題列 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text1)' }}>監造報表　{selectedKey}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{toRoc(year, month, selectedDay)}</div>
                  </div>
                  <span style={{ fontSize: '0.72rem', padding: '3px 9px', borderRadius: 6, background: selectedLog ? 'rgba(16,185,129,0.1)' : 'var(--color-bg2)', color: selectedLog ? '#10b981' : 'var(--color-text-muted)', border: `1px solid ${selectedLog ? 'rgba(16,185,129,0.3)' : 'var(--color-border)'}` }}>
                    {selectedLog ? '已匯入' : '尚未提送'}
                  </span>
                </div>

                {selectedLog ? (
                  <>
                    {/* 天氣 */}
                    {(selectedLog.weather_am || selectedLog.weather_pm) && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 20, background: 'rgba(96,165,250,0.13)', border: '1px solid rgba(96,165,250,0.3)', color: '#3b82f6', fontSize: '0.75rem', fontWeight: 600 }}>
                        <Cloud size={12} />
                        <span>上午 {selectedLog.weather_am || '—'}</span>
                        <span style={{ width: 1, height: 10, background: 'rgba(96,165,250,0.4)', margin: '0 2px', display: 'inline-block' }} />
                        <span>下午 {selectedLog.weather_pm || '—'}</span>
                      </div>
                    )}

                    {/* 施工概況 */}
                    <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ fontSize: '0.67rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>施工概況</div>
                      {selectedLog.work_items
                        ? <div style={{ fontSize: '0.8rem', color: 'var(--color-text1)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selectedLog.work_items}</div>
                        : <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>尚無施工概況</div>
                      }
                    </div>

                    {/* 特別註記 */}
                    <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ fontSize: '0.67rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>特別註記</div>
                      {cleanNotes(selectedLog.notes)
                        ? <div style={{ fontSize: '0.8rem', color: 'var(--color-text1)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{cleanNotes(selectedLog.notes)}</div>
                        : <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>尚無備註</div>
                      }
                    </div>

                    {/* 進度 */}
                    <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ fontSize: '0.67rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>進度</div>
                      {(selectedLog.actual_progress != null || selectedLog.planned_progress != null) ? (
                        <>
                          <div style={{ display: 'flex', gap: 20, marginBottom: 8, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                            <span>預定 {fmtPct(selectedLog.planned_progress)}</span>
                            <span style={{ color: progressColor(selectedLog.actual_progress, selectedLog.planned_progress) }}>實際 {fmtPct(selectedLog.actual_progress)}</span>
                          </div>
                          <div style={{ height: 8, borderRadius: 4, background: 'var(--color-border)', overflow: 'hidden', position: 'relative' }}>
                            {selectedLog.planned_progress != null && <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${Math.min(selectedLog.planned_progress, 100)}%`, borderRadius: 4, background: 'rgba(148,163,184,0.35)' }} />}
                            {selectedLog.actual_progress != null && <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${Math.min(selectedLog.actual_progress, 100)}%`, borderRadius: 4, background: progressColor(selectedLog.actual_progress, selectedLog.planned_progress) }} />}
                          </div>
                        </>
                      ) : <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>尚無進度資料</div>}
                    </div>

                    {/* 編輯按鈕 */}
                    <button
                      onClick={() => navigate(`/projects/${projectId}/supervision/print/${selectedKey}`)}
                      style={{ width: '100%', padding: '7px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-muted)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-surface)'; }}>
                      <Edit size={14} /> 檢視 / 編輯報表
                    </button>
                  </>
                ) : (
                  <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '28px 20px', textAlign: 'center' }}>
                    <CloudOff size={32} color="var(--color-border)" style={{ margin: '0 auto 10px', display: 'block' }} />
                    <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: 2 }}>尚未建立監造報表</p>
                    <p style={{ fontSize: '0.72rem', lineHeight: 1.4, color: 'var(--color-text-muted)' }}>可從施工日誌帶入、手動填寫或 PDF 匯入</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14, alignItems: 'center' }}>
                      {diaryDataCache[selectedKey] && (
                        <button
                          onClick={() => { setQuickInitialData(diaryDataCache[selectedKey]); setShowQuickModal(true); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 16px', background: 'rgba(245,158,11,0.1)', color: '#b45309', borderRadius: 6, fontSize: '0.75rem', border: '1px solid rgba(245,158,11,0.35)', cursor: 'pointer', fontWeight: 600, width: '100%', justifyContent: 'center' }}>
                          <BookOpen size={13} /> 從施工日誌帶出
                        </button>
                      )}
                      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                        <button
                          onClick={() => { setQuickInitialData(null); setShowQuickModal(true); }}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, padding: '7px 10px', background: 'rgba(15,82,186,0.1)', color: 'var(--color-primary)', borderRadius: 6, fontSize: '0.75rem', border: '1px solid rgba(15,82,186,0.3)', cursor: 'pointer', fontWeight: 600, justifyContent: 'center' }}>
                          <PlusCircle size={13} /> 手動建檔
                        </button>
                        <button
                          onClick={() => setShowImportModal(true)}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, padding: '7px 10px', background: 'var(--color-bg2)', color: 'var(--color-text-muted)', borderRadius: 6, fontSize: '0.75rem', border: '1px solid var(--color-border)', cursor: 'pointer', justifyContent: 'center' }}>
                          <RefreshCcw size={12} /> PDF 匯入
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="b-content-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
                <Calendar size={36} color="var(--color-border)" style={{ marginBottom: '12px' }} />
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>點選左方日期查看報表內容</p>
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
    </div>
  );
}
