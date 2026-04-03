/* ============================================================
   Analytics.jsx — 統計分析
   Ported from Manus_v1/Analytics.tsx
   ============================================================ */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, TrendingUp, BarChart3, PieChart as PieIcon, Activity } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import { supabase } from '../lib/supabaseClient';
import './Dashboard.css';

const COLORS = ['#1565C0', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#f97316'];

export function Analytics() {
  const { id: projectId } = useParams();
  const [loading, setLoading] = useState(true);
  const [progressData, setProgressData] = useState([]);
  const [submissionStats, setSubmissionStats] = useState([]);
  const [qualityStats, setQualityStats] = useState([]);
  const [diaryStats, setDiaryStats] = useState({});
  const [materialStats, setMaterialStats] = useState({});
  const [activeTab, setActiveTab] = useState('progress');

  const load = useCallback(async () => {
    if (!supabase || !projectId) { setLoading(false); return; }
    setLoading(true);

    const [
      { data: progRows },
      { data: subRows },
      { data: qualRows },
      { data: diaryRows },
      { data: matSubRows },
    ] = await Promise.all([
      supabase.from('progress_items').select('*').eq('project_id', projectId).order('created_at'),
      supabase.from('submissions').select('status, category, created_at').eq('project_id', projectId),
      supabase.from('quality_issues').select('status, severity, inspection_date').eq('project_id', projectId).order('inspection_date'),
      supabase.from('daily_logs').select('log_date, planned_progress, actual_progress, cumulative_progress').eq('project_id', projectId).order('log_date'),
      supabase.from('mcs_submission').select('result').eq('project_id', projectId),
    ]);

    // Progress bar chart
    if (progRows && progRows.length > 0) {
      const sorted = [...progRows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setProgressData(sorted.map((r, i) => ({
        name: r.name?.substring(0, 10) || `項目${i + 1}`,
        planned: r.planned_qty || 0,
        actual: r.actual_qty || 0,
      })));
    }

    // Submission stats by status
    if (subRows) {
      const statusMap = {};
      subRows.forEach(r => { statusMap[r.status] = (statusMap[r.status] || 0) + 1; });
      const statusLabels = { pending: '待送審', submitted: '已送出', reviewing: '審查中', approved: '同意備查', rejected: '退件', revision: '補件中' };
      setSubmissionStats(Object.entries(statusMap).map(([k, v]) => ({ name: statusLabels[k] || k, value: v })));
    }

    // Quality stats by severity
    if (qualRows) {
      const sevMap = {};
      qualRows.forEach(r => { sevMap[r.severity] = (sevMap[r.severity] || 0) + 1; });
      const sevLabels = { critical: '重大', major: '一般', minor: '輕微', observation: '觀察' };
      setQualityStats(Object.entries(sevMap).map(([k, v]) => ({ name: sevLabels[k] || k, value: v })));
    }

    // Diary progress timeline
    if (diaryRows && diaryRows.length > 0) {
      const timeline = diaryRows.map(r => ({
        date: r.log_date?.substring(5) || '',
        planned: r.planned_progress || 0,
        actual: r.actual_progress || 0,
        cumulative: r.cumulative_progress || 0,
      }));
      setDiaryStats({ timeline, total: diaryRows.length });
    }

    // Material submission stats
    if (matSubRows) {
      const approved = matSubRows.filter(r => r.result === '同意備查').length;
      setMaterialStats({ total: matSubRows.length, approved, pending: matSubRows.length - approved });
    }

    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '8px', color: 'var(--color-text-muted)' }}>
      <Loader2 size={18} className="animate-spin" /><span>載入統計資料中…</span>
    </div>
  );

  function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--color-bg1)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px' }}>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '6px' }}>{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color: p.color, margin: '2px 0' }}>{p.name}: <strong>{p.value}</strong></p>
        ))}
      </div>
    );
  }

  const TABS = [
    { key: 'progress', label: '施工進度' },
    { key: 'diary', label: '日誌進度曲線' },
    { key: 'submission', label: '送審狀態' },
    { key: 'quality', label: '品管缺失' },
  ];

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <header className="page-section-header" style={{ padding: 0 }}>
        <div className="header-left">
          <span className="section-label">統計分析</span>
          <span className="section-sub-label">PROJECT ANALYTICS DASHBOARD</span>
        </div>
      </header>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: '監造日誌', val: diaryStats.total || 0, sub: '已匯入筆數', icon: <Activity size={18} />, color: '#1565C0' },
          { label: '送審文件', val: submissionStats.reduce((s, r) => s + r.value, 0), sub: '總送審件數', icon: <BarChart3 size={18} />, color: '#10b981' },
          { label: '品管缺失', val: qualityStats.reduce((s, r) => s + r.value, 0), sub: '總缺失件數', icon: <PieIcon size={18} />, color: '#f59e0b' },
          { label: '材料送審', val: materialStats.approved || 0, sub: `已核定 / ${materialStats.total || 0} 件`, icon: <TrendingUp size={18} />, color: '#8b5cf6' },
        ].map(kpi => (
          <div key={kpi.label} className="b-content-panel" style={{ padding: '16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `${kpi.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: kpi.color, flexShrink: 0 }}>
              {kpi.icon}
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: kpi.color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>{kpi.val}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text1)', fontWeight: 600, marginTop: '4px' }}>{kpi.label}</div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{kpi.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mcs-tabs">
        {TABS.map(t => (
          <button key={t.key} className={`mcs-tab${activeTab === t.key ? ' active' : ''}`} onClick={() => setActiveTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {/* Charts */}
      {activeTab === 'progress' && (
        <div className="b-content-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text1)', marginBottom: '16px' }}>工程項目進度對比</div>
          {progressData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              <BarChart3 size={32} style={{ opacity: 0.2, margin: '0 auto 12px', display: 'block' }} />
              尚無進度資料 — 請先在「進度管理」頁面新增工程項目
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={progressData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-block-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="planned" name="預定數量" fill="#1565C0" opacity={0.6} radius={[3, 3, 0, 0]} />
                <Bar dataKey="actual" name="實際數量" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {activeTab === 'diary' && (
        <div className="b-content-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text1)', marginBottom: '16px' }}>施工進度 S 曲線（來自監造日誌）</div>
          {!diaryStats.timeline || diaryStats.timeline.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              <Activity size={32} style={{ opacity: 0.2, margin: '0 auto 12px', display: 'block' }} />
              尚無日誌進度資料 — 請先在「監造報表」頁面匯入 PDF
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={diaryStats.timeline} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradPlanned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1565C0" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#1565C0" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-block-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} unit="%" domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Area type="monotone" dataKey="planned" name="預定進度" stroke="#1565C0" fill="url(#gradPlanned)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="actual" name="實際進度" stroke="#10b981" fill="url(#gradActual)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {activeTab === 'submission' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="b-content-panel" style={{ padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text1)', marginBottom: '16px' }}>送審狀態分布</div>
            {submissionStats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)', fontSize: '13px' }}>尚無送審資料</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={submissionStats} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {submissionStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="b-content-panel" style={{ padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text1)', marginBottom: '16px' }}>送審件數統計</div>
            {submissionStats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)', fontSize: '13px' }}>尚無送審資料</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={submissionStats} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-block-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} width={60} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="件數" radius={[0, 4, 4, 0]}>
                    {submissionStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {activeTab === 'quality' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="b-content-panel" style={{ padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text1)', marginBottom: '16px' }}>缺失嚴重度分布</div>
            {qualityStats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)', fontSize: '13px' }}>尚無品管缺失資料</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={qualityStats} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}(${value})`}>
                    {qualityStats.map((_, i) => <Cell key={i} fill={['#ef4444', '#f97316', '#f59e0b', '#3b82f6'][i % 4]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="b-content-panel" style={{ padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text1)', marginBottom: '16px' }}>缺失嚴重度比例</div>
            {qualityStats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)', fontSize: '13px' }}>尚無品管缺失資料</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                {qualityStats.map((item, i) => {
                  const total = qualityStats.reduce((s, r) => s + r.value, 0);
                  return (
                    <div key={item.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--color-text2)' }}>{item.name}</span>
                        <span style={{ color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{item.value} 件</span>
                      </div>
                      <div style={{ height: '8px', background: 'var(--color-bg2)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: ['#ef4444', '#f97316', '#f59e0b', '#3b82f6'][i % 4], width: `${(item.value / total) * 100}%`, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
