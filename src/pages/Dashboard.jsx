import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useProjects } from '../hooks/useProjects';
import { AddProjectModal } from '../components/AddProjectModal';
import { ExcelImportModal } from '../components/ExcelImportModal';
import { ReportReminderBanner } from '../components/ReportReminderBanner';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import {
  Building2, TrendingUp, PlusCircle, FileSpreadsheet, AlertCircle
} from 'lucide-react';
import './Dashboard.css';
import '../components/ProjectLayout.css';

const STATUS_CONFIG = {
  active:    { label: '執行中', colorClass: 'status-active' },
  completed: { label: '已完工', colorClass: 'status-completed' },
  suspended: { label: '暫停中', colorClass: 'status-suspended' },
};

export function Dashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { projects, loading, refresh } = useProjects();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [time, setTime] = useState(new Date());
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    const welcomeTimer = setTimeout(() => setShowWelcome(false), 5000);
    return () => {
      clearInterval(timer);
      clearTimeout(welcomeTimer);
    };
  }, []);

  const formatDateWithSeconds = (date) => {
    return new Intl.DateTimeFormat('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).format(date);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const handleDataAdded = () => refresh?.();

  const activeCount   = projects.filter(p => p.status === 'active').length;
  const behindCount   = projects.filter(p => {
    const lp = p.latest_progress;
    return lp && (lp.actual_progress - lp.planned_progress) < -5;
  }).length;
  const avgProgress   = projects.length
    ? Math.round(projects.reduce((sum, p) => sum + (p.latest_progress?.actual_progress ?? 0), 0) / projects.length)
    : 0;
  const avgPlannedProgress = projects.length
    ? Math.round(projects.reduce((sum, p) => sum + (p.latest_progress?.planned_progress ?? 0), 0) / projects.length)
    : 0;

  return (
    <div className="project-layout-container">
      <div 
        className={`pl-mobile-overlay ${isMobileOpen ? 'active' : ''}`}
        onClick={() => setIsMobileOpen(false)}
      />

      <Sidebar 
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        projectId={null}
        onSignOut={handleSignOut}
      />

      <div className="pl-main-wrapper">
        <Topbar 
          setIsMobileOpen={setIsMobileOpen}
          project={null}
          loading={loading}
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
          time={time}
          formatDate={formatDateWithSeconds}
        />

        <main className="pl-content-area custom-scrollbar dashboard-page">
          <div className="dash-main">
              <div className="dash-page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h1 className="dash-title" style={{ fontSize: 'var(--fs-3xl)', fontWeight: 800, letterSpacing: '-0.02em' }}>雲林縣工程監造</h1>
                  {showWelcome && (
                    <span className="welcome-msg-inline animate-fade-out" style={{ fontSize: 'var(--fs-xs)' }}>
                      歡迎進行監造作業。
                    </span>
                  )}
                </div>
                <div className="dash-table-actions" style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn-dash-action" onClick={() => setShowAddModal(true)}>
                    <PlusCircle size={14} />
                    <span>新增工程</span>
                  </button>
                  <button className="btn-dash-action btn-dash-excel" onClick={() => setShowExcelModal(true)}>
                    <FileSpreadsheet size={14} />
                    <span>Excel 匯入</span>
                  </button>
                </div>
              </div>

            {projects.length > 0 && <ReportReminderBanner projectId={projects[0]?.id} />}

            <section className="dash-kpi-grid-custom">
              <div className="kpi-card kpi-blue" style={{ animationDelay: '0.1s' }}>
                <div className="kpi-icon"><Building2 size={20} /></div>
                <div className="kpi-content">
                  <span className="kpi-value">{loading ? '—' : activeCount}</span>
                  <span className="kpi-label-zh">執行中工程</span>
                </div>
              </div>
              <div className="kpi-card kpi-red" style={{ animationDelay: '0.2s' }}>
                <div className="kpi-icon"><AlertCircle size={20} /></div>
                <div className="kpi-content">
                  <span className="kpi-value" style={{ color: 'var(--color-danger)' }}>{loading ? '—' : behindCount}</span>
                  <span className="kpi-label-zh">落後工程</span>
                </div>
              </div>
              <div className="kpi-card kpi-highlight" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-block-border)', padding: '16px', animationDelay: '0.3s' }}>
                 <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>總覽進度 Overall</div>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                       <div><div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>計畫進度</div><div style={{ fontWeight: 700, fontSize: '18px' }}>{avgPlannedProgress}%</div></div>
                       <div><div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>實際進度</div><div style={{ fontWeight: 700, fontSize: '18px', color: 'var(--color-primary)' }}>{avgProgress}%</div></div>
                    </div>
                 </div>
                 <div style={{ width: '60px', height: '60px', position: 'relative' }}>
                    <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                       <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-surface-border)" strokeWidth="10" />
                       <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-primary)" strokeWidth="10" strokeLinecap="round" strokeDasharray="264" strokeDashoffset={264 - (avgProgress * 2.64)} style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800 }}>{avgProgress}%</div>
                 </div>
              </div>
            </section>

            <div className="dash-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>工程列表</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>共 {projects.length} 個項目</span>
            </div>

            <div className="dash-project-grid">
              {projects.map((p, index) => {
                const lp = p.latest_progress;
                const prog = lp ? lp.actual_progress : 0;
                return (
                  <div key={p.id} className="dash-project-card" onClick={() => navigate(`/projects/${p.id}/dashboard`)} style={{ animationDelay: `${0.4 + index * 0.05}s` }}>
                    <div className="card-accent" style={{ background: p.status === 'active' ? 'var(--color-primary)' : 'var(--color-text-muted)' }} />
                    <div className="card-body">
                      <div className="card-meta">{p.id.slice(0,8).toUpperCase()}</div>
                      <h3 className="card-title">{p.name}</h3>
                      <div className="card-progress">
                        <div className="progress-label">
                          <span>施工進度</span>
                          <span className="progress-percent">{prog}%</span>
                        </div>
                        <div className="progress-bar-bg">
                          <div className="progress-bar-fill" style={{ width: `${prog}%` }} />
                        </div>
                      </div>
                      <div className="card-footer">
                         <span className="contractor">{p.contractor || '未指定單位'}</span>
                         <span className={`status-badge ${p.status}`}>{STATUS_CONFIG[p.status]?.label}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {showAddModal && <AddProjectModal onClose={() => setShowAddModal(false)} onSuccess={handleDataAdded} />}
          {showExcelModal && <ExcelImportModal onClose={() => setShowExcelModal(false)} onSuccess={handleDataAdded} />}
        </main>
      </div>
    </div>
  );
}
