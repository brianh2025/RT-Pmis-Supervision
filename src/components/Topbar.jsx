import React from 'react';
import { Menu, ChevronLeft, LogOut, FileSpreadsheet, HelpCircle, Sun, Moon } from 'lucide-react';

/**
 * backInfo: { label: string, onClick: () => void } | null
 * 有 backInfo 時，桌機版顯示返回列（32px），行動版顯示返回按鈕。
 * 漢堡鍵移至右側 (.pl-topbar-right)。
 * 有傳 setIsMobileOpen 即顯示漢堡鍵（行動版 Sidebar 開啟途徑；總覽頁改由頁內標題列漢堡鍵開啟）。
 * title：總覽頁行動版於頂列顯示的頁面標題；isDarkMode/toggleTheme：頂列右端明暗切換鈕。
 */
export function Topbar({ setIsMobileOpen, backInfo, isGlobalDashboard, onSignOut, onShowExcel, onHelp, pageLabel, title, isDarkMode, toggleTheme }) {
  return (
    <header className={`pl-topbar ${backInfo ? 'has-back' : 'pl-topbar-mobile-only'}`}>
      <div className="pl-topbar-left">
        {/* 行動版漢堡鍵（與返回按鈕並排於左側） */}
        {setIsMobileOpen && (
          <button className="pl-mobile-toggle" onClick={() => setIsMobileOpen(true)}>
            <Menu size={22} />
          </button>
        )}
        {/* 返回按鈕 */}
        {backInfo && (
          <button className="pl-back-btn" onClick={backInfo.onClick}>
            <ChevronLeft size={18} />
          </button>
        )}
        {/* 頁面標題（總覽頁行動版） */}
        {title && (
          <div className="pl-topbar-title">
            <span className="pl-topbar-title-accent" />
            <span className="pl-topbar-title-text">{title}</span>
          </div>
        )}
      </div>

      {pageLabel && (
        <div className="pl-topbar-center">
          <span className="pl-topbar-page-label">{pageLabel}</span>
        </div>
      )}

      <div className="pl-topbar-right">
        {toggleTheme && (
          <button className="pl-topbar-theme-btn" onClick={toggleTheme} title={isDarkMode ? '切換亮色' : '切換暗色'}>
            {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        )}
        {onHelp && (
          <button className="pl-topbar-help-btn" onClick={onHelp} title="使用說明">
            <HelpCircle size={14} />
            <span>說明</span>
          </button>
        )}
        {/* 總覽頁行動版專用：Excel匯入（次要）+ 登出（危險） */}
        {isGlobalDashboard && onShowExcel && (
          <button className="pl-topbar-excel-btn" onClick={onShowExcel}>
            <FileSpreadsheet size={15} />
            <span>匯入</span>
          </button>
        )}
        {isGlobalDashboard && onSignOut && (
          <button className="pl-topbar-logout-btn" onClick={onSignOut}>
            <LogOut size={15} />
            <span>登出</span>
          </button>
        )}
      </div>
    </header>
  );
}
