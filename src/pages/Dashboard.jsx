import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useProjects } from '../hooks/useProjects';
import { AddProjectModal } from '../components/AddProjectModal';
import { ExcelImportModal } from '../components/ExcelImportModal';
import { DiaryImportModal } from '../components/DiaryImportModal';
import { ReportReminderBanner } from '../components/ReportReminderBanner';
import {
  LogOut, Building2, TrendingUp, AlertTriangle,
  CheckCircle2, Clock, PauseCircle, RefreshCw,
  PlusCircle, FileSpreadsheet, Sun, Moon, BookOpen, Eye,
  ChevronLeft, ChevronRight, Menu, LayoutDashboard, LineChart, Archive, FileCheck2, ShieldCheck
} from 'lucide-react';
import './Dashboard.css';
import '../components/ProjectLayout.css';

const MENU_GROUPS = [
  {
    label: "監造",
    items: [
      { icon: LayoutDashboard, label: "專案總覽", path: "dashboard" },
      { icon: BookOpen, label: "施工日誌", path: "diary" },
    ],
  },
  {
    label: "文件",
    items: [
      { icon: Archive, label: "歸檔管理", path: "archive" },
      { icon: FileCheck2, label: "送審管理", path: "submission" },
      { icon: ShieldCheck, label: "品管管理", path: "quality" },
    ],
  },
];

const STATUS_CONFIG = {
  active:    { label: '執行中', enLabel: 'ACTIVE',    icon: Clock,        colorClass: 'status-active'    },
  completed: { label: '已完工', enLabel: 'COMPLETED', icon: CheckCircle2, colorClass: 'status-completed' },
  suspended: { label: '暫停中', enLabel: 'SUSPENDED', icon: PauseCircle,  colorClass: 'status-suspended' },
};

function progressColor(planned, actual) {
  if (actual == null) return 'var(--color-text-muted)';
  const diff = actual - planned;
  if (diff >= 0)  return 'var(--color-success)';
  if (diff >= -5) return 'var(--color-warning)';
  return 'var(--color-error)';
}

