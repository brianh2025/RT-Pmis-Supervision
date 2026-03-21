import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useProject } from '../hooks/useProject';
import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import './ProjectLayout.css';

export function ProjectLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { project, loading } = useProject(projectId);
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
        projectId={projectId}
        onSignOut={handleSignOut}
      />

      <div className="pl-main-wrapper">
        <Topbar 
          setIsMobileOpen={setIsMobileOpen}
          project={project}
          loading={loading}
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
          time={time}
          formatDate={formatDateWithSeconds}
        />
        
        <main className="pl-content-area custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
