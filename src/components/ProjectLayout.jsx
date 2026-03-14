import React, { useState } from 'react';
import { Outlet, Link, useLocation, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useProject } from '../hooks/useProject';
import { 
  Building2, 
  ChevronLeft, 
  ChevronRight, 
  LogOut, 
  LayoutDashboard, 
  LineChart, 
  Archive, 
  FileCheck2, 
  ShieldCheck, 
  Menu,
  Sun,
  Moon,
  BookOpen
} from 'lucide-react';
import './ProjectLayout.css';

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

export function ProjectLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { id: projectId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { project, loading } = useProject(projectId);

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

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
          <Link to="/dashboard" className="pl-brand" onClick={() => setIsMobileOpen(false)} title="返回總覽">
            <div className="pl-brand-icon-wrapper">
              <Building2 size={20} />
            </div>
            {!isCollapsed && <h1>RT PMIS</h1>}
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
                  const targetPath = `/projects/${projectId}/${item.path}`;
                  // If we are on /projects/:id/diary/print/..., we still highlight 'diary'
                  const isActive = location.pathname.startsWith(targetPath);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={i}
                      to={targetPath}
                      onClick={() => setIsMobileOpen(false)}
                      className={`pl-nav-link ${isActive ? 'active' : ''}`}
                    >
                      <Icon size={20} className="pl-nav-icon" />
                      {!isCollapsed && <span className="pl-nav-label">{item.label}</span>}
                      {isCollapsed && <div className="pl-nav-tooltip">{item.label}</div>}
                    </Link>
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
              <div className={`status-dot ${project?.status || 'active'}`} />
              {loading ? '載入中...' : (project?.name || '未知工程')}
            </div>
          </div>
          <div className="pl-topbar-actions">
            <button
              className="btn-theme-toggle"
              onClick={toggleTheme}
              title={isDarkMode ? '切換亮色模式' : '切換暗色模式'}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>
        
        <main className="pl-content-area custom-scrollbar">
          {/* This renders the matched child route (e.g. ProjectDashboard, DiaryLog, etc.) */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
