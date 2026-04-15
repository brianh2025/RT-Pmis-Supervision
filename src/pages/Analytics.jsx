/* ============================================================
   Analytics.jsx — 統計分析
   Ported from Manus_v1/Analytics.tsx
   ============================================================ */
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, TrendingUp, BarChart3, PieChart as PieIcon, Activity, ShieldCheck, FlaskConical } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import { supabase } from '../lib/supabaseClient';
import './Dashboard.css';

const COLORS = ['#1565C0', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#f97316'];

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

export function Analytics() {
  const { id: projectId } = useParams();
  const [loading, setLoading] = useState(true);
  const [progressData, setProgressData] = useState([]);
  const [submissionStats, setSubmissionStats] = useState([]);
  const [qualityStats, setQualityStats] = useState([]);
  const [diaryStats, setDiaryStats] = useState({});
  const [qualityRateStats, setQualityRateStats] = useState({});
  const [inspectionStats, setInspectionStats] = useState({});
  const [activeTab, setActiveTab] = useState('progress');

  useEffect(() => {
    async function load() {
      if (!supabase || !projectId) { setLoading(false); return; }
      setLoading(true);

      const [
      { data: progRows },
      { data: subRows },
      { data: qualRows },
      { data: diaryRows },
      { data: inspRows },
    ] = await Promise.all([
      supabase.from('progress_items').select('*').eq('project_id', projectId).order('created_at'),
      supabase.from('submissions').select('status, category, created_at').eq('project_id', projectId),
      supabase.from('quality_issues').select('status, severity, inspection_date').eq('project_id', projectId).order('inspection_date'),
      supabase.from('daily_logs').select('log_date, planned_progress, actual_progress').eq('project_id', projectId).order('log_date'),
      supabase.from('construction_inspections').select('result, work_item, inspect_date').eq('project_id', projectId).order('inspect_date'),
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
        cumulative: r.actual_progress || 0,
      }));
      setDiaryStats({ timeline, total: diaryRows.length });
    }

    // 缺失合格率（resolved+verified / total）
    if (qualRows) {
      const total = qualRows.length;
      const resolved = qualRows.filter(r => ['resolved', 'verified', 'waived'].includes(r.status)).length;
      const open = qualRows.filter(r => r.status === 'open').length;
      const inProgress = qualRows.filter(r => r.status === 'in_progress').length;
      const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
      // 每月缺失趨勢
      const monthlyMap = {};
      qualRows.forEach(r => {
        const m = r.inspection_date?.substring(0, 7);
        if (!m) return;
        if (!monthlyMap[m]) monthlyMap[m] = { month: m, total: 0, resolved: 0 };
        monthlyMap[m].total++;
        if (['resolved', 'verified', 'waived'].includes(r.status)) monthlyMap[m].resolved++;
      });
      const monthly = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month))
        .map(m => ({ ...m, rate: m.total > 0 ? Math.round((m.resolved / m.total) * 100) : 0 }));
      setQualityRateStats({ total, resolved, open, inProgress, rate, monthly });
    }

    // 施工檢驗完成率
    if (inspRows) {
      const total = inspRows.length;
      const pass = inspRows.filter(r => r.result === '合格').length;
      const fail = inspRows.filter(r => r.result === '不合格').length;
      const pending = inspRows.filter(r => r.result === '待複驗').length;
      const passRate = total > 0 ? Math.round((pass / total) * 100) : 0;
      // 按工項統計
      const itemMap = {};
      inspRows.forEach(r => {
        const k = r.work_item || '未分類';
        if (!itemMap[k]) itemMap[k] = { name: k, pass: 0, fail: 0, pending: 0 };
        if (r.result === '合格') itemMap[k].pass++;
        else if (r.result === '不合格') itemMap[k].fail++;
        else itemMap[k].pending++;
      });
      const byItem = Object.values(itemMap).sort((a, b) => (b.pass + b.fail + b.pending) - (a.pass + a.fail + a.pending)).slice(0, 10);
      setInspectionStats({ total, pass, fail, pending, passRate, byItem });
    }

    setLoading(false);
    }
    load();
  }, [projectId]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '8px', color: 'var(--color-text-muted)' }}>
      <Loader2 size={18} className="animate-spin" /><span>載入統計資料中…</span>
    </div>
  );

  const TABS = [
    { key: 'progress', label: '施工進度' },
    { key: 'diary', label: '日誌進度曲線' },
    { key: 'submission', label: '送審狀態' },
    { key: 'quality', label: '品管缺失' },
    { key: 'quality-rate', label: '缺失合格率' },
    { key: 'inspection', label: '施工檢驗完成率' },
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {[
          { label: '監造日誌', val: diaryStats.total || 0, sub: '已匯入筆數', icon: <Activity size={18} />, color: '#1565C0' },
          { label: '品管缺失', val: qualityStats.reduce((s, r) => s + r.value, 0), sub: `結案率 ${qualityRateStats.rate ?? 0}%`, icon: <ShieldCheck size={18} />, color: '#f59e0b' },
          { label: '施工檢驗', val: inspectionStats.total || 0, sub: `合格率 ${inspectionStats.passRate ?? 0}%`, icon: <FlaskConical size={18} />, color: '#10b981' },
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
      {activeTab === 'quality-rate' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 合格率儀錶 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[
              { label: '總缺失件', val: qualityRateStats.total || 0, color: 'var(--color-text2)' },
              { label: '待改善', val: qualityRateStats.open || 0, color: '#ef4444' },
              { label: '改善中', val: qualityRateStats.inProgress || 0, color: '#f59e0b' },
              { label: '已結案', val: qualityRateStats.resolved || 0, color: '#10b981' },
            ].map(s => (
              <div key={s.label} className="b-content-panel" style={{ padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: 700, color: s.color, fontFamily: 'JetBrains Mono, monospace' }}>{s.val}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px' }}>
            <div className="b-content-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>結案率</div>
              <ResponsiveContainer width="100%" height={160}>
                <RadialBarChart cx="50%" cy="50%" innerRadius="55%" outerRadius="80%"
                  data={[{ value: qualityRateStats.rate || 0, fill: '#10b981' }]} startAngle={90} endAngle={-270}>
                  <RadialBar dataKey="value" cornerRadius={6} background={{ fill: 'var(--color-bg2)' }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div style={{ fontSize: '32px', fontWeight: 700, color: '#10b981', fontFamily: 'JetBrains Mono, monospace', marginTop: '-12px' }}>
                {qualityRateStats.rate || 0}%
              </div>
            </div>
            <div className="b-content-panel" style={{ padding: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text1)', marginBottom: '16px' }}>每月缺失趨勢</div>
              {!qualityRateStats.monthly?.length ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)', fontSize: '13px' }}>尚無缺失資料</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={qualityRateStats.monthly} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-block-border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="total" name="總缺失" fill="#f59e0b" opacity={0.5} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="resolved" name="已結案" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'inspection' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[
              { label: '總檢驗項', val: inspectionStats.total || 0, color: 'var(--color-text2)' },
              { label: '合格', val: inspectionStats.pass || 0, color: '#10b981' },
              { label: '不合格', val: inspectionStats.fail || 0, color: '#ef4444' },
              { label: '待複驗', val: inspectionStats.pending || 0, color: '#f59e0b' },
            ].map(s => (
              <div key={s.label} className="b-content-panel" style={{ padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: 700, color: s.color, fontFamily: 'JetBrains Mono, monospace' }}>{s.val}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px' }}>
            <div className="b-content-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>一次合格率</div>
              <ResponsiveContainer width="100%" height={160}>
                <RadialBarChart cx="50%" cy="50%" innerRadius="55%" outerRadius="80%"
                  data={[{ value: inspectionStats.passRate || 0, fill: '#1565C0' }]} startAngle={90} endAngle={-270}>
                  <RadialBar dataKey="value" cornerRadius={6} background={{ fill: 'var(--color-bg2)' }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div style={{ fontSize: '32px', fontWeight: 700, color: '#1565C0', fontFamily: 'JetBrains Mono, monospace', marginTop: '-12px' }}>
                {inspectionStats.passRate || 0}%
              </div>
            </div>
            <div className="b-content-panel" style={{ padding: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text1)', marginBottom: '16px' }}>各工項檢驗結果（前10項）</div>
              {!inspectionStats.byItem?.length ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)', fontSize: '13px' }}>尚無施工檢驗資料</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={inspectionStats.byItem} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-block-border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="pass" name="合格" stackId="a" fill="#10b981" />
                    <Bar dataKey="pending" name="待複驗" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="fail" name="不合格" stackId="a" fill="#ef4444" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
