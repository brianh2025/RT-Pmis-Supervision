import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useProjects } from '../hooks/useProjects';
import { AddProjectModal } from '../components/AddProjectModal';
import { ExcelImportModal } from '../components/ExcelImportModal';
import { ReportReminderBanner } from '../components/ReportReminderBanner';
import {
  LogOut, Building2, TrendingUp, RefreshCw, 
  PlusCircle, FileSpreadsheet, Sun, Moon, BookOpen, 
  ChevronLeft, ChevronRight, Menu, LayoutDashboard, Archive, FileCheck2, ShieldCheck
} from 'lucide-react';
import './Dashboard.css';
import '../components/ProjectLayout.css';

const MENU_GROUPS_MAIN = [
  {
    label: "監造",
    items: [
      { icon: LayoutDashboard, label: "專案總覽", path: "dashboard" },
    ],
  },
];

const STATUS_CONFIG = {
  active:    { label: '執行中', colorClass: 'status-active' },
  completed: { label: '已完工', colorClass: 'status-completed' },
  suspended: { label: '暫停中', colorClass: 'status-suspended' },
};

export function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { projects, loading, error, refresh } = useProjects();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
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

      <aside className={`pl-sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="pl-sidebar-header">
          <Link to="/dashboard" className="pl-brand" onClick={() => setIsMobileOpen(false)}>
            <div className="pl-brand-icon-wrapper">
              <Building2 size={20} />
            </div>
            {!isCollapsed && <h1>RT PMIS</h1>}
          </Link>
          <button className="pl-sidebar-toggle" onClick={() => setIsCollapsed(!isCollapsed)}>
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        <div className="pl-nav-scroll custom-scrollbar">
          {MENU_GROUPS_MAIN.map((group, idx) => (
            <div key={idx} className="pl-nav-group">
              <div className="pl-nav-items">
                {group.items.map((item, i) => {
                  const isActive = true;
                  const Icon = item.icon;
                  return (
                    <div key={i} className={`pl-nav-link ${isActive ? 'active' : ''}`}>
                      <Icon size={20} className="pl-nav-icon" />
                      {!isCollapsed && <span className="pl-nav-label">{item.label}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {!isCollapsed && (
            <div style={{ padding: '12px 16px 8px', animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s both' }}>
              <div style={{
                background: 'linear-gradient(135deg, rgba(21,101,192,0.08) 0%, rgba(21,101,192,0.03) 100%)',
                border: '1px solid rgba(21,101,192,0.15)',
                borderRadius: 12,
                padding: '12px 14px',
              }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-primary)', margin: '0 0 4px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>《 專案開始 》</p>
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.6 }}>
                  在右方選取工程卡片<br />即可登入專案儀表板
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="pl-sidebar-footer">
          <div className="pl-user-info-brief">
            <div className="user-avatar-mini">admin</div>
            {!isCollapsed && <span className="user-email-mini">admin@xiaoxiong.page</span>}
          </div>
          <button className="pl-btn-logout" onClick={handleSignOut} title="登出系統">
            <LogOut size={16} className="pl-nav-icon" />
            {!isCollapsed && <span>登出</span>}
          </button>
        </div>
      </aside>

      <div className="pl-main-wrapper">
        <header className="pl-topbar">
          <div className="pl-topbar-left">
            <button className="pl-mobile-toggle" onClick={() => setIsMobileOpen(true)}>
              <Menu size={24} />
            </button>
          </div>
          <div className="pl-topbar-actions">
            <div className="topbar-info-group">
               <span className="topbar-weather desktop-only">
                 <Sun size={16} color="var(--color-secondary)" />
                 <span>26°C</span>
               </span>
               <span className="topbar-time desktop-only">{formatDateWithSeconds(time)}</span>
               <button className="btn-help-preheat" title="預留教學指引">?</button>
            </div>
            <button className="btn-theme-toggle" onClick={toggleTheme}>
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <main className="pl-content-area custom-scrollbar dashboard-page">
          <div className="dash-main" style={{ padding: '12px 16px' }}>
            <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div>
                 <h1 className="dash-title" style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--color-text-main)', margin: 0, letterSpacing: '-0.01em' }}>雲林縣工程監造</h1>
               </div>
               <div className="dash-table-actions" style={{ display: 'flex', gap: '8px' }}>
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

            <section className="dash-kpi-grid-custom" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="kpi-card kpi-blue" style={{ flex: 1, padding: '10px' }}>
                <div className="kpi-icon"><Building2 size={18} /></div>
                <div className="kpi-content">
                  <span className="kpi-value" style={{ fontSize: '1.4rem' }}>{loading ? '—' : activeCount}</span>
                  <span className="kpi-label-zh" style={{ fontSize: '11px' }}>執行中工程</span>
                </div>
              </div>
              <div className="kpi-card kpi-green" style={{ flex: 1, padding: '10px' }}>
                <div className="kpi-icon"><TrendingUp size={18} /></div>
                <div className="kpi-content">
                  <span className="kpi-value" style={{ fontSize: '1.4rem' }}>{loading ? '—' : behindCount}</span>
                  <span className="kpi-label-zh" style={{ fontSize: '11px', color: 'var(--color-danger)' }}>落後工程數</span>
                </div>
              </div>
              <div className="kpi-card" style={{ flex: 2, display: 'flex', alignItems: 'center', background: 'var(--color-bg2)', border: '1px solid var(--color-block-border)', padding: '10px' }}>
                 <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', fontWeight: 700 }}>總覽進度 OVERALL</div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                       <div><div style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>計畫</div><div style={{ fontWeight: 700, fontSize: '13px' }}>{avgPlannedProgress}%</div></div>
                       <div><div style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>實際</div><div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-primary)' }}>{avgProgress}%</div></div>
                    </div>
                 </div>
                 <div style={{ width: '44px', height: '44px', position: 'relative' }}>
                    <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                       <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-surface-border)" strokeWidth="12" />
                       <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-primary)" strokeWidth="12" strokeLinecap="round" strokeDasharray="251" strokeDashoffset={251 - (avgProgress * 2.51)} />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>{avgProgress}%</div>
                 </div>
              </div>
            </section>

            <div className="dash-project-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
              {projects.map(p => {
                const lp = p.latest_progress;
                const prog = lp ? lp.actual_progress : 0;
                return (
                  <div key={p.id} className="dash-project-card" onClick={() => navigate(`/projects/${p.id}/dashboard`)} style={{ cursor: 'pointer', border: '1px solid var(--color-surface-border)', borderRadius: '10px', background: 'var(--color-bg2)', overflow: 'hidden' }}>
                    <div style={{ height: '3px', background: p.status === 'active' ? 'var(--color-primary)' : 'var(--color-text-muted)' }} />
                    <div style={{ padding: '10px' }}>
                      <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>{p.id.slice(0,8).toUpperCase()}</div>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</h3>
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '3px' }}>
                          <span>施工進度</span>
                          <span>{prog}%</span>
                        </div>
                        <div style={{ height: '5px', background: 'var(--color-background-soft)', borderRadius: '10px' }}>
                          <div style={{ height: '100%', background: 'var(--color-primary)', width: `${prog}%`, borderRadius: '10px' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{p.contractor || '未指定'}</span>
                         <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: 'var(--color-surface-hover)' }}>{STATUS_CONFIG[p.status]?.label}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {showAddModal && <AddProjectModal onClose={() => setShowAddModal(false)} onSuccess={handleDataAdded} />}
        </main>
      </div>
    </div>
  );
}
