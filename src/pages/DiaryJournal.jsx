import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Cloud } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import './DiaryJournal.css';

const DOW = ['日', '一', '二', '三', '四', '五', '六'];

function toKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDow(y, m)    { return new Date(y, m, 1).getDay(); }

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

  const [diaryDates,       setDiaryDates]       = useState(new Set());
  const [supervisionDates, setSupervisionDates] = useState(new Set());
  const [summary,          setSummary]          = useState(null);
  const [loadingSummary,   setLoadingSummary]   = useState(false);

  // ── 取當月有資料的日期 ──────────────────────────────────────
  useEffect(() => {
    const start = toKey(year, month, 1);
    const end   = toKey(year, month, getDaysInMonth(year, month));
    Promise.all([
      supabase.from('daily_report_items').select('log_date')
        .eq('project_id', projectId).gte('log_date', start).lte('log_date', end),
      supabase.from('daily_logs').select('log_date')
        .eq('project_id', projectId).gte('log_date', start).lte('log_date', end),
    ]).then(([dri, dl]) => {
      setDiaryDates(new Set((dri.data || []).map(r => r.log_date)));
      setSupervisionDates(new Set((dl.data || []).map(r => r.log_date)));
    });
  }, [projectId, year, month]);

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

  const selActual  = summary?.progress?.actual_progress  ?? summary?.log?.actual_progress  ?? null;
  const selPlanned = summary?.progress?.planned_progress ?? summary?.log?.planned_progress ?? null;

  // 過濾有意義的施工項（排除合約比例型小數）
  const meaningfulItems = (summary?.workItems || []).filter(wi => wi.today_qty >= 0.1);
  const noteText = summary?.log?.notes || '';

  // ── 日曆 ────────────────────────────────────────────────────
  const calendarEl = (
    <div className="dj-calendar">
      <div className="dj-month-nav">
        <button onClick={prevMonth}><ChevronLeft size={16} /></button>
        <span className="dj-month-label">{year} 年 {month + 1} 月</span>
        <button onClick={nextMonth}><ChevronRight size={16} /></button>
      </div>
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
              onClick={() => setSelectedKey(isSelected ? null : key)}
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
    </div>
  );

  // ── 摘要面板 ────────────────────────────────────────────────
  const summaryEl = selectedKey ? (
    loadingSummary ? (
      <div className="dj-empty" style={{ padding: '20px 0' }}>載入中…</div>
    ) : !summary ? null : (
      <div className="dj-summary">

        {/* 合併上傳狀態＋按鈕 */}
        <div className="dj-action-row">
          <button
            className={`dj-action-btn${hasDiary ? '' : ' disabled'}`}
            onClick={() => {
              if (hasDiary) navigate(`/projects/${projectId}/diary`);
              else alert('施工日誌尚未上傳，請先 Drive 回朔同步或手動填寫');
            }}
            title={hasDiary ? '查看施工日誌' : '施工日誌尚未上傳'}
          >
            {hasDiary ? <CheckCircle2 size={14} /> : <Circle size={14} />}
            施工日誌
          </button>
          <button
            className={`dj-action-btn supervision${hasSup ? '' : ' disabled'}`}
            onClick={() => {
              if (hasSup) navigate(`/projects/${projectId}/supervision`);
              else alert('監造報表尚未上傳，請先 Drive 回朔同步或手動填寫');
            }}
            title={hasSup ? '查看監造報表' : '監造報表尚未上傳'}
          >
            {hasSup ? <CheckCircle2 size={14} /> : <Circle size={14} />}
            監造報表
          </button>
        </div>

        {/* 施工項目摘要 */}
        <div className="dj-section">
          <div className="dj-section-title">施工項目摘要</div>
          {meaningfulItems.length > 0 ? (
            <div className="dj-item-list">
              {meaningfulItems.map((wi, i) => (
                <div key={i} className="dj-item-row">
                  <span className="dj-item-name">{wi.item_name}</span>
                  <span className="dj-item-qty">{wi.today_qty} {wi.unit || ''}</span>
                </div>
              ))}
            </div>
          ) : <div className="dj-empty">尚無施工項目記錄</div>}
        </div>

        {/* 特別註記 */}
        <div className="dj-section">
          <div className="dj-section-title">特別註記</div>
          {noteText
            ? <div className="dj-note-text">{noteText}</div>
            : <div className="dj-empty">尚無備註</div>
          }
          {(summary.log?.weather_am || summary.log?.weather_pm) && (
            <div className="dj-weather-row">
              <Cloud size={12} />
              <span>上午 {summary.log.weather_am || '—'}</span>
              <span className="dj-weather-sep" />
              <span>下午 {summary.log.weather_pm || '—'}</span>
            </div>
          )}
        </div>

        {/* 進度 */}
        <div className="dj-section">
          <div className="dj-section-title">進度</div>
          {(selActual != null || selPlanned != null) ? (
            <>
              <div className="dj-progress-nums">
                <span>預定 <strong>{fmtPct(selPlanned)}</strong></span>
                <span>實際 <strong style={{ color: progressColor(selActual, selPlanned) }}>{fmtPct(selActual)}</strong></span>
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

      {/* Header：標題 + PC端選定日期 */}
      <div className="dj-header">
        <h1 className="dj-title">日誌報表</h1>
        {selectedKey && <div className="dj-header-date">{selectedKey}</div>}
      </div>

      {/* 行動版：收合後的日期導覽列 */}
      {selectedKey && (
        <div className="dj-mobile-datebar">
          <button className="dj-nav-btn" onClick={() => changeDay(-1)}><ChevronLeft size={16} /></button>
          <span className="dj-mobile-date">{selectedKey}</span>
          <button className="dj-nav-btn" onClick={() => changeDay(1)}><ChevronRight size={16} /></button>
        </div>
      )}

      {/* 主體 */}
      <div className={`dj-body${selectedKey ? ' has-selection' : ''}`}>
        {/* 日曆欄（行動版有選擇時隱藏） */}
        <div className={`dj-cal-col${selectedKey ? ' has-selection' : ''}`}>
          {calendarEl}
        </div>

        {/* 摘要欄 */}
        {summaryEl
          ? <div className="dj-summary-col">{summaryEl}</div>
          : <div className="dj-placeholder">點選日期查看摘要</div>
        }
      </div>

    </div>
  );
}
