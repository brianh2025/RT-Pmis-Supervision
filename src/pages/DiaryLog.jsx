import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Sun, Cloud, CloudRain, BookOpen, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import './DiaryLog.css';

const WEATHER_ICON = {
  '晴': <Sun size={14} />,
  '陰': <Cloud size={14} />,
  '雨': <CloudRain size={14} />,
};

function WeatherBadge({ val }) {
  if (!val) return <span className="no-data">—</span>;
  return (
    <span className="weather-badge">
      {WEATHER_ICON[val] ?? null}
      {val}
    </span>
  );
}

export function DiaryLog() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [monthFilter, setMonthFilter] = useState('');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      // Fetch project name
      const { data: proj } = await supabase
        .from('projects')
        .select('name, contractor, status')
        .eq('id', projectId)
        .single();
      setProject(proj);

      // Fetch logs
      let query = supabase
        .from('daily_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('log_date', { ascending: false });

      if (monthFilter) {
        query = query
          .gte('log_date', `${monthFilter}-01`)
          .lte('log_date', `${monthFilter}-31`);
      }

      const { data, error: logErr } = await query;
      if (logErr) setError(logErr.message);
      else setLogs(data ?? []);

      setLoading(false);
    }
    if (projectId) fetchData();
  }, [projectId, monthFilter]);

  // Derive unique months from logs for filter dropdown
  const availableMonths = [...new Set(
    logs.map(l => l.log_date?.slice(0, 7)).filter(Boolean)
  )].sort().reverse();

  return (
    <div className="diary-page">
      {/* Header */}
      <header className="diary-topbar">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} />
          <span>返回儀表板</span>
        </button>
        <div className="diary-project-title">
          <BookOpen size={16} className="diary-title-icon" />
          <div>
            <span className="diary-title-main">施工日誌</span>
            <span className="diary-title-sub">{project?.name ?? '載入中...'}</span>
          </div>
        </div>
        <div className="diary-filter-area">
          <CalendarDays size={15} style={{ color: 'var(--color-text-muted)' }} />
          <select
            className="form-input diary-month-select"
            value={monthFilter}
            onChange={e => setMonthFilter(e.target.value)}
          >
            <option value="">全部月份</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Content */}
      <main className="diary-main">
        {loading && (
          <div className="diary-loading">
            <RefreshCw size={20} className="spin-icon" />
            <span>載入中...</span>
          </div>
        )}
        {error && <div className="dash-error-msg">資料載入失敗：{error}</div>}

        {!loading && !error && logs.length === 0 && (
          <div className="diary-empty">
            <BookOpen size={40} opacity={0.3} />
            <p>尚無日誌記錄</p>
            <p className="diary-empty-hint">請使用儀表板的「📖 匯入日誌」功能上傳 Excel 檔案</p>
          </div>
        )}

        {!loading && logs.length > 0 && (
          <div className="diary-list">
            <div className="diary-count">
              共 <strong>{logs.length}</strong> 筆記錄
              {monthFilter && ` · ${monthFilter}`}
            </div>
            {logs.map(log => (
              <div key={log.id} className="diary-card">
                <div className="diary-card-date">
                  <span className="diary-date-main">
                    {new Date(log.log_date + 'T00:00:00').toLocaleDateString('zh-TW', {
                      month: 'long', day: 'numeric'
                    })}
                  </span>
                  <span className="diary-date-year">
                    {log.log_date?.slice(0, 4)}
                  </span>
                </div>
                <div className="diary-card-weather">
                  <div className="diary-weather-row">
                    <span className="diary-weather-label">上午</span>
                    <WeatherBadge val={log.weather_am} />
                  </div>
                  <div className="diary-weather-row">
                    <span className="diary-weather-label">下午</span>
                    <WeatherBadge val={log.weather_pm} />
                  </div>
                </div>
                <div className="diary-card-content">
                  {log.work_items && (
                    <p className="diary-work-items">{log.work_items}</p>
                  )}
                  {log.notes && (
                    <p className="diary-notes">{log.notes}</p>
                  )}
                  {!log.work_items && !log.notes && (
                    <p className="no-data">無施工記事</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