export function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { projects, loading, error, refresh } = useProjects();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showDiaryModal, setShowDiaryModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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

  const displayName = user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email
    || '使用者';

  return (
    <div className="project-layout-container">
      {/* Mobile Overlay */}
      <div 
        className={`pl-mobile-overlay ${isMobileOpen ? 'active' : ''}`}
        onClick={() => setIsMobileOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`pl-sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="pl-sidebar-header">
          <Link to="/dashboard" className="pl-brand" onClick={() => setIsMobileOpen(false)}>
            <div className="pl-brand-icon-wrapper" title="返回總覽">
              <Building2 size={20} />
            </div>
            {!isCollapsed && <h1 title="返回總覽">RT PMIS</h1>}
          </Link>
          <button 
            className="pl-sidebar-toggle"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "展開選單" : "收合選單"}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        <div className="pl-nav-scroll custom-scrollbar">
          {MENU_GROUPS.map((group, idx) => (
            <div key={idx} className="pl-nav-group">
              {!isCollapsed && <div className="pl-nav-group-label">{group.label}</div>}
              <div className="pl-nav-items">
                {group.items.map((item, i) => {
                  const isActive = item.path === 'dashboard'; // Only Top level dashboard is active
                  const isPetrified = item.path !== 'dashboard'; // Others are petrified
                  const Icon = item.icon;
                  return (
                    <div
                      key={i}
                      className={`pl-nav-link ${isActive ? 'active' : ''}`}
                      style={isPetrified ? { opacity: 0.5, pointerEvents: 'none', filter: 'grayscale(100%)' } : {}}
                      onClick={() => !isPetrified && setIsMobileOpen(false)}
                    >
                      <Icon size={20} className="pl-nav-icon" />
                      {!isCollapsed && <span className="pl-nav-label">{item.label}</span>}
                      {isCollapsed && <div className="pl-nav-tooltip">{item.label}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="pl-sidebar-footer">
          <button className="pl-btn-logout" onClick={handleSignOut}>
            <LogOut size={18} className="pl-nav-icon" />
            {!isCollapsed && <span>登出</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="pl-main-wrapper">
        <header className="pl-topbar">
          <div className="pl-topbar-left">
            <button className="pl-mobile-toggle" onClick={() => setIsMobileOpen(true)}>
              <Menu size={24} />
            </button>
            <div className="pl-project-badge">
              <div className="status-dot active" />
              案件總攬
            </div>
          </div>
          <div className="pl-topbar-actions">
            <span className="dash-user-name" style={{marginRight: '12px', fontSize: '0.9rem', color: 'var(--color-text-muted)'}}>{displayName}</span>
            <button
              className="btn-theme-toggle"
              onClick={toggleTheme}
              title={isDarkMode ? '切換亮色模式' : '切換暗色模式'}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <main className="pl-content-area custom-scrollbar dashboard-page" style={{ height: 'calc(100vh - var(--topbar-height))', overflowY: 'auto' }}>
          <div className="dash-main">
            {/* Page Title */}
            <div className="dash-page-header">
              <div>
                <h1 className="dash-title">工程概況</h1>
                <p className="dash-subtitle">PROJECT OVERVIEW · 雲林轄區</p>
              </div>
              <div className="dash-table-actions">
                {loading && <RefreshCw size={16} className="spin-icon text-primary" />}
                <button className="btn-dash-action" onClick={() => setShowAddModal(true)}>
                  <PlusCircle size={15} />
                  <span>新增工程</span>
                </button>
                <button className="btn-dash-action btn-dash-excel" onClick={() => setShowExcelModal(true)}>
                  <FileSpreadsheet size={15} />
                  <span>Excel 匯入</span>
                </button>
              </div>
            </div>

            {projects.length > 0 && (
              <ReportReminderBanner projectId={projects[0]?.id} />
            )}

            {/* KPI Cards */}
            <section className="dash-kpi-grid-custom" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              
              {/* Blue Card: Active Projects */}
              <div className="kpi-card kpi-blue" style={{ flex: '1 1 250px' }}>
                <div className="kpi-icon"><Building2 size={24} /></div>
                <div className="kpi-content">
                  <span className="kpi-value">{loading ? '—' : activeCount}</span>
                  <span className="kpi-label-zh">執行中工程</span>
                  <span className="kpi-label-en">ACTIVE PROJECTS</span>
                </div>
              </div>
              
              {/* Green Card: Smaller size ("綠色空白消除變小") */}
              <div className="kpi-card kpi-green" style={{ flex: '0 1 200px', padding: '1.25rem' }}>
                <div className="kpi-icon"><TrendingUp size={24} /></div>
                <div className="kpi-content">
                  <span className="kpi-value">{loading ? '—' : behindCount}</span>
                  <span className="kpi-label-zh">落後工程數</span>
                  <span className="kpi-label-en">BEHIND SCHEDULE</span>
                </div>
              </div>
              
              {/* Red Card Replacement: B Version Overview Progress + Animation */}
              <div className="kpi-card b-progress-card" style={{ flex: '2 1 350px', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem 2rem', background: 'var(--color-bg1)', border: '1px solid var(--color-surface-border)' }}>
                <div className="kpi-content" style={{ alignItems: 'flex-start' }}>
                  <span className="kpi-label-zh" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '0.25rem' }}>總覽進度</span>
                  <span className="kpi-label-en" style={{ marginBottom: '0.75rem' }}>OVERALL PROGRESS</span>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    <div>
                      <div className="text-xs text-slate-400">平均計畫</div>
                      <div className="text-sm font-bold" style={{ color: 'var(--color-text-main)' }}>{loading ? '—' : `${avgPlannedProgress}%`}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">平均實際</div>
                      <div className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>{loading ? '—' : `${avgProgress}%`}</div>
                    </div>
                  </div>
                </div>
                
                <div className="circular-progress-container" style={{ position: 'relative', width: '90px', height: '90px' }}>
                  <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                    <circle
                      cx="50" cy="50" r="40"
                      fill="none"
                      stroke="var(--color-surface-border)"
                      strokeWidth="8"
                    />
                    <circle
                      cx="50" cy="50" r="40"
                      fill="none"
                      stroke="var(--color-primary)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 40}
                      strokeDashoffset={loading ? 2 * Math.PI * 40 : (2 * Math.PI * 40) - ((avgProgress / 100) * (2 * Math.PI * 40))}
                      style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-main)' }}>{loading ? '—' : `${avgProgress}`}</span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', marginTop: '-2px' }}>%</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Project Cards Grid (B Version) */}
            {error && (
              <div className="dash-error-msg">
                資料載入失敗：{error}
              </div>
            )}

            {!loading && !error && projects.length === 0 && (
              <div className="dash-empty">
                尚無工程資料 No projects found
              </div>
            )}

            {!loading && !error && projects.length > 0 && (
              <div className="dash-project-grid">
                {projects.map(project => {
                  const lp = project.latest_progress;
                  const diff = lp ? (lp.actual_progress - lp.planned_progress) : null;
                  
                  // Status to line color mapping
                  let lineClass = 'line-active';
                  if (project.status === 'completed') lineClass = 'line-completed';
                  else if (project.status === 'suspended') lineClass = 'line-suspended';
                  else if (diff !== null && diff <= -5) lineClass = 'line-behind';
                  
                  return (
                    <div 
                      key={project.id} 
                      className="dash-project-card"
                      onClick={() => navigate(`/projects/${project.id}/dashboard`)}
                    >
                      <div className={`card-accent-line ${lineClass}`} />
                      
                      <div className="dash-project-card-inner">
                        <div className="card-top">
                          <span className="card-id">{project.id.slice(0, 8).toUpperCase()}</span>
                        </div>
                        <h3 className="card-title">{project.name}</h3>

                        <div className="card-progress-section">
                          <div className="progress-row">
                            <div className="progress-row-header">
                              <span className="progress-label">施工進度</span>
                              <div className="progress-stats">
                                <span>預{lp?.planned_progress || 0}%</span>
                                <span>·</span>
                                <span className="stat-actual">實{lp?.actual_progress || 0}%</span>
                                {diff !== null && diff !== 0 && (
                                  <span className={`diff-badge ${diff > 0 ? 'diff-positive' : 'diff-negative'}`}>
                                    {diff > 0 ? '+' : ''}{diff}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="layered-progress-bar">
                              <div className="bar-planned" style={{ width: `${lp?.planned_progress || 0}%` }} />
                              <div className="bar-actual" style={{ width: `${lp?.actual_progress || 0}%` }} />
                            </div>
                          </div>
                          
                          <div className="progress-row">
                            <div className="progress-row-header">
                              <span className="progress-label">請款進度</span>
                              <span className="progress-stats" style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>
                                {project.budget ? Math.min(100, Math.round(((lp?.actual_progress || 0) * project.budget) / 10000)) : 0}%
                              </span>
                            </div>
                            <div className="layered-progress-bar">
                              <div className="bar-actual" style={{ width: `${project.budget ? Math.min(100, Math.round(((lp?.actual_progress || 0) * project.budget) / 10000)) : 0}%`, background: 'var(--color-text-muted)', transitionDelay: '0.3s' }} />
                            </div>
                          </div>
                        </div>

                        <div className="card-bottom">
                          <div className="card-client">
                            <Building2 size={13} />
                            <span>{project.contractor || '尚未指定承包商'}</span>
                          </div>
                          
                          <div className={`card-status status-${project.status === 'active' && diff !== null && diff <= -5 ? 'behind' : project.status}`}>
                            <div className="status-dot" />
                            <span>{project.status === 'active' && diff !== null && diff <= -5 ? '嚴重落後' : (STATUS_CONFIG[project.status]?.label || '未知')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modals */}
          {showAddModal && (
            <AddProjectModal
              onClose={() => setShowAddModal(false)}
              onSuccess={handleDataAdded}
            />
          )}
          {showExcelModal && (
            <ExcelImportModal
              onClose={() => setShowExcelModal(false)}
              onSuccess={handleDataAdded}
            />
          )}
          {showDiaryModal && selectedProjectId && (
            <DiaryImportModal
              projectId={selectedProjectId}
              onClose={() => setShowDiaryModal(false)}
              onSuccess={handleDataAdded}
            />
          )}
        </main>
      </div>
    </div>
  );
}

