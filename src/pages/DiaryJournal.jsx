import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ClipboardList, BookOpen, CheckCircle2, Circle, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const DOW = ['日', '一', '二', '三', '四', '五', '六'];

function toKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDow(y, m)    { return new Date(y, m, 1).getDay(); }

export function DiaryJournal() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();

  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState(null);

  // 月份資料：哪些日期有施工日誌 / 監造報表
  const [diaryDates,      setDiaryDates]      = useState(new Set()); // daily_report_items
  const [supervisionDates, setSupervisionDates] = useState(new Set()); // daily_logs

  // 選定日期的摘要資料
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // 取得當月有資料的日期
  useEffect(() => {
    const start = toKey(year, month, 1);
    const end   = toKey(year, month, getDaysInMonth(year, month));

    Promise.all([
      supabase.from('daily_report_items')
        .select('log_date')
        .eq('project_id', projectId)
        .gte('log_date', start)
        .lte('log_date', end),
      supabase.from('daily_logs')
        .select('log_date')
        .eq('project_id', projectId)
        .gte('log_date', start)
        .lte('log_date', end),
    ]).then(([dri, dl]) => {
      setDiaryDates(new Set((dri.data || []).map(r => r.log_date)));
      setSupervisionDates(new Set((dl.data || []).map(r => r.log_date)));
    });
  }, [projectId, year, month]);

  // 選定日期後取摘要
  useEffect(() => {
    if (!selectedKey) { setSummary(null); return; }
    setLoadingSummary(true);

    Promise.all([
      supabase.from('daily_report_items')
        .select('item_name, unit, today_qty')
        .eq('project_id', projectId)
        .eq('log_date', selectedKey),
      supabase.from('daily_logs')
        .select('weather_am, weather_pm, work_items, notes, actual_progress, planned_progress')
        .eq('project_id', projectId)
        .eq('log_date', selectedKey)
        .maybeSingle(),
      supabase.from('progress_records')
        .select('planned_progress, actual_progress')
        .eq('project_id', projectId)
        .eq('report_date', selectedKey)
        .maybeSingle(),
    ]).then(([items, log, prog]) => {
      setSummary({
        workItems:    items.data || [],
        log:          log.data   || null,
        progress:     prog.data  || null,
      });
      setLoadingSummary(false);
    });
  }, [projectId, selectedKey]);

  const daysInMonth  = getDaysInMonth(year, month);
  const firstDow     = getFirstDow(year, month);
  const todayKey     = toKey(today.getFullYear(), today.getMonth(), today.getDate());

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); setSelectedKey(null); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); setSelectedKey(null); };

  // 進度條顏色
  const progressColor = (actual, planned) => {
    if (actual == null) return 'var(--color-text-muted)';
    if (actual >= planned) return 'var(--color-success, #10b981)';
    if (actual >= planned * 0.95) return 'var(--color-warning, #f59e0b)';
    return 'var(--color-danger, #ef4444)';
  };

  const selActual  = summary?.progress?.actual_progress  ?? summary?.log?.actual_progress  ?? null;
  const selPlanned = summary?.progress?.planned_progress ?? summary?.log?.planned_progress ?? null;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'auto' }}>

      {/* 頁首 */}
      <div className="dash-page-header">
        <h1 className="dash-title">日誌報表</h1>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* ── 日曆 ── */}
        <div style={{ flex: '0 0 auto', minWidth: 280 }}>
          {/* 月份導航 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text1)', padding: 4 }}>
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text1)' }}>
              {year} 年 {month + 1} 月
            </span>
            <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text1)', padding: 4 }}>
              <ChevronRight size={18} />
            </button>
          </div>

          {/* 星期標頭 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DOW.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', padding: '2px 0' }}>{d}</div>
            ))}
          </div>

          {/* 日期格 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const d = i + 1;
              const key = toKey(year, month, d);
              const hasDiary = diaryDates.has(key);
              const hasSup   = supervisionDates.has(key);
              const isToday  = key === todayKey;
              const isSelected = key === selectedKey;
              const dow = (firstDow + i) % 7;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedKey(isSelected ? null : key)}
                  style={{
                    position: 'relative',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '6px 2px 4px',
                    borderRadius: 8,
                    border: isSelected ? '2px solid var(--color-primary)' : '2px solid transparent',
                    background: isSelected ? 'rgba(37,99,235,0.1)' : isToday ? 'var(--color-surface-hover)' : 'none',
                    cursor: 'pointer',
                    color: isSelected ? 'var(--color-primary)' : dow === 0 ? '#ef4444' : dow === 6 ? '#3b82f6' : 'var(--color-text1)',
                    fontWeight: isToday ? 700 : 400,
                    fontSize: '0.82rem',
                    transition: 'all 0.12s',
                  }}
                >
                  {d}
                  {/* 狀態點 */}
                  {(hasDiary || hasSup) && (
                    <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: hasDiary ? 'var(--color-primary)' : 'transparent', border: hasDiary ? 'none' : '1px solid transparent' }} />
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: hasSup ? '#10b981' : 'transparent' }} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* 圖例 */}
          <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', display: 'inline-block' }} />施工日誌
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />監造報表
            </span>
          </div>
        </div>

        {/* ── 摘要面板 ── */}
        <div style={{ flex: 1, minWidth: 240 }}>
          {!selectedKey && (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', padding: '20px 0' }}>
              點選日期查看摘要
            </div>
          )}

          {selectedKey && loadingSummary && (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', padding: '20px 0' }}>載入中…</div>
          )}

          {selectedKey && !loadingSummary && summary && (() => {
            // 過濾有意義的施工項（數量 >= 0.1，排除合約比例型細項）
            const meaningfulItems = summary.workItems.filter(wi => wi.today_qty >= 0.1);
            const noteText = summary.log?.notes || summary.log?.work_items || '';
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--color-text1)' }}>{selectedKey}</div>

                {/* 操作按鈕（固定顯示在最上方） */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => navigate(`/projects/${projectId}/diary`)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--color-primary)', background: 'rgba(37,99,235,0.07)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-primary)' }}
                  >
                    <ClipboardList size={14} /> 施工日誌
                  </button>
                  <button
                    onClick={() => navigate(`/projects/${projectId}/supervision`)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, border: '1px solid #10b981', background: 'rgba(16,185,129,0.07)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, color: '#10b981' }}
                  >
                    <BookOpen size={14} /> 監造報表
                  </button>
                </div>

                {/* 1. 上傳狀態 */}
                <div style={{ background: 'var(--color-surface-hover)', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>上傳狀態</div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    {[
                      { label: '施工日誌', has: diaryDates.has(selectedKey) },
                      { label: '監造報表', has: supervisionDates.has(selectedKey) },
                    ].map(({ label, has }) => (
                      <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', color: has ? '#10b981' : 'var(--color-text-muted)', fontWeight: has ? 600 : 400 }}>
                        {has ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                        {label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 2. 施工項目摘要 */}
                <div style={{ background: 'var(--color-surface-hover)', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>施工項目摘要</div>
                  {meaningfulItems.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {meaningfulItems.map((wi, i) => (
                        <div key={i} style={{ fontSize: '0.8rem', color: 'var(--color-text1)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wi.item_name}</span>
                          <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>{wi.today_qty} {wi.unit || ''}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>尚無施工項目記錄</div>
                  )}
                </div>

                {/* 3. 特別註記 */}
                <div style={{ background: 'var(--color-surface-hover)', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>特別註記</div>
                  {noteText ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text1)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{noteText}</div>
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>尚無備註</div>
                  )}
                  {summary.log?.weather_am && (
                    <div style={{ marginTop: 6, fontSize: '0.73rem', color: 'var(--color-text-muted)' }}>
                      天氣：上午 {summary.log.weather_am}{summary.log.weather_pm ? ` · 下午 ${summary.log.weather_pm}` : ''}
                    </div>
                  )}
                </div>

                {/* 4. 當日進度 / 累積進度 */}
                <div style={{ background: 'var(--color-surface-hover)', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>進度</div>
                  {(selActual != null || selPlanned != null) ? (
                    <>
                      <div style={{ display: 'flex', gap: 20, marginBottom: 8 }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                          預定 <strong style={{ color: 'var(--color-text1)', fontSize: '1rem' }}>{selPlanned ?? '—'}%</strong>
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                          實際 <strong style={{ color: progressColor(selActual, selPlanned), fontSize: '1rem' }}>{selActual ?? '—'}%</strong>
                        </span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: 'var(--color-surface-border)', overflow: 'hidden', position: 'relative' }}>
                        {selPlanned != null && <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${Math.min(selPlanned, 100)}%`, background: 'rgba(148,163,184,0.4)', borderRadius: 4 }} />}
                        {selActual != null && <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${Math.min(selActual, 100)}%`, background: progressColor(selActual, selPlanned), borderRadius: 4, transition: 'width 0.3s' }} />}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>尚無進度資料</div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
