import React, { useState, useEffect, useRef } from 'react';
import { useAutoHideScrollbar } from '../hooks/useAutoHideScrollbar';
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
  Building2, PlusCircle, FileSpreadsheet, AlertCircle, CheckCircle2, Layers
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
  
  const contentRef = useRef(null);
  useAutoHideScrollbar(contentRef);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
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

  const isBehind = (p) => {
    const lp = p.latest_progress;
    return p.status === 'active' && lp && (lp.actual_progress - lp.planned_progress) < -5;
  };
  const activeCount    = projects.filter(p => p.status === 'active').length;
  const behindCount    = projects.filter(isBehind).length;
  const completedCount = projects.filter(p => p.status === 'completed').length;
  const suspendedCount = projects.filter(p => p.status === 'suspended').length;

  const FILTERS = [
    { key: 'all',       label: '全部',   count: projects.length,  icon: Layers,       color: 'var(--color-text2)' },
    { key: 'active',    label: '執行中', count: activeCount,      icon: Building2,    color: 'var(--color-primary-light)' },
    { key: 'behind',    label: '落後',   count: behindCount,      icon: AlertCircle,  color: 'var(--color-danger)' },
    { key: 'completed', label: '已完工', count: completedCount,   icon: CheckCircle2, color: 'var(--color-success)' },
    ...(suspendedCount > 0 ? [{ key: 'suspended', label: '暫停中', count: suspendedCount, icon: AlertCircle, color: 'var(--color-warning)' }] : []),
  ];

  const filteredProjects = projects.filter(p => {
    if (statusFilter === 'all')       return true;
    if (statusFilter === 'behind')    return isBehind(p);
    return p.status === statusFilter;
  });

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

        <main ref={contentRef} className="pl-content-area custom-scrollbar dashboard-page">
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

            {/* Banner + 篩選徽章同一列，空間不足時整列換行 */}
            <div className="dash-banner-filter-row">
              {projects.length > 0 && <ReportReminderBanner projectId={projects[0]?.id} />}
              <div className="dash-filter-bar">
                {loading ? (
                  <span className="dash-filter-loading">載入中…</span>
                ) : FILTERS.map(f => {
                  const Icon = f.icon;
                  const active = statusFilter === f.key;
                  return (
                    <button
                      key={f.key}
                      className={`dash-filter-chip${active ? ' active' : ''}${f.key === 'behind' && f.count > 0 ? ' has-alert' : ''}`}
                      style={{ '--chip-color': f.color }}
                      onClick={() => setStatusFilter(f.key)}
                    >
                      <Icon size={12} />
                      <span className="chip-label">{f.label}</span>
                      <span className="chip-count">{f.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 工程列表標題 */}
            <div className="dash-section-header">
              <h2 className="dash-section-h2">工程列表</h2>
              <span className="dash-section-count">
                {statusFilter === 'all' ? `共 ${projects.length} 個項目` : `篩選：${filteredProjects.length} / ${projects.length}`}
              </span>
            </div>

            <div className="dash-project-grid">
              {filteredProjects.length === 0 && (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.82rem', background: 'var(--color-surface)', borderRadius: '10px', border: '1px solid var(--color-surface-border)' }}>
                  此分類目前無工程
                </div>
              )}
              {filteredProjects.map((p, index) => {
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
