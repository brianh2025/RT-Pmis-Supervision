import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  PlusCircle, FileSpreadsheet, Sun, Moon, BookOpen, Eye
} from 'lucide-react';
import './Dashboard.css';

/** Status config for projects */
const STATUS_CONFIG = {
  active:    { label: '執行中', enLabel: 'ACTIVE',    icon: Clock,        colorClass: 'status-active'    },
  completed: { label: '已完工', enLabel: 'COMPLETED', icon: CheckCircle2, colorClass: 'status-completed' },
  suspended: { label: '暫停中', enLabel: 'SUSPENDED', icon: PauseCircle,  colorClass: 'status-suspended' },
};

/** Progress bar colour based on schedule difference */
function progressColor(planned, actual) {
  if (actual == null) return 'var(--color-text-muted)';
  const diff = actual - planned;
  if (diff >= 0)  return 'var(--color-success)';
  if (diff >= -5) return 'var(--color-warning)';
  return 'var(--color-error)';
}

export function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { projects, loading, error, refresh } = useProjects();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showDiaryModal, setShowDiaryModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const handleDataAdded = () => refresh?.();

  // Derived KPIs
  const activeCount   = projects.filter(p => p.status === 'active').length;
  const behindCount   = projects.filter(p => {
    const lp = p.latest_progress;
    return lp && (lp.actual_progress - lp.planned_progress) < -5;
  }).length;
  const avgProgress   = projects.length
    ? Math.round(projects.reduce((sum, p) => sum + (p.latest_progress?.actual_progress ?? 0), 0) / projects.length)
    : 0;

  const displayName = user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email
    || '使用者';

  return (
    <div className="dashboard-page">
      {/* Top Navigation Bar */}
      <header className="dash-topbar">
        <div className="dash-brand">
          <Building2 size={20} className="dash-brand-icon" />
          <div className="dash-brand-text">
            <span className="dash-brand-zh">專案監造管理系統</span>
            <span className="dash-brand-en">PMIS DASHBOARD</span>
          </div>
        </div>
        <div className="dash-user-area">
          <button
            className="btn-theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={isDarkMode ? '切換亮色模式' : '切換暗色模式'}
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="dash-user-info">
            {user?.user_metadata?.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt="avatar"
                className="dash-avatar"
              />
            )}
            <span className="dash-user-name">{displayName}</span>
          </div>
          <button className="btn-signout" onClick={handleSignOut}>
            <LogOut size={16} />
            <span>登出</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="dash-main">
        {/* Page Title */}
        <div className="dash-page-header">
          <div>
            <h1 className="dash-title">工程概況</h1>
            <p className="dash-subtitle">PROJECT OVERVIEW · 雲林轄區</p>
          </div>
          <span className="dash-date">
            {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>

        {/* Monthly report reminder — auto-shows on days 1-5 or 25-31 */}
        {projects.length > 0 && (
          <ReportReminderBanner projectId={projects[0]?.id} />
        )}

        {/* KPI Cards */}
        <section className="dash-kpi-grid">
          <div className="kpi-card kpi-blue">
            <div className="kpi-icon"><Building2 size={24} /></div>
            <div className="kpi-content">
              <span className="kpi-value">{loading ? '—' : activeCount}</span>
              <span className="kpi-label-zh">執行中工程</span>
              <span className="kpi-label-en">ACTIVE PROJECTS</span>
            </div>
          </div>
          <div className="kpi-card kpi-green">
            <div className="kpi-icon"><TrendingUp size={24} /></div>
            <div className="kpi-content">
              <span className="kpi-value">{loading ? '—' : `${avgProgress}%`}</span>
              <span className="kpi-label-zh">平均實際進度</span>
              <span className="kpi-label-en">AVG. ACTUAL PROGRESS</span>
            </div>
          </div>
          <div className={`kpi-card ${behindCount > 0 ? 'kpi-red' : 'kpi-green'}`}>
            <div className="kpi-icon"><AlertTriangle size={24} /></div>
            <div className="kpi-content">
              <span className="kpi-value">{loading ? '—' : behindCount}</span>
              <span className="kpi-label-zh">落後工程數</span>
              <span className="kpi-label-en">BEHIND SCHEDULE</span>
            </div>
          </div>
        </section>

        {/* Projects Table */}
        <section className="dash-table-section">
          <div className="dash-table-header">
            <h2 className="dash-section-title">工程清單 <span>PROJECT LIST</span></h2>
            <div className="dash-table-actions">
              {loading && <RefreshCw size={16} className="spin-icon" />}
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

          {error && (
            <div className="dash-error-msg">
              資料載入失敗：{error}
            </div>
          )}

          {!loading && !error && (
            <div className="dash-table-wrapper">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>工程名稱<br/><span>Project Name</span></th>
                    <th>施工地點<br/><span>Location</span></th>
                    <th>承包商<br/><span>Contractor</span></th>
                    <th>狀態<br/><span>Status</span></th>
                    <th>計畫 / 實際進度<br/><span>Planned / Actual</span></th>
                    <th>預計完工<br/><span>End Date</span></th>
                    <th>操作<br/><span>Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {projects.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="dash-empty">
                        尚無工程資料 No projects found
                      </td>
                    </tr>
                  ) : (
                    projects.map(project => {
                      const lp = project.latest_progress;
                      const statusCfg = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.active;
                      const StatusIcon = statusCfg.icon;
                      const color = progressColor(lp?.planned_progress, lp?.actual_progress);
                      return (
                        <tr key={project.id} className="dash-row">
                          <td className="td-name">{project.name}</td>
                          <td className="td-location">{project.location ?? '—'}</td>
                          <td className="td-contractor">{project.contractor ?? '—'}</td>
                          <td>
                            <span className={`status-badge ${statusCfg.colorClass}`}>
                              <StatusIcon size={12} />
                              {statusCfg.label}
                            </span>
                          </td>
                          <td className="td-progress">
                            {lp ? (
                              <>
                                <div className="progress-bar-track">
                                  <div
                                    className="progress-bar-fill"
                                    style={{ width: `${lp.actual_progress}%`, background: color }}
                                  />
                                </div>
                                <span className="progress-nums" style={{ color }}>
                                  {lp.planned_progress}% / {lp.actual_progress}%
                                </span>
                              </>
                            ) : (
                              <span className="no-data">未記錄</span>
                            )}
                          </td>
                          <td className="td-date">
                            {project.end_date
                              ? new Date(project.end_date).toLocaleDateString('zh-TW')
                              : '—'}
                          </td>
                          <td className="td-actions">
                            <button
                              className="btn-row-action btn-row-diary-import"
                              title="匯入日誌"
                              onClick={() => {
                                setSelectedProjectId(project.id);
                                setShowDiaryModal(true);
                              }}
                            >
                              <BookOpen size={13} />
                              <span>日誌</span>
                            </button>
                            <button
                              className="btn-row-action btn-row-diary-view"
                              title="查看日誌"
                              onClick={() => navigate(`/dashboard/diary/${project.id}`)}
                            >
                              <Eye size={13} />
                              <span>查看</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

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
    </div>
  );
}
