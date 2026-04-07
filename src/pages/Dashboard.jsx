import React, { useState, useEffect, useRef } from 'react';
import { useAutoHideScrollbar } from '../hooks/useAutoHideScrollbar';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useProjects } from '../hooks/useProjects';
import { supabase } from '../lib/supabaseClient';
import { AddProjectModal } from '../components/AddProjectModal';
import { ExcelImportModal } from '../components/ExcelImportModal';
import { ReportReminderBanner } from '../components/ReportReminderBanner';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import {
  Building2, PlusCircle, FileSpreadsheet, AlertCircle, CheckCircle2, Layers,
  Trash2, TriangleAlert, Loader2, Search, ChevronRight,
} from 'lucide-react';
import './Dashboard.css';
import '../components/ProjectLayout.css';
import '../components/Modal.css';

/* ── 跨工程待辦彙總區 ── */
function AlertsPanel({ alerts, navigate }) {
  const urgent  = alerts.filter(a => a.level === 'urgent');
  const warning = alerts.filter(a => a.level === 'warning');
  if (!urgent.length && !warning.length) return null;

  const Item = ({ a }) => (
    <button className="alert-item" data-level={a.level} onClick={() => navigate(`/projects/${a.projectId}/${a.path}`)}>
      <span className="alert-project-name">{a.projectName}</span>
      <span className="alert-msg">{a.msg}</span>
      <ChevronRight size={11} className="alert-arrow" />
    </button>
  );

  return (
    <div className="alerts-panel">
      {urgent.length > 0 && (
        <div className="alerts-group">
          <span className="alerts-group-label urgent">需立即處理（{urgent.length}）</span>
          <div className="alerts-list">{urgent.map((a, i) => <Item key={i} a={a} />)}</div>
        </div>
      )}
      {warning.length > 0 && (
        <div className="alerts-group">
          <span className="alerts-group-label warning">本週注意（{warning.length}）</span>
          <div className="alerts-list">{warning.map((a, i) => <Item key={i} a={a} />)}</div>
        </div>
      )}
    </div>
  );
}

