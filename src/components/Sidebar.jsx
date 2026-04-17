import React, { useState } from 'react';
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
  Camera,
  BookOpen,
} from 'lucide-react';

const MENU_GROUPS_PROJECT = [
  {
    items: [
      { icon: Camera,        label: '照片記錄', path: 'photos'    },
      { icon: Activity,      label: '專案儀表板', path: 'dashboard' },
      { icon: BookOpen,      label: '日誌報表',   path: 'journal'   },
      { icon: TrendingUp,    label: '進度管理',   path: 'progress'  },
      { icon: ClipboardCheck, label: '材料管制',  path: 'material'  },
    ],
  },
  {
    items: [
      { icon: Archive,       label: '歸檔管理', path: 'archive'    },
      { icon: Send,          label: '送審管理', path: 'submission' },
      { icon: ShieldCheck,   label: '品管管理', path: 'quality'    },
      { icon: BarChart3,     label: '統計分析', path: 'analytics'  },
    ],
  },
];

export function Sidebar({
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
  projectId,
  project,
  onSignOut,
  user,
  isDarkMode,
  toggleTheme,
  time,
  formatDate
}) {
  const location = useLocation();
  const [showTutorial, setShowTutorial] = useState(false);

  const TUTORIAL_STEPS = [
    { step: '01', title: '新增工程', desc: '點擊總覽頁右上角「＋ 新增工程」，填入名稱、日期、預算後儲存。' },
    { step: '02', title: '進入工程', desc: '在工程卡片上點擊即可進入，右鍵可設為最愛或刪除。' },
    { step: '03', title: '填寫日誌', desc: '進入「日誌報表」，選取日期後點擊「新增施工日誌」或「PDF 匯入」。' },
    { step: '04', title: '管理進度', desc: '在「進度管理」新增進度紀錄，系統自動繪製 S 曲線圖。' },
    { step: '05', title: '同步資料', desc: '設定 Google Drive 資料夾 ID 後，可一鍵同步廠商上傳的 Excel 日誌。' },
  ];

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

      {/* ── 時間顯示（翻頁鐘） ── */}
      <div className={`pl-sidebar-time-row ${isCollapsed ? 'collapsed' : ''}`}>
        {!isCollapsed ? (
          <div className="pl-flip-clock">
            <div className="pl-flip-date">
              {time
                ? `${time.getMonth() + 1}月${time.getDate()}日`
                : '--月--日'}
            </div>
            <div className="pl-flip-segments">
              {(time
                ? [
                    String(time.getHours()).padStart(2, '0'),
                    String(time.getMinutes()).padStart(2, '0'),
                    String(time.getSeconds()).padStart(2, '0'),
                  ]
                : ['--', '--', '--']
              ).map((seg, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="pl-flip-colon">:</span>}
                  <div className="pl-flip-card">
                    <span className="pl-flip-top">{seg}</span>
                    <div className="pl-flip-fold" />
                    <span className="pl-flip-bot">{seg}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        ) : (
          <span className="pl-sidebar-time-icon" title={time ? formatDate(time) : ''}>🕐</span>
        )}
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
                      <Sun size={18} color="#FCD34D" />
                      <span>26°C</span>
                    </span>
                    <button
                      className="pl-tool-btn"
                      onClick={toggleTheme}
                      title={isDarkMode ? '切換亮色' : '切換暗色'}
                    >
                      {isDarkMode ? <Sun size={18} color="#FDE68A" /> : <Moon size={18} color="#A5B4FC" />}
                    </button>
                    <button className="pl-tool-btn" title="教學指引" onClick={() => setShowTutorial(true)}>
                      <HelpCircle size={18} color="#86EFAC" />
                    </button>
                  </div>
                )}
                {/* 折疊時圖示垂直排 */}
                {isCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 2 }}>
                    <button className="pl-tool-btn-icon" onClick={toggleTheme} title={isDarkMode ? '亮色' : '暗色'}>
                      {isDarkMode ? <Sun size={18} color="#FDE68A" /> : <Moon size={18} color="#A5B4FC" />}
                    </button>
                    <button className="pl-tool-btn-icon" title="教學指引" onClick={() => setShowTutorial(true)}>
                      <HelpCircle size={18} color="#86EFAC" />
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
      {/* ── 教學指引 Modal ── */}
      {showTutorial && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowTutorial(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--color-surface)', borderRadius: 14, padding: '24px 28px', maxWidth: 440, width: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '1px solid var(--color-surface-border)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <HelpCircle size={20} color="#86EFAC" />
                <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--color-text-main)' }}>快速上手指引</span>
              </div>
              <button onClick={() => setShowTutorial(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {TUTORIAL_STEPS.map(s => (
                <div key={s.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: 'rgba(134,239,172,0.18)', border: '1.5px solid #86EFAC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: '#059669' }}>{s.step}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--color-text-main)', marginBottom: 2 }}>{s.title}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowTutorial(false)}
              style={{ marginTop: 20, width: '100%', padding: '9px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #86EFAC, #34D399)', color: '#065F46', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
            >
              開始使用
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
