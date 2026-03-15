import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, Clock, TrendingUp, CreditCard, AlertCircle, PieChart } from 'lucide-react';
import { useProject } from '../hooks/useProject';
import './Dashboard.css'; // Reuse generic dashboard styles

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
  
  // Dummy data similar to B version UI SAMPLE
  const paymentProg = project.budget ? Math.min(100, Math.round(((actual || 0) * project.budget) / 10000)) : 0;
  
  const stats = [
    { label: "契約金額 (萬)", value: project?.budget || '—', icon: <DollarSign size={18} />, accent: "sky" },
    { label: "工期天數", value: project?.days || '180', icon: <Clock size={18} />, accent: "emerald" }, // Using dummy 180 as we lack absolute days
    { label: "施工進度", value: `${actual}%`, icon: <TrendingUp size={18} />, accent: "blue" },
    { label: "請款進度", value: `${paymentProg}%`, icon: <CreditCard size={18} />, accent: "violet" },
  ];
  
  // Dummy S-Curve data as per B version mock
  const sCurveData = [
    { m: "8月", p: 10, a: 12 }, 
    { m: "9月", p: 20, a: 22 }, 
    { m: "10月", p: 32, a: 30 }, 
    { m: "11月", p: 45, a: 38 }, 
    { m: "12月", p: 55, a: Math.min(43, actual) }, 
    { m: "1月", p: 60, a: actual }
  ];

  return (
    <div className="dash-page-wrapper">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-title">專案儀表板</h1>
        </div>
      </div>
      
      {/* 4 Stats Cards */}
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

      <div className="b-dash-content-grid">
        {/* S-Curve Panel */}
        <div className="b-content-panel" style={{ animationDelay: "0.3s" }}>
          <div className="b-panel-header">
            <h3 className="b-panel-title">
              <TrendingUp size={16} color="var(--color-primary)" />
              進度 S 曲線
            </h3>
            <div className="b-panel-legend">
              <div className="b-legend-item">
                <div className="b-legend-dot" style={{ background: 'var(--color-border)' }} /> 預定
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
                <div className="s-curve-tooltip">
                  實: {d.a}% / 預: {d.p}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Progress Summary Panel */}
        <div className="b-content-panel" style={{ animationDelay: "0.35s" }}>
          <h3 className="b-panel-title" style={{ marginBottom: '0.75rem' }}>
            <PieChart size={16} color="var(--color-primary)" />
            進度摘要
          </h3>
          
          <div className="b-progress-details">
            <div>
              <div className="b-prog-item-header">
                <span className="b-prog-label">施工累計進度</span>
                <span className="b-prog-val blue">實 {actual}% / 預 {planned}%</span>
              </div>
              <div className="b-layered-bar">
                <div className="b-bar-bg" style={{ width: `${planned}%` }} />
                <div className="b-bar-fg blue" style={{ width: `${actual}%` }} />
              </div>
              {diff < 0 && (
                <div className="b-prog-warn">
                  <AlertCircle size={12} />
                  進度落後 {Math.abs(diff)}%
                </div>
              )}
            </div>
            
            <div>
              <div className="b-prog-item-header">
                <span className="b-prog-label">請款進度</span>
                <span className="b-prog-val violet">{paymentProg}%</span>
              </div>
              <div className="b-layered-bar">
                <div className="b-bar-fg violet" style={{ width: `${paymentProg}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
