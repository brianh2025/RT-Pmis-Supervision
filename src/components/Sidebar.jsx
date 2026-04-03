import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Activity,
  Archive,
  Send,
  ShieldCheck,
  ClipboardList,
  ClipboardCheck,
  LayoutDashboard,
  Sun,
  Moon,
  HelpCircle,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

const MENU_GROUPS_PROJECT = [
  {
    items: [
      { icon: Activity, label: "專案儀表板", path: "dashboard" },
      { icon: ClipboardList, label: "監造報表", path: "supervision" },
      { icon: ClipboardList, label: "施工日誌", path: "diary" },
      { icon: TrendingUp, label: "進度管理", path: "progress" },
      { icon: ClipboardCheck, label: "材料管制", path: "material" },
    ],
  },
  {
    items: [
      { icon: Archive, label: "歸檔管理", path: "archive" },
      { icon: Send, label: "送審管理", path: "submission" },
      { icon: ShieldCheck, label: "品管管理", path: "quality" },
      { icon: BarChart3, label: "統計分析", path: "analytics" },
    ],
  },
];

export function Sidebar({
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
  projectId,
  onSignOut,
  user,
  isDarkMode,
  toggleTheme,
  time,
  formatDate
}) {
  const location = useLocation();

  return (
    <aside className={`pl-sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>

      {/* ── Logo Header ── */}
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

      {/* ── Nav Scroll ── */}
      <div className="pl-nav-scroll custom-scrollbar">

        {/* 全域模式：總覽 + 天氣/深淺/? 同一列 */}
        {!projectId && (
          <div className="pl-nav-group">
            <div className="pl-nav-items">
              <div className="pl-nav-row-with-tools">
                <Link
                  to="/dashboard"
                  onClick={() => setIsMobileOpen(false)}
                  className={`pl-nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}
                  title={isCollapsed ? '總覽' : ''}
                  style={{ flex: 1, marginBottom: 0 }}
                >
                  <LayoutDashboard size={18} className="pl-nav-icon" />
                  {!isCollapsed && <span className="pl-nav-label">總覽</span>}
                  {isCollapsed && <div className="pl-nav-tooltip">總覽</div>}
                </Link>

                {/* 天氣 / 深淺 / ? — 與總覽同列 */}
                {!isCollapsed && (
                  <div className="pl-nav-row-tools">
                    <span className="pl-tool-weather" title="今日天氣：晴">
                      <Sun size={12} color="var(--color-secondary, #f59e0b)" />
                      <span>26°C</span>
                    </span>
                    <button
                      className="pl-tool-btn"
                      onClick={toggleTheme}
                      title={isDarkMode ? '切換亮色' : '切換暗色'}
                    >
                      {isDarkMode ? <Sun size={12} /> : <Moon size={12} />}
                    </button>
                    <button className="pl-tool-btn" title="教學指引">
                      <HelpCircle size={12} />
                    </button>
                  </div>
                )}
                {/* 折疊時圖示垂直排 */}
                {isCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 2 }}>
                    <button className="pl-tool-btn-icon" onClick={toggleTheme} title={isDarkMode ? '亮色' : '暗色'}>
                      {isDarkMode ? <Sun size={13} /> : <Moon size={13} />}
                    </button>
                    <button className="pl-tool-btn-icon" title="教學指引">
                      <HelpCircle size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 專案模式：nav groups + 主題切換 */}
        {projectId && (
          <>
            {MENU_GROUPS_PROJECT.map((group, idx) => (
              <div key={idx} className="pl-nav-group">
                <div className="pl-nav-items">
                  {group.items.map((item, i) => {
                    const targetPath = `/projects/${projectId}/${item.path}`;
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
                        <Icon size={18} className="pl-nav-icon" />
                        {!isCollapsed && <span className="pl-nav-label">{item.label}</span>}
                        {isCollapsed && <div className="pl-nav-tooltip">{item.label}</div>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            {/* 主題切換（專案模式） */}
            <div className="pl-nav-group">
              <div className="pl-nav-items">
                {!isCollapsed ? (
                  <div className="pl-nav-row-tools" style={{ padding: '4px 6px' }}>
                    <button
                      className="pl-tool-btn"
                      onClick={toggleTheme}
                      title={isDarkMode ? '切換亮色' : '切換暗色'}
                    >
                      {isDarkMode ? <Sun size={12} /> : <Moon size={12} />}
                    </button>
                    <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                      {isDarkMode ? '暗色模式' : '亮色模式'}
                    </span>
                  </div>
                ) : (
                  <button className="pl-tool-btn-icon" onClick={toggleTheme} title={isDarkMode ? '亮色' : '暗色'}
                    style={{ margin: '0 auto' }}>
                    {isDarkMode ? <Sun size={13} /> : <Moon size={13} />}
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* 說明方塊（全域、展開時） */}
        {!projectId && !isCollapsed && (
          <div style={{ padding: '6px 6px 0', animation: 'slideUpFade 0.5s ease-out 0.2s both' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(21,101,192,0.08) 0%, rgba(21,101,192,0.04) 100%)',
              border: '1px dashed var(--color-primary-light)',
              borderRadius: 8,
              padding: '7px 10px',
            }}>
              <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-primary)', margin: '0 0 2px' }}>💡 點擊教學</p>
              <p style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                點選右側工程卡片，進入詳細監造儀表板。
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── 時間顯示（登入按鈕正上方） ── */}
      <div className={`pl-sidebar-time-row ${isCollapsed ? 'collapsed' : ''}`}>
        {!isCollapsed ? (
          <span className="pl-sidebar-time-text">
            {time ? formatDate(time) : '--:--:--'}
          </span>
        ) : (
          <span className="pl-sidebar-time-icon" title={time ? formatDate(time) : ''}>🕐</span>
        )}
      </div>

      {/* ── Footer：頭像 + 登出 ── */}
      <div className="pl-sidebar-footer">
        <div className="pl-user-info-brief">
          <div className="user-avatar-mini">{user?.email?.[0]?.toUpperCase() ?? '?'}</div>
          {!isCollapsed && <span className="user-email-mini">{user?.email ?? '未登入'}</span>}
        </div>
        <button className="pl-btn-logout" onClick={onSignOut} title="登出系統">
          <LogOut size={16} className="pl-nav-icon" />
          {!isCollapsed && <span>登出</span>}
        </button>
      </div>
    </aside>
  );
}
