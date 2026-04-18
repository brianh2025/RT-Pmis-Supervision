import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useAutoHideScrollbar } from '../hooks/useAutoHideScrollbar';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useProjects } from '../hooks/useProjects';
import { supabase } from '../lib/supabaseClient';
import { AddProjectModal } from '../components/AddProjectModal';
import { EditProjectModal } from '../components/EditProjectModal';
import { ExcelImportModal } from '../components/ExcelImportModal';
import { ReportReminderBanner } from '../components/ReportReminderBanner';
import { CardContextMenu } from '../components/CardContextMenu';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import {
  Building2, PlusCircle, FileSpreadsheet, AlertCircle, CheckCircle2, Layers,
  TriangleAlert, Loader2, Search, ChevronRight, Pencil, Download, Trash2,
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
  pending:   { label: '未發包', colorClass: 'status-pending' },
  active:    { label: '執行中', colorClass: 'status-active' },
  completed: { label: '已完工', colorClass: 'status-completed' },
  accepted:  { label: '已竣工', colorClass: 'status-accepted' },
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
  const { signOut, user } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { projects, loading, refresh } = useProjects();
  
  const contentRef = useRef(null);
  useAutoHideScrollbar(contentRef);
  const [showAddModal,    setShowAddModal]    = useState(false);
  const [showExcelModal,  setShowExcelModal]  = useState(false);
  const [deleteTarget,    setDeleteTarget]    = useState(null);
  const [editTarget,      setEditTarget]      = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [time, setTime] = useState(new Date());
  const [showWelcome, setShowWelcome] = useState(true);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [alerts,       setAlerts]       = useState([]);
  const [contextMenu,  setContextMenu]  = useState(null); // { x, y, project }
  const [matWarnMap,   setMatWarnMap]   = useState({});    // projectId -> 未登錄檢驗筆數
  const [cardOrder,    setCardOrder]    = useState(() => {
    try { return JSON.parse(localStorage.getItem(`pmis_card_order_${user?.id}`) || 'null') || null; } catch { return null; }
  });
  const [dragOverId, setDragOverId] = useState(null);
  const dragSrcId = useRef(null);

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
    // 施工中（active / suspended）皆需檢查材料進場與檢驗
    const active = projects.filter(p => p.status === 'active' || p.status === 'suspended');
    // 材料管制檢查範圍：所有未完工專案（含 pending/active/suspended）
    const matTargets = projects.filter(p => !['completed', 'accepted'].includes(p.status));

    async function fetchAlerts() {
      const alertIds = active.map(p => p.id);
      const matIds   = matTargets.map(p => p.id);
      if (!alertIds.length && !matIds.length) { setAlerts([]); setMatWarnMap({}); return; }

      const [qualRes, subRes, entryRes, testRes] = await Promise.all([
        alertIds.length
          ? supabase.from('quality_issues').select('project_id').in('project_id', alertIds).in('status', ['open', 'in_progress'])
          : Promise.resolve({ data: [] }),
        alertIds.length
          ? supabase.from('submissions').select('project_id').in('project_id', alertIds).in('status', ['pending', 'submitted', 'reviewing'])
          : Promise.resolve({ data: [] }),
        matIds.length
          ? supabase.from('material_entries').select('project_id, name, entry_date').in('project_id', matIds)
          : Promise.resolve({ data: [] }),
        matIds.length
          ? supabase.from('mcs_test').select('project_id, name, s_date, a_date').in('project_id', matIds)
          : Promise.resolve({ data: [] }),
      ]);
      const qualMap = {}, subMap = {};
      (qualRes.data || []).forEach(r => { qualMap[r.project_id] = (qualMap[r.project_id] || 0) + 1; });
      (subRes.data  || []).forEach(r => { subMap[r.project_id]  = (subMap[r.project_id]  || 0) + 1; });

      // 材料進場未登錄檢驗：
      // material_entries 有資料，但 mcs_test 中無對應材料已填「實際進場(a_date) 或 抽樣日(s_date)」
      const matMap = {};
      const entriesByPrj = {};
      const loggedByPrj  = {};
      (entryRes.data || []).forEach(e => { if (e.name) (entriesByPrj[e.project_id] ||= []).push(e); });
      (testRes.data  || []).forEach(t => {
        if (t.name && (t.a_date || t.s_date)) (loggedByPrj[t.project_id] ||= []).push(t);
      });
      matIds.forEach(pid => {
        const entries = entriesByPrj[pid] || [];
        const logged  = loggedByPrj[pid] || [];
        const cnt = entries.filter(e => {
          const en = (e.name || '').trim();
          if (!en) return false;
          return !logged.some(t => {
            const tn = (t.name || '').trim();
            if (!tn) return false;
            return tn.includes(en) || en.includes(tn);
          });
        }).length;
        if (cnt > 0) matMap[pid] = cnt;
      });
      setMatWarnMap(matMap);

      const today = Date.now();
      const list = [];
      // 所有檢查範圍內的專案都列入警示（material 警示適用於非完工專案）
      [...new Set([...active, ...matTargets])].forEach(p => {
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
        const matCnt = matMap[p.id] || 0;
        if (matCnt > 0)
          list.push({ level: 'warning', projectId: p.id, projectName: p.name, msg: `材料進場未登錄檢驗 ${matCnt} 項`, path: 'material' });
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

  /* ── 匯出案件清單 ── */
  const handleExport = () => {
    const rows = projects.map(p => ({
      工程名稱: p.name || '',
      施工地點: p.location || '',
      承包商:   p.contractor || '',
      狀態:     ({ active:'執行中', completed:'已完工', accepted:'已竣工', suspended:'暫停', pending:'未發包' }[p.status] || p.status),
      開工日期: p.start_date || '',
      預計完工: p.end_date || '',
      預算元:   p.budget ?? '',
      計畫進度: p.latest_progress?.planned_progress ?? '',
      實際進度: p.latest_progress?.actual_progress  ?? '',
      備註:     p.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '工程清單');
    XLSX.writeFile(wb, `PMIS工程清單_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  /* ── 拖曳排序 ── */
  const handleDragStart = useCallback((e, id) => {
    dragSrcId.current = id;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(id);
  }, []);

  const handleDrop = useCallback((e, targetId) => {
    e.preventDefault();
    const srcId = dragSrcId.current;
    if (!srcId || srcId === targetId) { setDragOverId(null); return; }
    setCardOrder(prev => {
      const base = prev || projects.map(p => p.id);
      const from = base.indexOf(srcId);
      const to   = base.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      const next = [...base];
      next.splice(from, 1);
      next.splice(to, 0, srcId);
      localStorage.setItem(`pmis_card_order_${user?.id}`, JSON.stringify(next));
      return next;
    });
    setDragOverId(null);
    dragSrcId.current = null;
  }, [projects, user]);

  const handleDragEnd = useCallback(() => { setDragOverId(null); dragSrcId.current = null; }, []);

  /* ── 右鍵選單 ── */
  const openContextMenu = useCallback((e, project) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, project });
  }, []);

  const isBehind = (p) => {
    const lp = p.latest_progress;
    return p.status === 'active' && lp && (lp.actual_progress - lp.planned_progress) < -5;
  };

  // 切換收藏（樂觀更新）
  const toggleStar = async (e, p) => {
    e.stopPropagation();
    const next = !p.is_starred;
    await supabase.from('projects').update({ is_starred: next }).eq('id', p.id);
    refresh?.();
  };

  const starredCount   = projects.filter(p => p.is_starred).length;
  const pendingCount   = projects.filter(p => p.status === 'pending').length;
  const activeCount    = projects.filter(p => p.status === 'active').length;
  const behindCount    = projects.filter(isBehind).length;
  const completedCount = projects.filter(p => p.status === 'completed').length;
  const acceptedCount  = projects.filter(p => p.status === 'accepted').length;
  const suspendedCount = projects.filter(p => p.status === 'suspended').length;

  const FILTERS = [
    { key: 'all',       label: '全部',   count: projects.length,  color: 'var(--color-text2)' },
    ...(starredCount > 0 ? [{ key: 'starred', label: '我的最愛', count: starredCount, color: '#f59e0b' }] : []),
    ...(pendingCount > 0  ? [{ key: 'pending',  label: '未發包',  count: pendingCount,  color: '#94a3b8' }] : []),
    { key: 'active',    label: '執行中', count: activeCount,      color: 'var(--color-primary-light)' },
    { key: 'behind',    label: '落後',   count: behindCount,      color: 'var(--color-danger)' },
    { key: 'completed', label: '已完工', count: completedCount,   color: 'var(--color-success)' },
    ...(acceptedCount > 0  ? [{ key: 'accepted',  label: '已竣工',  count: acceptedCount,  color: '#10b981' }] : []),
    ...(suspendedCount > 0 ? [{ key: 'suspended', label: '暫停中', count: suspendedCount, color: 'var(--color-warning)' }] : []),
  ];

  // 套用自訂順序或預設依開工日期排序
  const orderedProjects = React.useMemo(() => {
    const base = cardOrder
      ? [...projects].sort((a, b) => {
          const ia = cardOrder.indexOf(a.id), ib = cardOrder.indexOf(b.id);
          if (ia === -1 && ib === -1) return (a.start_date || '').localeCompare(b.start_date || '');
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
        })
      : [...projects].sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
    return base;
  }, [projects, cardOrder]);

  const filteredProjects = orderedProjects
    .filter(p => {
      if (statusFilter === 'starred')  return p.is_starred;
      if (statusFilter === 'behind' && !isBehind(p)) return false;
      if (statusFilter !== 'all' && statusFilter !== 'behind' && p.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (p.name || '').toLowerCase().includes(q) || (p.contractor || '').toLowerCase().includes(q);
      }
      return true;
    });

  const starredProjects  = filteredProjects.filter(p => p.is_starred);
  const regularProjects  = filteredProjects.filter(p => !p.is_starred);

  /* ── 卡片渲染函式 ── */
  const renderCard = (p, index) => {
    const lp = p.latest_progress;
    const prog    = lp ? lp.actual_progress  : 0;
    const planned = lp ? lp.planned_progress : 0;
    const diff = parseFloat((prog - planned).toFixed(2));
    const matWarn = matWarnMap[p.id] || 0;
    return (
      <div
        key={p.id}
        draggable
        className={`dash-project-card dash-project-card-compact${isBehind(p) ? ' status-behind' : p.status === 'suspended' ? ' status-suspended' : p.status === 'completed' ? ' status-completed' : p.status === 'accepted' ? ' status-accepted' : p.status === 'pending' ? ' status-pending' : ''}${dragOverId === p.id ? ' drag-over' : ''}`}
        onClick={() => navigate(`/projects/${p.id}/dashboard`)}
        onContextMenu={e => openContextMenu(e, p)}
        onDragStart={e => handleDragStart(e, p.id)}
        onDragOver={e => handleDragOver(e, p.id)}
        onDrop={e => handleDrop(e, p.id)}
        onDragEnd={handleDragEnd}
        style={{ animationDelay: `${0.3 + index * 0.04}s` }}
      >
        <div className="card-accent-side" style={{
          background: isBehind(p)
            ? 'linear-gradient(to bottom, #dc2626, #f87171)'
            : p.status === 'active'
            ? 'linear-gradient(to bottom, #1565C0, #42a5f5)'
            : p.status === 'suspended'
            ? 'linear-gradient(to bottom, #d97706, #fbbf24)'
            : p.status === 'accepted'
            ? 'linear-gradient(to bottom, #059669, #34d399)'
            : p.status === 'pending'
            ? 'linear-gradient(to bottom, #64748b, #94a3b8)'
            : 'linear-gradient(to bottom, #94a3b8, #cbd5e1)'
        }} />
        <div className="card-compact-body">
          <div className="card-compact-top">
            <div className="card-title-compact">{p.name}</div>
            <div className="card-pct-block">
              <span className="card-pct-num" style={{
                color: isBehind(p) ? 'var(--color-danger)' :
                       (p.status === 'completed' || p.status === 'accepted' || p.status === 'pending') ? 'var(--color-text-muted)' : 'var(--color-primary-light)'
              }}>{prog}%</span>
              <span className={`diff-badge ${diff >= 0 ? 'diff-positive' : 'diff-negative'}`}>
                {diff >= 0 ? '+' : ''}{diff}%
              </span>
            </div>
          </div>
          <div className="layered-progress-bar" style={{ height: '4px' }}>
            <div className="bar-planned" style={{ width: `${planned}%` }} />
            <div className="bar-actual" style={{
              width: `${prog}%`,
              background: isBehind(p) ? 'var(--color-danger)' :
                          (p.status === 'completed' || p.status === 'accepted' || p.status === 'pending') ? 'var(--color-text-muted)' : undefined
            }} />
          </div>
          <div className="card-bottom-row">
            <span className={`card-status-chip ${isBehind(p) ? 'chip-behind' : p.status === 'completed' ? 'chip-done' : p.status === 'accepted' ? 'chip-accepted' : p.status === 'pending' ? 'chip-pending' : p.status === 'suspended' ? 'chip-paused' : 'chip-active'}`}>
              {isBehind(p) ? '落後' : p.status === 'completed' ? '完工' : p.status === 'accepted' ? '竣工' : p.status === 'pending' ? '未發包' : p.status === 'suspended' ? '暫停' : '執行中'}
            </span>
            <span className="card-contractor-compact">{p.contractor || '未指定單位'}</span>
            {matWarn > 0 && (
              <span
                className="card-mat-warn"
                title={`材料進場未登錄檢驗 ${matWarn} 項`}
                onClick={e => { e.stopPropagation(); navigate(`/projects/${p.id}/material`); }}
              >
                <TriangleAlert size={10} />
                材料未驗 {matWarn}
              </span>
            )}
            <button
              className="card-edit-btn"
              title="編輯工程資料"
              onClick={e => { e.stopPropagation(); setEditTarget(p); }}
            >
              <Pencil size={12} />
            </button>
          </div>
        </div>
      </div>
    );
  };

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
        <Topbar isGlobalDashboard={true} onSignOut={handleSignOut} onShowExcel={() => setShowExcelModal(true)} />

        <main ref={contentRef} className="pl-content-area custom-scrollbar dashboard-page">
          <div className="dash-main">
              {/* 標題列：左（標題）/ 中（搜尋）/ 右（按鈕） */}
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

                {/* 搜尋列（header 中央） */}
                <div className="dash-search-row">
                  <Search size={12} className="dash-search-icon" />
                  <input
                    className="dash-search-input"
                    placeholder="搜尋工程名稱或承包商…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
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
                  <button className="btn-dash-action btn-dash-export" onClick={handleExport}>
                    <Download size={13} />
                    <span>匯出清單</span>
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

            {/* 我的最愛置頂區（有收藏才顯示） */}
            {starredProjects.length > 0 && statusFilter !== 'starred' && (
              <div className="dash-section-starred">
                <div className="dash-section-label starred-label">
                  <span>⭐ 我的最愛</span>
                </div>
                <div className="dash-project-grid">
                  {starredProjects.map((p, index) => renderCard(p, index))}
                </div>
              </div>
            )}

            {/* 主清單 */}
            {starredProjects.length > 0 && statusFilter !== 'starred' && regularProjects.length > 0 && (
              <div className="dash-section-label regular-label">
                <span>全部工程</span>
              </div>
            )}
            <div className="dash-project-grid">
              {filteredProjects.length === 0 && (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.82rem', background: 'var(--color-surface)', borderRadius: '10px', border: '1px solid var(--color-surface-border)' }}>
                  此分類目前無工程
                </div>
              )}
              {(starredProjects.length > 0 && statusFilter !== 'starred' ? regularProjects : filteredProjects).map((p, index) => renderCard(p, index))}
            </div>
          </div>
          {showAddModal && <AddProjectModal onClose={() => setShowAddModal(false)} onSuccess={handleDataAdded} />}
          {showExcelModal && <ExcelImportModal onClose={() => setShowExcelModal(false)} onSuccess={handleDataAdded} />}
          {editTarget && (
            <EditProjectModal
              project={editTarget}
              onClose={() => setEditTarget(null)}
              onSuccess={() => { setEditTarget(null); refresh?.(); }}
            />
          )}
          {deleteTarget && (
            <DeleteProjectModal
              project={deleteTarget}
              onClose={() => setDeleteTarget(null)}
              onDeleted={() => { setDeleteTarget(null); refresh?.(); }}
            />
          )}
        </main>
      </div>

      {/* 右鍵選單 */}
      {contextMenu && (
        <CardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          project={contextMenu.project}
          onClose={() => setContextMenu(null)}
          onToggleStar={() => toggleStar({ stopPropagation: () => {} }, contextMenu.project)}
          onDelete={() => setDeleteTarget(contextMenu.project)}
        />
      )}
    </div>
  );
}
