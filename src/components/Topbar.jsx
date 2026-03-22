import React from 'react';
import { Menu, ChevronLeft, LogOut } from 'lucide-react';

/**
 * backInfo: { label: string, onClick: () => void } | null
 * 有 backInfo 時，桌機版顯示返回列（32px），行動版顯示返回按鈕。
 * 漢堡鍵移至右側 (.pl-topbar-right)。
 * 若為 isGlobalDashboard，隱藏漢堡鍵並在左側顯示登出。
 */
export function Topbar({ setIsMobileOpen, backInfo, isGlobalDashboard, onSignOut }) {
  return (
    <header className={`pl-topbar ${backInfo ? 'has-back' : 'pl-topbar-mobile-only'}`}>
      <div className="pl-topbar-left">
        {/* 返回按鈕（行動版與桌機版 has-back 時可見） */}
        {backInfo && (
          <button className="pl-back-btn" onClick={backInfo.onClick}>
            <ChevronLeft size={16} />
            <span>{backInfo.label}</span>
          </button>
        )}
      </div>
      
      <div className="pl-topbar-right">
        {/* 行動版漢堡鍵（專案內頁才顯示） */}
        {!isGlobalDashboard && setIsMobileOpen && (
          <button className="pl-mobile-toggle" onClick={() => setIsMobileOpen(true)}>
            <Menu size={22} />
          </button>
        )}

        {/* 總覽頁行動版專用：右側登出鍵 */}
        {isGlobalDashboard && onSignOut && (
          <button className="pl-back-btn" onClick={onSignOut} style={{ color: 'var(--color-text-main)' }}>
            <LogOut size={16} />
            <span>登出</span>
          </button>
        )}
      </div>
    </header>
  );
}
