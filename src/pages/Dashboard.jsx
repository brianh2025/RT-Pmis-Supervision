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

/** 圓形進度環元件 */
function CircularProgress({ value = 0, size = 48, strokeWidth = 5, color = 'var(--color-primary)' }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="var(--color-surface-border)" strokeWidth={strokeWidth} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.34,1.56,0.64,1)' }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        fontSize={size < 44 ? 8 : 10} fontWeight="700"
        fill="var(--color-text-main)">
        {value}%
      </text>
    </svg>
  );
}

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

      {/* Sidebar 整合所有工具（傳入 isDarkMode、toggleTheme、time、formatDate） */}
      <Sidebar 
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        projectId={null}
        onSignOut={handleSignOut}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        time={time}
        formatDate={formatDateWithSeconds}
      />

      <div className="pl-main-wrapper">
        {/* Topbar 僅行動版顯示（總覽模式：顯示登出、隱藏漢堡鍵） */}
        <Topbar isGlobalDashboard={true} onSignOut={handleSignOut} />

        <main className="pl-content-area custom-scrollbar dashboard-page">
          <div className="dash-main">
              {/* 標題列：垂直色條 + 標題 + 按鈕同一列 */}
              <div className="dash-page-header">
                <div className="dash-title-block">
                  <span className="dash-title-accent" />
                  <div>
                    <h1 className="dash-title">雲林縣工程監造</h1>
                    {showWelcome && (
                      <span className="welcome-msg-inline animate-fade-out">
                        歡迎進行監造作業。
                      </span>
                    )}
                  </div>
                </div>
                <div className="dash-table-actions">
                  <button className="btn-dash-action" onClick={() => setShowAddModal(true)}>
                    <PlusCircle size={13} />
                    <span>新增工程</span>
                  </button>
                  <button className="btn-dash-action btn-dash-excel" onClick={() => setShowExcelModal(true)}>
                    <FileSpreadsheet size={13} />
                    <span>Excel 匯入</span>
                  </button>
                </div>
              </div>

            {projects.length > 0 && <ReportReminderBanner projectId={projects[0]?.id} />}

            <section className="dash-kpi-grid-custom">
              <div className="kpi-card kpi-blue" style={{ animationDelay: '0.1s' }}>
                <div className="kpi-icon"><Building2 size={18} /></div>
                <div className="kpi-content">
                  <span className="kpi-value">{loading ? '—' : activeCount}</span>
                  <span className="kpi-label-zh">執行中工程</span>
                </div>
              </div>
              <div className="kpi-card kpi-red" style={{ animationDelay: '0.2s' }}>
                <div className="kpi-icon"><AlertCircle size={18} /></div>
                <div className="kpi-content">
                  <span className="kpi-value" style={{ color: 'var(--color-danger)' }}>{loading ? '—' : behindCount}</span>
                  <span className="kpi-label-zh">落後工程</span>
                </div>
              </div>
              <div className="kpi-card kpi-highlight" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-block-border)', padding: '10px 12px', animationDelay: '0.3s' }}>
                 <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>總覽進度 Overall</div>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                       <div><div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>計畫進度</div><div style={{ fontWeight: 700, fontSize: '16px' }}>{avgPlannedProgress}%</div></div>
                       <div><div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>實際進度</div><div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--color-primary)' }}>{avgProgress}%</div></div>
                    </div>
                 </div>
                 <CircularProgress value={avgProgress} size={52} strokeWidth={5} />
              </div>
            </section>

            {/* 工程列表標題：與卡片內文對齊（左側色條 4px + body padding 10px = 14px） */}
            <div className="dash-section-header">
              <h2 className="dash-section-h2">工程列表</h2>
              <span className="dash-section-count">共 {projects.length} 個項目</span>
            </div>

            <div className="dash-project-grid">
              {projects.map((p, index) => {
                const lp = p.latest_progress;
                const prog = lp ? lp.actual_progress : 0;
                const planned = lp ? lp.planned_progress : 0;
                const diff = prog - planned;
                return (
                  <div
                    key={p.id}
                    className="dash-project-card dash-project-card-compact"
                    onClick={() => navigate(`/projects/${p.id}/dashboard`)}
                    style={{ animationDelay: `${0.3 + index * 0.04}s` }}
                  >
                    {/* 左側色條 */}
                    <div className="card-accent-side" style={{
                      background: p.status === 'active' ? 'var(--color-primary)' :
                                  p.status === 'suspended' ? 'var(--color-warning)' : 'var(--color-text-muted)'
                    }} />

                    {/* 右側內容 */}
                    <div className="card-compact-body">
                      {/* 上排：名稱 + 狀態 */}
                      <div className="card-compact-top">
                        <div>
                          <div className="card-meta-compact">{p.id.slice(0,8).toUpperCase()}</div>
                          <div className="card-title-compact">{p.name}</div>
                          <div className="card-contractor-compact">{p.contractor || '未指定單位'}</div>
                        </div>
                        {/* 圓形進度環 */}
                        <CircularProgress
                          value={prog}
                          size={48}
                          strokeWidth={5}
                          color={diff < -5 ? 'var(--color-error)' : 'var(--color-primary)'}
                        />
                      </div>

                      {/* 下排：進度條（差值標示） */}
                      <div className="card-compact-progress">
                        <div className="card-compact-progress-labels">
                          <span>計畫 {planned}% · 實際 {prog}%</span>
                          <span className={`diff-badge ${diff >= 0 ? 'diff-positive' : 'diff-negative'}`}>
                            {diff >= 0 ? '+' : ''}{diff}%
                          </span>
                        </div>
                        <div className="layered-progress-bar" style={{ height: '5px' }}>
                          <div className="bar-planned" style={{ width: `${planned}%` }} />
                          <div className="bar-actual" style={{ width: `${prog}%` }} />
                        </div>
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
