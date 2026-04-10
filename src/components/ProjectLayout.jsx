import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useProject } from '../hooks/useProject';
import { useAutoHideScrollbar } from '../hooks/useAutoHideScrollbar';
import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import './ProjectLayout.css';

export function ProjectLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { project, loading: _loading } = useProject(projectId);
  const [time, setTime] = useState(new Date());
  const contentRef = useRef(null);
  useAutoHideScrollbar(contentRef);

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

  // ── 依路由決定返回按鈕 ──────────────────────────────────
  const relPath = location.pathname.replace(`/projects/${projectId}/`, '');
  let backInfo = null;

  if (relPath === 'dashboard') {
    // 專案儀表板 → 返回工程總覽
    backInfo = {
      label: '工程總覽',
      onClick: () => navigate('/dashboard'),
    };
  } else if (relPath !== '') {
    // diary / submission / quality / archive / analytics → 返回專案儀表板
    backInfo = {
      label: '專案儀表板',
      onClick: () => navigate(`/projects/${projectId}/dashboard`),
    };
  }

  return (
    <div className="project-layout-container sidebar-right">
      <div 
        className={`pl-mobile-overlay ${isMobileOpen ? 'active' : ''}`}
        onClick={() => setIsMobileOpen(false)}
      />

      <Sidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        projectId={projectId}
        project={project}
        onSignOut={handleSignOut}
        user={user}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        time={time}
        formatDate={formatDateWithSeconds}
      />

      <div className="pl-main-wrapper">
        <Topbar 
          setIsMobileOpen={setIsMobileOpen}
          backInfo={backInfo}
        />
        
        <main ref={contentRef} className="pl-content-area custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
