import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, DollarSign, Clock, TrendingUp, CreditCard, 
  AlertCircle, PieChart, Info, Activity, Calendar
} from 'lucide-react';
import { useProject } from '../hooks/useProject';
import './Dashboard.css';

export function ProjectDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { project, loading, error } = useProject(id);

  if (loading) return <div className="dash-main"><div className="diary-loading">載入中...</div></div>;
  if (error) return <div className="dash-main"><div className="dash-error-msg">{error}</div></div>;

  const lp = project?.latest_progress;
  const planned = lp?.planned_progress || 0;
  const actual = lp?.actual_progress || 0;
  const diff = actual - planned;
  
  const paymentProg = project.budget ? Math.min(100, Math.round(((actual || 0) * project.budget) / 10000)) : 0;
  
  const stats = [
    { label: "契約金額 (萬)", value: project?.budget || '—', icon: <DollarSign size={18} />, accent: "sky" },
    { label: "工期天數", value: project?.days || '180', icon: <Clock size={18} />, accent: "emerald" },
    { label: "施工進度", value: `${actual}%`, icon: <TrendingUp size={18} />, accent: "blue" },
    { label: "請款進度", value: `${paymentProg}%`, icon: <CreditCard size={18} />, accent: "violet" },
  ];
  
  const sCurveData = [
    { m: "8月", p: 10, a: 12 }, 
    { m: "9月", p: 20, a: 22 }, 
    { m: "10月", p: 32, a: 30 }, 
    { m: "11月", p: 45, a: 38 }, 
    { m: "12月", p: 55, a: Math.min(43, actual) }, 
    { m: "1月", p: 60, a: actual }
  ];

  const recentActivities = [
    { date: "2026/03/20", event: "提交第 5 期工程估驗單", type: "document" },
    { date: "2026/03/18", event: "監造日誌：完成區段 A 鋼筋綁紮檢查", type: "log" },
    { date: "2026/03/15", event: "現場照片：新增 12 張施工紀錄", type: "photo" },
  ];

  return (
    <div className="dash-page-wrapper">
      <div className="dash-page-header" style={{ marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className={`status-badge ${project?.status || 'active'}`}>{project?.status === 'active' ? '執行中' : '已完工'}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{project?.id?.slice(0, 8).toUpperCase()}</span>
          </div>
          <h1 className="dash-title" style={{ fontSize: 'var(--fs-2xl)', lineHeight: 1.3, marginBottom: 0 }}>
            {project?.name || '專案載入中...'}
          </h1>
        </div>
      </div>
      
      <div className="b-stat-grid">
        {stats.map((s, i) => (
          <div key={i} className="b-stat-card" style={{ animationDelay: `${i * 0.07}s` }}>
            <div className="b-stat-header">
              <span className="b-stat-label">{s.label}</span>
              <div className={`b-stat-icon-wrapper ${s.accent}`}>
                {s.icon}
              </div>
            </div>
            <div className="b-stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="b-dash-content-grid" style={{ alignItems: 'start' }}>
        {/* 左直欄：S 曲線 + 基本資訊 */}
        <div className="dash-col-left" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* S-Curve Panel */}
          <div className="b-content-panel" style={{ animationDelay: "0.3s" }}>
            <div className="b-panel-header">
              <h3 className="b-panel-title">
                <TrendingUp size={16} color="var(--color-primary)" />
                進度 S 曲線
              </h3>
              <div className="b-panel-legend">
                <div className="b-legend-item">
                  <div className="b-legend-dot" style={{ background: 'var(--color-surface-border)' }} /> 預定
                </div>
                <div className="b-legend-item">
                  <div className="b-legend-dot" style={{ background: 'var(--color-primary)' }} /> 實際
                </div>
              </div>
            </div>
            
            <div className="s-curve-chart">
              {sCurveData.map((d, i) => (
                <div key={i} className="s-curve-col">
                  <div className="s-curve-bars">
                    <div 
                      className="s-curve-bar-planned" 
                      style={{ height: `${(d.p / 100) * 100}%`, transitionDelay: `${i * 80}ms` }} 
                    />
                    <div 
                      className="s-curve-bar-actual" 
                      style={{ height: `${(d.a / 100) * 100}%`, transitionDelay: `${i * 80 + 40}ms` }} 
                    />
                  </div>
                  <span className="s-curve-month">{d.m}</span>
                </div>
              ))}
            </div>
          </div>

          {/* New: Project Info Panel */}
          <div className="b-content-panel" style={{ animationDelay: "0.4s" }}>
            <h3 className="b-panel-title">
              <Info size={16} color="var(--color-primary)" />
              工程基本資訊
            </h3>
            <div className="project-info-list" style={{ marginTop: '1rem' }}>
              <div className="info-row">
                <span className="info-label">工程編號</span>
                <span className="info-value">{project.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="info-row">
                <span className="info-label">主辦單位</span>
                <span className="info-value">雲林縣政府</span>
              </div>
              <div className="info-row">
                <span className="info-label">承攬單位</span>
                <span className="info-value">{project.contractor || '尚未指定'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">當前狀態</span>
                <span className={`status-badge ${project.status}`}>{project.status === 'active' ? '執行中' : '已完工'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 右直欄：進度財務 + 最近活動 */}
        <div className="dash-col-right" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Progress Summary Panel */}
          <div className="b-content-panel" style={{ animationDelay: "0.35s" }}>
            <h3 className="b-panel-title" style={{ marginBottom: '1.25rem' }}>
              <PieChart size={16} color="var(--color-primary)" />
              進度與財務摘要
            </h3>
            
            <div className="b-progress-details">
              <div style={{ marginBottom: '1.5rem' }}>
                <div className="b-prog-item-header">
                  <span className="b-prog-label">施工累計進度</span>
                  <span className={`b-prog-val ${diff < 0 ? 'red' : 'blue'}`}>
                    實 {actual}% / 預 {planned}%
                  </span>
                </div>
                <div className="b-layered-bar">
                  <div className="b-bar-bg" style={{ width: `${planned}%` }} />
                  <div className="b-bar-fg blue" style={{ width: `${actual}%` }} />
                </div>
                {diff < 0 && (
                  <div className="b-prog-warn">
                    <AlertCircle size={14} />
                    <span>進度落後 {Math.abs(diff)}%</span>
                  </div>
                )}
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <div className="b-prog-item-header">
                  <span className="b-prog-label">請款金額進度</span>
                  <span className="b-prog-val violet">{paymentProg}%</span>
                </div>
                <div className="b-layered-bar">
                  <div className="b-bar-fg violet" style={{ width: `${paymentProg}%` }} />
                </div>
              </div>
            </div>
          </div>



          {/* New: Recent Activities Panel */}
          <div className="b-content-panel" style={{ animationDelay: "0.45s" }}>
            <div className="b-panel-header">
              <h3 className="b-panel-title">
                <Activity size={16} color="var(--color-primary)" />
                最近活動
              </h3>
              <button className="btn-text" onClick={() => navigate(`/projects/${id}/diary`)}>查看更多</button>
            </div>
            <div className="activity-timeline" style={{ marginTop: '1rem' }}>
              {recentActivities.map((act, i) => (
                <div key={i} className="timeline-item">
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <div className="timeline-date">{act.date}</div>
                    <div className="timeline-text">{act.event}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
