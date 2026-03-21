import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Building2, 
  ChevronLeft, 
  ChevronRight, 
  LogOut, 
  LayoutDashboard, 
  Archive, 
  FileCheck2, 
  ShieldCheck, 
  BookOpen,
  LayoutGrid
} from 'lucide-react';

const MENU_GROUPS_PROJECT = [
  {
    items: [
      { icon: LayoutDashboard, label: "專案儀表板", path: "dashboard" },
      { icon: BookOpen, label: "施工日誌", path: "diary" },
    ],
  },
  {
    items: [
      { icon: Archive, label: "歸檔管理", path: "archive" },
      { icon: FileCheck2, label: "送審管理", path: "submission" },
      { icon: ShieldCheck, label: "品管管理", path: "quality" },
    ],
  },
];

const MENU_GROUPS_GLOBAL = [
  {
    items: [
      { icon: LayoutDashboard, label: "總覽", path: "/dashboard" },
    ],
  },
];

export function Sidebar({ 
  isCollapsed, 
  setIsCollapsed, 
  isMobileOpen, 
  setIsMobileOpen, 
  projectId, 
  onSignOut 
}) {
  const location = useLocation();
  const menuGroups = projectId ? MENU_GROUPS_PROJECT : MENU_GROUPS_GLOBAL;

  return (
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
        {(projectId ? MENU_GROUPS_PROJECT : MENU_GROUPS_GLOBAL).map((group, idx) => (
          <div key={idx} className="pl-nav-group">
            <div className="pl-nav-items">
                {group.items.map((item, i) => {
                  const targetPath = projectId ? `/projects/${projectId}/${item.path}` : `/${item.path}`;
                  const isActive = location.pathname.startsWith(targetPath);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={i}
                      to={targetPath}
                      onClick={() => setIsMobileOpen(false)}
                      className={`pl-nav-link ${isActive ? 'active' : ''}`}
                      title={isCollapsed ? item.label : ''}
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

          {!projectId && !isCollapsed && (
            <div style={{ padding: '8px 16px', animation: 'slideUpFade 0.5s ease-out 0.2s both' }}>
              <div style={{
                background: 'linear-gradient(135deg, rgba(21,101,192,0.1) 0%, rgba(21,101,192,0.05) 100%)',
                border: '1px dashed var(--color-primary-light)',
                borderRadius: 12,
                padding: '12px',
              }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', margin: '0 0 4px' }}>💡 點擊教學</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                  在右側列表中點選任一工程卡片，即可進入該專案的詳細監造儀表板與日誌管理。
                </p>
              </div>
            </div>
          )}
        </div>

      {projectId && (
        <div className="pl-nav-back-area">
          <Link
            to="/dashboard"
            className="pl-nav-link pl-nav-back-link"
            title="返回專案總覽"
          >
            <LayoutGrid size={20} className="pl-nav-icon" />
            {!isCollapsed && <span className="pl-nav-label">專案總覽</span>}
            {isCollapsed && <div className="pl-nav-tooltip">專案總覽</div>}
          </Link>
        </div>
      )}

      <div className="pl-sidebar-footer">
        <div className="pl-user-info-brief">
          <div className="user-avatar-mini">admin</div>
          {!isCollapsed && <span className="user-email-mini">admin@xiaoxiong.page</span>}
        </div>
        <button className="pl-btn-logout" onClick={onSignOut} title="登出系統">
          <LogOut size={16} className="pl-nav-icon" />
          {!isCollapsed && <span>登出</span>}
        </button>
      </div>
    </aside>
  );
}
