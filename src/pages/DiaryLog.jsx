import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CloudDownload, Calendar, Edit, FileText, CloudOff, RefreshCcw, PlusCircle, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { DiaryImportModal } from '../components/DiaryImportModal';
import { QuickDiaryModal } from '../components/QuickDiaryModal';
import { DriveSyncModal } from '../components/DriveSyncModal';
import './DiaryLog.css'; // Minimal specific styles, relying mostly on inline and generic styles

const dowHeaders = ["日", "一", "二", "三", "四", "五", "六"];

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

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);

  const [project, setProject] = useState(null);
  const [logs, setLogs] = useState([]);
  const [_loading, setLoading] = useState(true);
  const [_error, setError] = useState(null);
  
  const [showImportModal,  setShowImportModal]  = useState(false);
  const [showQuickModal,   setShowQuickModal]   = useState(false);
  const [showDriveSync,    setShowDriveSync]    = useState(false);
  const [quickInitialData, setQuickInitialData] = useState(null);
  const [refreshTrigger,   setRefreshTrigger]   = useState(0);

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
  const importedCount = Object.keys(importedData).length;

  // 從施工日誌（localStorage）讀取同日期資料，轉為 QuickDiaryModal 初始值
  const getDiaryInitialData = (dateKey) => {
    try {
      const stored = JSON.parse(localStorage.getItem(`daily_reports_${projectId}`) || '[]');
      const match = stored.find(r => r.date === dateKey);
      if (!match) return null;
      const workText = [
        ...(match.quantities || []).map(q => `${q.item}：${q.todayQty} ${q.unit}`).filter(s => s.trim() !== '：'),
        match.specialNote,
      ].filter(Boolean).join('\n');
      return {
        weather_am: match.weather || '晴',
        weather_pm: match.weather || '晴',
        work_items: workText || match.progressNote || '',
        notes: match.progressNote || '',
        planned_progress: match.plannedProgress || null,
        actual_progress:  match.actualProgress  || null,
      };
    } catch { return null; }
  };

  return (
    <div className="diary-log-page">
      <header className="page-section-header">
        <div className="header-left">
          <span className="section-label">監造報表檢索</span>
          <span className="section-sub-label">MAPPING SYSTEM</span>
        </div>
        <div className="header-actions">
            <span className="status-badge success">
                本月 {importedCount} 筆已匯入
            </span>
            {project?.drive_folder_id && (
                <button
                    onClick={() => setShowDriveSync(true)}
                    className="btn-dash-action"
                    style={{ background: 'rgba(59,130,246,0.1)', color: '#2563eb', borderColor: 'rgba(59,130,246,0.3)' }}
                >
                    <RefreshCcw size={13} />
                    <span>Drive 回朔同步</span>
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
      <div className="b-dash-content-grid">
         {/* Left: Calendar */}
         <div className="b-content-panel">
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
                        <button key={day} disabled={isFuture} onClick={() => setSelectedDay(isSelected ? null : day)}
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
         </div>

         {/* Right: Detail panel */}
         <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {selectedDay && selectedKey ? (
                <div className="b-content-panel" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-block-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-bg2)' }}>
                        <span style={{ fontSize: '13px', color: 'var(--color-text1)', fontWeight: 600 }}>{toRoc(year, month, selectedDay)}</span>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: selectedData ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-bg1)', color: selectedData ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                            {selectedData ? "已匯入" : "尚未提送"}
                        </span>
                    </div>
                    {selectedData ? (
                        <div style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', marginBottom: '12px' }}>
                                <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center' }}>☀️</span>
                                <span style={{ color: 'var(--color-text-muted)' }}>{selectedData.weather}</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                                {selectedData.tags.map((t, j) => (
                                    <span key={j} style={{ padding: '2px 6px', background: 'rgba(15,82,186,0.1)', color: 'var(--color-primary)', borderRadius: '4px', fontSize: '11px' }}>{t}</span>
                                ))}
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--color-text2)', lineHeight: 1.6, marginBottom: '20px' }}>{selectedData.summary}</p>
                            
                            {selectedData.progress > 0 && (
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>累計施工進度</span>
                                    <span style={{ color: 'var(--color-success)' }}>{selectedData.progress}%</span>
                                </div>
                                <div style={{ height: '6px', background: 'var(--color-bg2)', borderRadius: '999px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: 'var(--color-success)', width: `${selectedData.progress}%` }} />
                                </div>
                            </div>
                            )}

                            <div style={{ display: 'flex', gap: '8px', paddingTop: '16px', borderTop: '1px solid var(--color-block-border)' }}>
                                <button
                                    onClick={() => navigate(`/projects/${projectId}/supervision/print/${selectedKey}`)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--color-bg2)', borderRadius: '6px', fontSize: '11px', color: 'var(--color-text2)', border: '1px solid var(--color-block-border)', cursor: 'pointer', transition: 'all 0.2s' }}
                                >
                                    <Edit size={14} /> 檢視 / 編輯報表
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                            <CloudOff size={32} color="var(--color-border)" style={{ margin: '0 auto 10px' }} />
                            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>尚未建立監造報表</p>
                            <p style={{ fontSize: '11px', lineHeight: '1.4', color: 'var(--color-text-muted)' }}>可從施工日誌帶入、手動填寫或 PDF 匯入</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '14px', alignItems: 'center' }}>
                                {getDiaryInitialData(selectedKey) && (
                                    <button
                                        onClick={() => { setQuickInitialData(getDiaryInitialData(selectedKey)); setShowQuickModal(true); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 16px', background: 'rgba(245,158,11,0.1)', color: '#b45309', borderRadius: '6px', fontSize: '12px', border: '1px solid rgba(245,158,11,0.35)', cursor: 'pointer', fontWeight: 600, width: '100%', justifyContent: 'center' }}>
                                        <BookOpen size={13} /> 從施工日誌帶出
                                    </button>
                                )}
                                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                    <button
                                        onClick={() => { setQuickInitialData(null); setShowQuickModal(true); }}
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 10px', background: 'rgba(15,82,186,0.1)', color: 'var(--color-primary)', borderRadius: '6px', fontSize: '12px', border: '1px solid rgba(15,82,186,0.3)', cursor: 'pointer', fontWeight: 600, justifyContent: 'center' }}>
                                        <PlusCircle size={13} /> 手動建檔
                                    </button>
                                    <button
                                        onClick={() => setShowImportModal(true)}
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 10px', background: 'var(--color-bg2)', color: 'var(--color-text2)', borderRadius: '6px', fontSize: '12px', border: '1px solid var(--color-border)', cursor: 'pointer', justifyContent: 'center' }}>
                                        <RefreshCcw size={12} /> PDF 匯入
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="b-content-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
                    <Calendar size={36} color="var(--color-border)" style={{ marginBottom: '12px' }} />
                    <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>點選左方日期查看報表內容</p>
                </div>
            )}
            
            {/* Month summary */}
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
         </div>
      </div>
      
      {showImportModal && (
        <DiaryImportModal
          projectId={projectId}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => setRefreshTrigger(prev => prev + 1)}
        />
      )}
      {showDriveSync && (
        <DriveSyncModal
          projectId={projectId}
          startDate={project?.start_date || ''}
          onClose={() => setShowDriveSync(false)}
          onSuccess={() => { setShowDriveSync(false); setRefreshTrigger(prev => prev + 1); }}
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
