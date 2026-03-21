import React from 'react';
import { Menu, Sun, Moon } from 'lucide-react';

export function Topbar({ 
  setIsMobileOpen, 
  project, 
  loading, 
  isDarkMode, 
  toggleTheme, 
  time, 
  formatDate 
}) {
  return (
    <header className="pl-topbar">
      <div className="pl-topbar-left">
        <button className="pl-mobile-toggle" onClick={() => setIsMobileOpen(true)}>
          <Menu size={24} />
        </button>
      </div>
      <div className="pl-topbar-actions">
        <div className="topbar-info-group">
           <span className="topbar-weather desktop-only" title="今日天氣：晴">
             <Sun size={16} color="var(--color-secondary)" />
             <span>26°C</span>
           </span>
           <span className="topbar-time desktop-only" id="topbar-live-time">
             {formatDate(time)}
           </span>
           <button className="btn-help-preheat" title="預留教學指引">?</button>
        </div>
        <button
          className="btn-theme-toggle"
          onClick={toggleTheme}
          title={isDarkMode ? '切換亮色模式' : '切換暗色模式'}
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}