/* ── 刪除專案確認 Modal ── */
function DeleteProjectModal({ project, onClose, onDeleted }) {
  const [step,       setStep]       = useState(1); // 1=警告 2=輸入確認
  const [inputName,  setInputName]  = useState('');
  const [deleting,   setDeleting]   = useState(false);
  const [error,      setError]      = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (step === 2) setTimeout(() => inputRef.current?.focus(), 80);
  }, [step]);

  async function handleDelete() {
    if (inputName.trim() !== project.name.trim()) {
      setError('輸入的名稱不符，請重新輸入。');
      return;
    }
    setDeleting(true);
    setError('');

    // 確保 session 有效
    const { data: { session }, error: sessErr } = await supabase.auth.getSession();
    if (sessErr || !session) {
      // 嘗試 refresh
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) {
        setDeleting(false);
        setError('登入狀態已過期，請重新整理頁面後再試。');
        return;
      }
    }

    const { error: err } = await supabase.from('projects').delete().eq('id', project.id);
    setDeleting(false);
    if (err) {
      // code 42501 = RLS 權限不足
      const hint = err.code === '42501' || err.message?.includes('policy')
        ? '（RLS 政策限制，請確認 Supabase 刪除權限）'
        : '';
      setError(`刪除失敗：${err.message} ${hint}`);
      return;
    }
    onDeleted();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel animate-slide-up" style={{ maxWidth: 440 }}>
        <div className="modal-header" style={{ borderBottom: '1px solid var(--color-surface-border)' }}>
          <div className="modal-title-group">
            <TriangleAlert size={16} style={{ color: 'var(--color-danger)' }} />
            <h3 className="modal-title" style={{ color: 'var(--color-danger)' }}>刪除專案</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {step === 1 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="del-modal-warning-box">
                <TriangleAlert size={20} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                <div>
                  <div className="del-modal-warning-title">此操作無法復原</div>
                  <div className="del-modal-warning-body">
                    刪除專案將同時移除所有相關資料，包含日誌、材料管制、照片記錄、歸檔文件等。
                  </div>
                </div>
              </div>
              <div className="del-modal-project-name">{project.name}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p className="del-modal-confirm-hint">
                請輸入專案名稱以確認刪除：
              </p>
              <div className="del-modal-name-badge">{project.name}</div>
              <input
                ref={inputRef}
                className="form-input"
                placeholder="請輸入上方名稱…"
                value={inputName}
                onChange={e => { setInputName(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && !deleting && handleDelete()}
              />
              {error && <div className="del-modal-error">{error}</div>}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-modal-cancel" onClick={onClose}>取消</button>
          {step === 1 ? (
            <button
              className="btn-modal-delete"
              onClick={() => setStep(2)}
            >
              我了解，繼續刪除
            </button>
          ) : (
            <button
              className="btn-modal-delete"
              onClick={handleDelete}
              disabled={deleting || inputName.trim() !== project.name.trim()}
            >
              {deleting
                ? <><Loader2 size={14} className="animate-spin" />刪除中…</>
                : <><Trash2 size={14} />確認刪除</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const STATUS_CONFIG = {
  active:    { label: '執行中', colorClass: 'status-active' },
  completed: { label: '已完工', colorClass: 'status-completed' },
  suspended: { label: '暫停中', colorClass: 'status-suspended' },
};

/** 圓形進度環元件 */
function CircularProgress({ value = 0, size = 48, strokeWidth = 5, color = 'var(--color-primary)' }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="var(--color-surface-border)" strokeWidth={strokeWidth} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.34,1.56,0.64,1)' }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        fontSize={size < 44 ? 8 : 10} fontWeight="700"
        fill="var(--color-text-main)">
        {value}%
      </text>
    </svg>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { projects, loading, refresh } = useProjects();
  
  const contentRef = useRef(null);
  useAutoHideScrollbar(contentRef);
  const [showAddModal,    setShowAddModal]    = useState(false);
  const [showExcelModal,  setShowExcelModal]  = useState(false);
  const [deleteTarget,    setDeleteTarget]    = useState(null); // project to delete
  const [statusFilter, setStatusFilter] = useState('all');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [time, setTime] = useState(new Date());
  const [showWelcome, setShowWelcome] = useState(true);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [alerts,       setAlerts]       = useState([]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    const welcomeTimer = setTimeout(() => setShowWelcome(false), 5000);
    return () => {
      clearInterval(timer);
      clearTimeout(welcomeTimer);
    };
  }, []);

  // 跨工程警示查詢（在專案列表載入完成後執行）
  useEffect(() => {
    if (loading || !projects.length) return;
    const active = projects.filter(p => p.status === 'active');

    async function fetchAlerts() {
      if (!active.length) { setAlerts([]); return; }
      const ids = active.map(p => p.id);
      const [qualRes, subRes] = await Promise.all([
        supabase.from('quality_issues').select('project_id').in('project_id', ids).in('status', ['open', 'in_progress']),
        supabase.from('submissions').select('project_id').in('project_id', ids).in('status', ['pending', 'submitted', 'reviewing']),
      ]);
      const qualMap = {}, subMap = {};
      (qualRes.data || []).forEach(r => { qualMap[r.project_id] = (qualMap[r.project_id] || 0) + 1; });
      (subRes.data  || []).forEach(r => { subMap[r.project_id]  = (subMap[r.project_id]  || 0) + 1; });

      const today = Date.now();
      const list = [];
      active.forEach(p => {
        const lp       = p.latest_progress;
        const diff     = lp ? (lp.actual_progress - lp.planned_progress) : null;
        const daysLeft = p.end_date ? Math.ceil((new Date(p.end_date).getTime() - today) / 86400000) : null;
        const qual     = qualMap[p.id] || 0;
        const sub      = subMap[p.id]  || 0;

        if (diff !== null && diff < -5)
          list.push({ level: 'urgent',  projectId: p.id, projectName: p.name, msg: `進度落後 ${Math.abs(diff).toFixed(1)}%`, path: 'progress' });
        if (qual > 0)
          list.push({ level: 'urgent',  projectId: p.id, projectName: p.name, msg: `品管缺失未結案 ${qual} 件`, path: 'quality' });
        if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 14)
          list.push({ level: 'urgent',  projectId: p.id, projectName: p.name, msg: `剩餘工期 ${daysLeft} 天`, path: 'progress' });
        else if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 30)
          list.push({ level: 'warning', projectId: p.id, projectName: p.name, msg: `剩餘工期 ${daysLeft} 天`, path: 'progress' });
        if (sub > 0)
          list.push({ level: 'warning', projectId: p.id, projectName: p.name, msg: `送審待處理 ${sub} 件`, path: 'submission' });
      });
      setAlerts(list);
    }
    fetchAlerts();
  }, [projects, loading]);

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

  const handleDataAdded = () => refresh?.();

  const isBehind = (p) => {
    const lp = p.latest_progress;
    return p.status === 'active' && lp && (lp.actual_progress - lp.planned_progress) < -5;
  };
  const activeCount    = projects.filter(p => p.status === 'active').length;
  const behindCount    = projects.filter(isBehind).length;
  const completedCount = projects.filter(p => p.status === 'completed').length;
  const suspendedCount = projects.filter(p => p.status === 'suspended').length;

  const FILTERS = [
    { key: 'all',       label: '全部',   count: projects.length,  icon: Layers,       color: 'var(--color-text2)' },
    { key: 'active',    label: '執行中', count: activeCount,      icon: Building2,    color: 'var(--color-primary-light)' },
    { key: 'behind',    label: '落後',   count: behindCount,      icon: AlertCircle,  color: 'var(--color-danger)' },
    { key: 'completed', label: '已完工', count: completedCount,   icon: CheckCircle2, color: 'var(--color-success)' },
    ...(suspendedCount > 0 ? [{ key: 'suspended', label: '暫停中', count: suspendedCount, icon: AlertCircle, color: 'var(--color-warning)' }] : []),
  ];

  const filteredProjects = projects.filter(p => {
    if (statusFilter === 'behind' && !isBehind(p)) return false;
    if (statusFilter !== 'all' && statusFilter !== 'behind' && p.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (p.name || '').toLowerCase().includes(q) || (p.contractor || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="project-layout-container">
      <div 
        className={`pl-mobile-overlay ${isMobileOpen ? 'active' : ''}`}
        onClick={() => setIsMobileOpen(false)}
      />

      {/* Sidebar 整合所有工具（傳入 isDarkMode、toggleTheme、time、formatDate） */}
      <Sidebar 
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        projectId={null}
        onSignOut={handleSignOut}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        time={time}
        formatDate={formatDateWithSeconds}
      />

      <div className="pl-main-wrapper">
        {/* Topbar 僅行動版顯示（總覽模式：顯示登出、隱藏漢堡鍵） */}
        <Topbar isGlobalDashboard={true} onSignOut={handleSignOut} />

        <main ref={contentRef} className="pl-content-area custom-scrollbar dashboard-page">
          <div className="dash-main">
              {/* 標題列：垂直色條 + 標題 + 按鈕同一列 */}
              <div className="dash-page-header">
                <div className="dash-title-block">
                  <span className="dash-title-accent" />
                  <div>
                    <h1 className="dash-title">雲林縣工程監造</h1>
                    {showWelcome && (
                      <span className="welcome-msg-inline animate-fade-out">
                        歡迎進行監造作業。
                      </span>
                    )}
                  </div>
                </div>
                <div className="dash-table-actions">
                  <button className="btn-dash-action" onClick={() => setShowAddModal(true)}>
                    <PlusCircle size={13} />
                    <span>新增工程</span>
                  </button>
                  <button className="btn-dash-action btn-dash-excel" onClick={() => setShowExcelModal(true)}>
                    <FileSpreadsheet size={13} />
                    <span>Excel 匯入</span>
                  </button>
                </div>
              </div>

            {/* 跨工程待辦彙總 */}
            <AlertsPanel alerts={alerts} navigate={navigate} />

            {/* Banner */}
            {projects.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <ReportReminderBanner projectId={projects[0]?.id} />
              </div>
            )}

            {/* 搜尋欄（獨立一列，最上方） */}
            <div className="dash-search-row">
              <Search size={12} className="dash-search-icon" />
              <input
                className="dash-search-input"
                placeholder="搜尋工程名稱或承包商…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* 工程列表標題 + 篩選標籤 + 計數（同一列） */}
            <div className="dash-list-header">
              <div className="dash-list-title">
                <span className="dash-list-title-bar" />
                <span className="dash-list-title-text">工程列表</span>
              </div>
              <div className="dash-tab-bar">
                {loading ? (
                  <span className="dash-filter-loading">載入中…</span>
                ) : FILTERS.map(f => {
                  const active = statusFilter === f.key;
                  return (
                    <button
                      key={f.key}
                      className={`dash-tab${active ? ' active' : ''}${f.key === 'behind' && f.count > 0 ? ' has-alert' : ''}`}
                      style={{ '--tab-color': f.color }}
                      onClick={() => setStatusFilter(f.key)}
                    >
                      {f.label}
                      <span className="tab-count">{f.count}</span>
                    </button>
                  );
                })}
              </div>
              <span className="dash-section-count">
                {statusFilter !== 'all' && `${filteredProjects.length} / ${projects.length}`}
              </span>
            </div>

            <div className="dash-project-grid">
              {filteredProjects.length === 0 && (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.82rem', background: 'var(--color-surface)', borderRadius: '10px', border: '1px solid var(--color-surface-border)' }}>
                  此分類目前無工程
                </div>
              )}
              {filteredProjects.map((p, index) => {
                const lp = p.latest_progress;
                const prog = lp ? lp.actual_progress : 0;
                const planned = lp ? lp.planned_progress : 0;
                const diff = prog - planned;
                return (
                  <div
                    key={p.id}
                    className="dash-project-card dash-project-card-compact"
                    onClick={() => navigate(`/projects/${p.id}/dashboard`)}
                    style={{ animationDelay: `${0.3 + index * 0.04}s` }}
                  >
                    {/* 左側色條：落後→紅、執行中→藍、暫停→黃、竣工→灰 */}
                    <div className="card-accent-side" style={{
                      background: isBehind(p)              ? 'var(--color-danger)' :
                                  p.status === 'active'    ? 'var(--color-primary)' :
                                  p.status === 'suspended' ? 'var(--color-warning)' : 'var(--color-text-muted)'
                    }} />

                    {/* 右側內容 */}
                    <div className="card-compact-body">
                      {/* 上排：工程名稱（左）＋ 實際進度大字（右） */}
                      <div className="card-compact-top">
                        <div className="card-title-compact">{p.name}</div>
                        <div className="card-pct-block">
                          <span className="card-pct-num" style={{
                            color: isBehind(p) ? 'var(--color-danger)' :
                                   p.status === 'completed' ? 'var(--color-text-muted)' : 'var(--color-primary-light)'
                          }}>{prog}%</span>
                          <span className={`diff-badge ${diff >= 0 ? 'diff-positive' : 'diff-negative'}`}>
                            {diff >= 0 ? '+' : ''}{diff}%
                          </span>
                        </div>
                      </div>

                      {/* 進度條 */}
                      <div className="layered-progress-bar" style={{ height: '4px' }}>
                        <div className="bar-planned" style={{ width: `${planned}%` }} />
                        <div className="bar-actual" style={{ width: `${prog}%` }} />
                      </div>

                      {/* 下排：計畫%（左）＋ 承包廠商（右）＋ 刪除鈕 */}
                      <div className="card-bottom-row">
                        <span className="card-planned-label">計畫 {planned}%</span>
                        <span className="card-contractor-compact">{p.contractor || '未指定單位'}</span>
                        <button
                          className="card-delete-btn"
                          title="刪除專案"
                          onClick={e => { e.stopPropagation(); setDeleteTarget(p); }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {showAddModal && <AddProjectModal onClose={() => setShowAddModal(false)} onSuccess={handleDataAdded} />}
          {showExcelModal && <ExcelImportModal onClose={() => setShowExcelModal(false)} onSuccess={handleDataAdded} />}
          {deleteTarget && (
            <DeleteProjectModal
              project={deleteTarget}
              onClose={() => setDeleteTarget(null)}
              onDeleted={() => { setDeleteTarget(null); refresh?.(); }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
