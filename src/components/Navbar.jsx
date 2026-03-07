import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HardHat, CloudCog, Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import './Navbar.css';

export function Navbar() {
  const [time, setTime] = useState(new Date());
  const { isDarkMode, toggleTheme } = useTheme();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).format(date);
  };

  return (
    <nav className="navbar navbar-glass">
      <div className="navbar-container">
        {/* Logo Section */}
        <Link to="/" className="navbar-logo hover-glow interactive-scale">
          <div className="logo-icon-wrapper">
             <CloudCog className="logo-icon primary" size={28} />
             <HardHat className="logo-icon secondary absolute-centered" size={14} />
          </div>
          <span className="logo-text">
            <span>PMIS</span>
            <span className="logo-subtitle text-gradient">公共工程雲端監造</span>
          </span>
        </Link>
        
        {/* System Status / Toggles */}
        <div className="navbar-actions-group">
          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme} 
            className="theme-toggle-btn hover-float"
            title={isDarkMode ? "切換至高對比亮色模式 (Light Mode)" : "切換至深色模式 (Dark Mode)"}
          >
            {isDarkMode ? <Sun size={20} className="theme-icon sun-icon" /> : <Moon size={20} className="theme-icon moon-icon" />}
          </button>
          
          {/* System Time / Status */}
          <div className="navbar-status">
            <div className="status-indicator">
              <span className="status-pulse"></span>
              <span className="status-dot"></span>
            </div>
            <div className="status-text-block desktop-only">
               <span className="status-text-en">YUNLIN REGION</span>
               <span className="status-text-zh">雲林轄區</span>
            </div>
            <span className="status-divider desktop-only"></span>
            <span className="status-time">{formatDate(time)}</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
