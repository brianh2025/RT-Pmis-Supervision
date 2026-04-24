import React from 'react';
import { Menu, ChevronLeft, LogOut, FileSpreadsheet, HelpCircle } from 'lucide-react';

/**
 * backInfo: { label: string, onClick: () => void } | null
 * 有 backInfo 時，桌機版顯示返回列（32px），行動版顯示返回按鈕。
 * 漢堡鍵移至右側 (.pl-topbar-right)。
 * 若為 isGlobalDashboard，隱藏漢堡鍵並在右側顯示 Excel匯入 + 登出。
 */
export function Topbar({ setIsMobileOpen, backInfo, isGlobalDashboard, onSignOut, onShowExcel, onHelp, pageLabel }) {
  return (
    <header className={`pl-topbar ${backInfo ? 'has-back' : 'pl-topbar-mobile-only'}`}>
      <div className="pl-topbar-left">
        {/* 行動版漢堡鍵（專案內頁才顯示，與返回按鈕並排於左側） */}
        {!isGlobalDashboard && setIsMobileOpen && (
          <button className="pl-mobile-toggle" onClick={() => setIsMobileOpen(true)}>
            <Menu size={22} />
          </button>
        )}
        {/* 返回按鈕 */}
        {backInfo && (
          <button className="pl-back-btn" onClick={backInfo.onClick}>
            <ChevronLeft size={18} />
            <span>{backInfo.label}</span>
          </button>
        )}
      </div>

      <div className="pl-topbar-right">
        {pageLabel && (
          <span style={{ fontSize: '13px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}>
            {pageLabel}
          </span>
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
