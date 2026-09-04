import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAutoHideScrollbar } from '../hooks/useAutoHideScrollbar';
import { supabase } from '../lib/supabaseClient';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import {
  ClipboardCheck, CalendarDays, Grid3x3, Search, Loader2, X,
  CheckCircle2, AlertTriangle, Clock, Send, FileText, BookOpen, ChevronLeft, ChevronRight, Menu,
} from 'lucide-react';
import './ReportCheck.css';
import '../components/ProjectLayout.css';

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

/* 工程狀態排序：執行中的案件排在前面，方便逐案檢核 */
const STATUS_ORDER = { active: 0, suspended: 1, pending: 2, completed: 3, accepted: 4 };
const STATUS_LABEL = {
  active: '執行中', suspended: '暫停中', pending: '未發包', completed: '已完工', accepted: '已竣工',
};

const pad = (n) => String(n).padStart(2, '0');
const dateStr = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const monthKey = (y, m) => `${y}-${pad(m + 1)}`;
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

function eachDate(start, end) {
  const out = [];
  const cur = new Date(`${start}T00:00:00`);
  const stop = new Date(`${end}T00:00:00`);
  while (cur <= stop) {
    out.push(dateStr(cur.getFullYear(), cur.getMonth(), cur.getDate()));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function fmtMonthLabel(y, m) {
  return `${y - 1911} 年 ${m + 1} 月`;
}

/* 西元 YYYY-MM-DD → 民國 114/10/05 */
function fmtRoc(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${Number(y) - 1911}/${m}/${d}`;
}

export function ReportCheck() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();

  const contentRef = useRef(null);
  useAutoHideScrollbar(contentRef);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [time, setTime] = useState(new Date());

  const today = useMemo(() => new Date(), []);
  const todayStr = dateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [view, setView] = useState('month');   // 'month' | 'year'
  const [query, setQuery] = useState('');
  const [onlyTodo, setOnlyTodo] = useState(false);

  const [projects, setProjects] = useState([]);
  const [logSet, setLogSet] = useState(() => new Set());
  const [reports, setReports] = useState({});
  const [loading, setLoading] = useState(true);

  const [detail, setDetail] = useState(null);   // { project, y, m }
  const [form, setForm] = useState({ status: 'pending', submitted_at: '', doc_no: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [{ data: projRows }, { data: logRows }, { data: repRows }] = await Promise.all([
        supabase.from('projects').select('id, name, contractor, status, start_date, end_date'),
        supabase.from('daily_logs').select('project_id, log_date')
          .gte('log_date', `${year}-01-01`).lte('log_date', `${year}-12-31`),
        supabase.from('supervision_reports').select('*')
          .gte('report_month', `${year}-01`).lte('report_month', `${year}-12`),
      ]);
      if (cancelled) return;

      const sorted = (projRows || []).slice().sort((a, b) => {
        const sa = STATUS_ORDER[a.status] ?? 9;
        const sb = STATUS_ORDER[b.status] ?? 9;
        if (sa !== sb) return sa - sb;
        return a.name.localeCompare(b.name, 'zh-Hant');
      });
      setProjects(sorted);
      setLogSet(new Set((logRows || []).map(r => `${r.project_id}|${r.log_date}`)));
      const map = {};
      (repRows || []).forEach(r => { map[`${r.project_id}|${r.report_month}`] = r; });
      setReports(map);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [year]);

  /* ── 單格檢核結果：日誌缺漏 + 月報提送/發文狀態 ── */
  const cellStat = useCallback((project, y, m) => {
    const dim = daysInMonth(y, m);
    const mStart = dateStr(y, m, 1);
    const mEnd = dateStr(y, m, dim);

    if (!project.start_date) return { active: false };
    let start = project.start_date > mStart ? project.start_date : mStart;
    let end = mEnd;
    if (project.end_date && project.end_date < end) end = project.end_date;
    if (todayStr < end) end = todayStr;
    if (start > end) return { active: false };

    const dates = eachDate(start, end);
    const missing = dates.filter(d => !logSet.has(`${project.id}|${d}`));
    const expected = dates.length;
    const logged = expected - missing.length;

    const ym = monthKey(y, m);
    const rec = reports[`${project.id}|${ym}`] || null;
    const submitted = rec?.status === 'submitted';
    const docNo = (rec?.doc_no || '').trim();
    const due = dateStr(m === 11 ? y + 1 : y, m === 11 ? 0 : m + 1, 5);

    let reportState;
    if (submitted && docNo) reportState = 'issued';
    else if (submitted) reportState = 'submitted';
    else if (todayStr > due) reportState = 'overdue';
    else reportState = 'pending';

    return {
      active: true, expected, logged, missing, rec, docNo, due, reportState,
      logState: expected === 0 ? 'none' : missing.length === 0 ? 'full' : missing.length >= expected ? 'empty' : 'partial',
    };
  }, [logSet, reports, todayStr]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter(p => {
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.contractor || '').toLowerCase().includes(q);
    });
  }, [projects, query]);

  /* ── 單月檢核列 ── */
  const monthRows = useMemo(() => {
    const rows = filtered
      .map(p => ({ project: p, stat: cellStat(p, year, month) }))
      .filter(r => r.stat.active);
    if (!onlyTodo) return rows;
    return rows.filter(r => r.stat.reportState !== 'issued' || r.stat.logState !== 'full');
  }, [filtered, cellStat, year, month, onlyTodo]);

  /* ── 年度總表列（僅顯示未完成時，隱藏全年皆已發文且日誌完整的工程） ── */
  const yearRows = useMemo(() => {
    if (!onlyTodo) return filtered;
    return filtered.filter(p => MONTHS.some((_, m) => {
      const stat = cellStat(p, year, m);
      return stat.active && (stat.reportState !== 'issued' || stat.logState !== 'full');
    }));
  }, [filtered, cellStat, year, onlyTodo]);

  const summary = useMemo(() => {
    const targetMonths = view === 'month' ? [month] : MONTHS.map((_, i) => i);
    const rows = filtered
      .flatMap(p => targetMonths.map(m => cellStat(p, year, m)))
      .filter(s => s.active);
    return {
      total: rows.length,
      issued: rows.filter(s => s.reportState === 'issued').length,
      submitted: rows.filter(s => s.reportState === 'submitted').length,
      overdue: rows.filter(s => s.reportState === 'overdue').length,
      pending: rows.filter(s => s.reportState === 'pending').length,
      missingDays: rows.reduce((sum, s) => sum + s.missing.length, 0),
    };
  }, [filtered, cellStat, year, month, view]);

  function openDetail(project, y, m) {
    const rec = reports[`${project.id}|${monthKey(y, m)}`] || null;
    setDetail({ project, y, m });
    setForm({
      status: rec?.status || 'pending',
      submitted_at: rec?.submitted_at ? rec.submitted_at.slice(0, 10) : '',
      doc_no: rec?.doc_no || '',
      notes: rec?.notes || '',
    });
  }

  async function saveDetail() {
    if (!detail) return;
    setSaving(true);
    const ym = monthKey(detail.y, detail.m);
    const payload = {
      project_id: detail.project.id,
      report_month: ym,
      status: form.status,
      submitted_at: form.status === 'submitted' && form.submitted_at ? form.submitted_at : null,
      doc_no: form.doc_no.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { data, error } = await supabase
      .from('supervision_reports')
      .upsert(payload, { onConflict: 'project_id,report_month' })
      .select()
      .maybeSingle();
    setSaving(false);
    if (error) return;
    setReports(prev => ({ ...prev, [`${detail.project.id}|${ym}`]: data || payload }));
    setDetail(null);
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const formatDateWithSeconds = (d) => new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(d);

  const stepMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
  };

  const reportBadge = (state) => {
    if (state === 'issued')    return <span className="rc-badge rc-badge-issued"><Send size={13} />已發文</span>;
    if (state === 'submitted') return <span className="rc-badge rc-badge-submitted"><CheckCircle2 size={13} />已提送</span>;
    if (state === 'overdue')   return <span className="rc-badge rc-badge-overdue"><AlertTriangle size={13} />逾期未送</span>;
    return <span className="rc-badge rc-badge-pending"><Clock size={13} />未提送</span>;
  };

  const logBadge = (stat) => {
    if (stat.logState === 'full')  return <span className="rc-badge rc-badge-issued"><CheckCircle2 size={13} />完整 {stat.logged}/{stat.expected}</span>;
    if (stat.logState === 'empty') return <span className="rc-badge rc-badge-overdue"><AlertTriangle size={13} />未建檔 0/{stat.expected}</span>;
    return <span className="rc-badge rc-badge-partial"><AlertTriangle size={13} />缺 {stat.missing.length} 日 · {stat.logged}/{stat.expected}</span>;
  };

  return (
    <div className="project-layout-container">
      <div className={`pl-mobile-overlay ${isMobileOpen ? 'active' : ''}`} onClick={() => setIsMobileOpen(false)} />

      <Sidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        projectId={null}
        onSignOut={handleSignOut}
        user={user}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        time={time}
        formatDate={formatDateWithSeconds}
      />

      <div className="pl-main-wrapper">
        <Topbar
          isGlobalDashboard={true}
          title="提送管制"
          backInfo={{ label: '總覽', onClick: () => navigate('/dashboard') }}
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
        />

        <main ref={contentRef} className="pl-content-area custom-scrollbar rc-page">
          {/* 標題列 */}
          <div className="rc-header">
            <button className="rc-menu-btn" onClick={() => setIsMobileOpen(true)} title="開啟選單">
              <Menu size={18} />
            </button>
            <span className="rc-title-accent" />
            <div className="rc-title-block">
              <h1 className="rc-title">施工日誌與監造報表提送管制</h1>
              <span className="rc-subtitle">跨工程檢核每月日誌建檔與月報提送、發文狀態</span>
            </div>

            <div className="rc-search">
              <Search size={14} className="rc-search-icon" />
              <input
                className="rc-search-input"
                placeholder="搜尋工程名稱或承包商…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>

            <div className="rc-view-tabs">
              <button className={`rc-tab${view === 'month' ? ' active' : ''}`} onClick={() => setView('month')}>
                <CalendarDays size={14} /><span>單月檢核</span>
              </button>
              <button className={`rc-tab${view === 'year' ? ' active' : ''}`} onClick={() => setView('year')}>
                <Grid3x3 size={14} /><span>年度總表</span>
              </button>
            </div>
          </div>

          {/* 期間選擇列 */}
          <div className="rc-toolbar">
            {view === 'month' ? (
              <div className="rc-period">
                <button className="rc-step-btn" onClick={() => stepMonth(-1)} title="上一月"><ChevronLeft size={16} /></button>
                <span className="rc-period-label">{fmtMonthLabel(year, month)}</span>
                <button className="rc-step-btn" onClick={() => stepMonth(1)} title="下一月"><ChevronRight size={16} /></button>
                <span className="rc-due-hint">
                  月報期限 {fmtRoc(dateStr(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1, 5))}
                </span>
              </div>
            ) : (
              <div className="rc-period">
                <button className="rc-step-btn" onClick={() => setYear(year - 1)} title="上一年"><ChevronLeft size={16} /></button>
                <span className="rc-period-label">{year - 1911} 年（{year}）</span>
                <button className="rc-step-btn" onClick={() => setYear(year + 1)} title="下一年"><ChevronRight size={16} /></button>
              </div>
            )}

            <label className="rc-check-toggle">
              <input type="checkbox" checked={onlyTodo} onChange={e => setOnlyTodo(e.target.checked)} />
              <span>僅顯示未完成</span>
            </label>
          </div>

          {/* 統計摘要 */}
          <div className="rc-stat-row">
            <div className="rc-stat">
              <span className="rc-stat-label">{view === 'month' ? '本月應提送' : '年度應提送'}</span>
              <span className="rc-stat-value">{summary.total}</span>
            </div>
            <div className="rc-stat rc-stat-success">
              <span className="rc-stat-label">已發文</span>
              <span className="rc-stat-value">{summary.issued}</span>
            </div>
            <div className="rc-stat rc-stat-warning">
              <span className="rc-stat-label">已提送待發文</span>
              <span className="rc-stat-value">{summary.submitted}</span>
            </div>
            <div className="rc-stat rc-stat-danger">
              <span className="rc-stat-label">逾期未提送</span>
              <span className="rc-stat-value">{summary.overdue}</span>
            </div>
            <div className="rc-stat">
              <span className="rc-stat-label">未到期未送</span>
              <span className="rc-stat-value">{summary.pending}</span>
            </div>
            <div className="rc-stat rc-stat-danger">
              <span className="rc-stat-label">日誌缺漏（日）</span>
              <span className="rc-stat-value">{summary.missingDays}</span>
            </div>
          </div>

          {loading ? (
            <div className="rc-loading"><Loader2 size={20} className="animate-spin" />載入中…</div>
          ) : view === 'month' ? (
            monthRows.length === 0 ? (
              <div className="rc-empty">本月沒有符合條件的工程。</div>
            ) : (
              <div className="rc-table-wrap custom-scrollbar">
                <table className="rc-table">
                  <thead>
                    <tr>
                      <th className="rc-col-name">工程名稱</th>
                      <th className="rc-col-contractor">承包商</th>
                      <th>施工日誌</th>
                      <th>監造月報</th>
                      <th>提送日期</th>
                      <th>發文文號</th>
                      <th className="rc-col-action">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthRows.map(({ project, stat }) => (
                      <tr key={project.id} className="list-item-enter">
                        <td className="rc-col-name">
                          <span className="rc-proj-name">{project.name}</span>
                          <span className={`rc-proj-status rc-status-${project.status}`}>{STATUS_LABEL[project.status] || project.status}</span>
                        </td>
                        <td className="rc-col-contractor rc-muted">{project.contractor || '未指定'}</td>
                        <td>{logBadge(stat)}</td>
                        <td>{reportBadge(stat.reportState)}</td>
                        <td className="rc-muted">{fmtRoc(stat.rec?.submitted_at)}</td>
                        <td className="rc-muted">{stat.docNo || '—'}</td>
                        <td className="rc-col-action">
                          <button className="rc-row-btn rc-row-btn-main" onClick={() => openDetail(project, year, month)}>
                            <ClipboardCheck size={14} />檢核
                          </button>
                          <button className="rc-row-btn" onClick={() => navigate(`/projects/${project.id}/supervision`)}>
                            <BookOpen size={14} />日誌
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : yearRows.length === 0 ? (
            <div className="rc-empty">本年度沒有符合條件的工程。</div>
          ) : (
            <div className="rc-table-wrap custom-scrollbar">
              <table className="rc-matrix">
                <thead>
                  <tr>
                    <th className="rc-matrix-head-name">工程名稱</th>
                    {MONTHS.map((label, m) => <th key={label} className={m === today.getMonth() && year === today.getFullYear() ? 'rc-matrix-current' : ''}>{label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {yearRows.map(project => (
                    <tr key={project.id}>
                      <th className="rc-matrix-head-name">
                        <span className="rc-proj-name">{project.name}</span>
                        <span className={`rc-proj-status rc-status-${project.status}`}>{STATUS_LABEL[project.status] || project.status}</span>
                      </th>
                      {MONTHS.map((label, m) => {
                        const stat = cellStat(project, year, m);
                        if (!stat.active) return <td key={label} className="rc-cell rc-cell-inactive">—</td>;
                        return (
                          <td
                            key={label}
                            className={`rc-cell rc-cell-${stat.reportState}`}
                            onClick={() => openDetail(project, year, m)}
                            title={`${project.name} ${year}/${m + 1}`}
                          >
                            <span className={`rc-cell-log rc-log-${stat.logState}`}>
                              {stat.logState === 'full' ? `日誌 ${stat.logged}/${stat.expected}` : `缺 ${stat.missing.length} 日`}
                            </span>
                            <span className="rc-cell-report">
                              {stat.reportState === 'issued' ? '已發文'
                                : stat.reportState === 'submitted' ? '已提送'
                                : stat.reportState === 'overdue' ? '逾期未送' : '未提送'}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* 檢核明細 Modal */}
      {detail && (
        <div className="rc-modal-overlay" onClick={e => e.target === e.currentTarget && setDetail(null)}>
          <div className="rc-modal animate-slide-up">
            <div className="rc-modal-header">
              <div className="rc-modal-title-group">
                <ClipboardCheck size={16} />
                <span className="rc-modal-title">{detail.project.name}</span>
                <span className="rc-modal-month">{fmtMonthLabel(detail.y, detail.m)}</span>
              </div>
              <button className="rc-modal-close" onClick={() => setDetail(null)}><X size={16} /></button>
            </div>

            <div className="rc-modal-body custom-scrollbar">
              {(() => {
                const stat = cellStat(detail.project, detail.y, detail.m);
                return (
                  <>
                    <div className="rc-section">
                      <div className="rc-section-title"><span className="rc-title-accent" />施工日誌建檔</div>
                      <div className="rc-diary-summary">
                        {logBadge(stat)}
                        <span className="rc-muted">工期內應建檔 {stat.expected} 日，已建檔 {stat.logged} 日</span>
                      </div>
                      {stat.missing.length > 0 && (
                        <div className="rc-missing-list">
                          {stat.missing.map(d => <span key={d} className="rc-missing-chip">{d.slice(5).replace('-', '/')}</span>)}
                        </div>
                      )}
                      <button
                        className="rc-link-btn"
                        onClick={() => navigate(`/projects/${detail.project.id}/supervision`)}
                      >
                        <BookOpen size={14} />開啟該工程日誌
                      </button>
                    </div>

                    <div className="rc-section">
                      <div className="rc-section-title"><span className="rc-title-accent" />監造月報提送 / 發文</div>
                      <div className="rc-form-row">
                        <span className="rc-form-label">提送狀態</span>
                        <div className="rc-toggle-row">
                          <button
                            className={`rc-toggle-btn${form.status === 'pending' ? ' active-gray' : ''}`}
                            onClick={() => setForm(f => ({ ...f, status: 'pending' }))}
                          >未提送</button>
                          <button
                            className={`rc-toggle-btn${form.status === 'submitted' ? ' active-green' : ''}`}
                            onClick={() => setForm(f => ({ ...f, status: 'submitted', submitted_at: f.submitted_at || todayStr }))}
                          >已提送</button>
                        </div>
                      </div>
                      <label className="rc-form-row">
                        <span className="rc-form-label">提送日期</span>
                        <input type="date" className="rc-input" value={form.submitted_at}
                          onChange={e => setForm(f => ({ ...f, submitted_at: e.target.value }))} />
                      </label>
                      <label className="rc-form-row">
                        <span className="rc-form-label">發文文號</span>
                        <input type="text" className="rc-input" value={form.doc_no} placeholder="例：府工字第00123號"
                          onChange={e => setForm(f => ({ ...f, doc_no: e.target.value }))} />
                      </label>
                      <label className="rc-form-row">
                        <span className="rc-form-label">備註</span>
                        <input type="text" className="rc-input" value={form.notes}
                          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                      </label>
                      <div className="rc-form-hint">
                        <FileText size={13} />填入發文文號後即視為已發文；提送期限為 {fmtRoc(stat.due)}。
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="rc-modal-footer">
              <button className="rc-btn-cancel" onClick={() => setDetail(null)}>取消</button>
              <button className="rc-btn-save" onClick={saveDetail} disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}儲存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
