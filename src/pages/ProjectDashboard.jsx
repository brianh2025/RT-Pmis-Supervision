/* ============================================================
   ProjectDashboard.jsx — 專案儀表板
   Design: Bento Grid + Top Quick Nav (based on Manus_v1)
   ============================================================ */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  TrendingUp, Calendar, Loader2,
  AlertTriangle, CheckCircle2, ChevronRight, AlertCircle, Clock,
  BookOpen, Camera, Package,
  Shield, Archive, BarChart2,
  Pencil, X,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useProject } from '../hooks/useProject';
import './ProjectDashboard.css';

const SHORTCUTS = [
  { label: '照片記錄', icon: Camera,    path: 'photos',    color: '#f472b6' },
  { label: '日誌報表', icon: BookOpen,  path: 'journal',   color: '#60a5fa' },
  { label: '進度管理', icon: TrendingUp,path: 'progress',  color: '#6366f1' },
  { label: '品質管理', icon: Shield,    path: 'quality',   color: '#fb923c' },
  { label: '歸檔管理', icon: Archive,   path: 'archive',   color: '#34d399' },
  { label: '統計分析', icon: BarChart2, path: 'analytics', color: '#818cf8' },
];

export function ProjectDashboard() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const { project, loading: projectLoading, refetch } = useProject(projectId);

  const [showProjectInfo, setShowProjectInfo] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const [stats, setStats] = useState({
    totalLogs: 0, thisMonthLogs: 0, pendingLogs: 0, missingDates: [],
    latestPlanned: 0, latestActual: 0,
    mcsSubmissionCount: 0, mcsTestCount: 0, mcsPlanCount: 0,
    submissionCount: 0, submissionPending: 0,
    qualityCount: 0, qualityOpen: 0,
    archiveCount: 0,
    inspTotal: 0, inspPending: 0, inspFail: 0,
    matUnregistered: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!projectId || !supabase) { setStatsLoading(false); return; }

    async function fetchStats() {
      setStatsLoading(true);
      const now = new Date();
      const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const yesterdayStr = (() => {
        const y = new Date(now); y.setDate(y.getDate() - 1);
        return `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
      })();

      const [logsRes, monthLogsRes, progressRes, subRes, tstRes, plnRes] = await Promise.all([
        supabase.from('daily_logs').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
        // 取本月至昨日的已填日期清單
        supabase.from('daily_logs').select('log_date').eq('project_id', projectId)
          .gte('log_date', thisMonthStart).lte('log_date', yesterdayStr),
        supabase.from('progress_records').select('planned_progress, actual_progress').eq('project_id', projectId).gt('actual_progress', 0).order('report_date', { ascending: false }).limit(1),
        supabase.from('mcs_submission').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('mcs_test').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('mcs_plan').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      ]);

      // 計算本月（至昨日）應填工作日，找出缺漏日期（排除週日）
      const filledSet = new Set((monthLogsRes.data || []).map(r => r.log_date));
      const missingDates = [];
      const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
      for (let d = 1; d <= yesterday.getDate() && yesterday.getMonth() === now.getMonth(); d++) {
        const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (!filledSet.has(key)) missingDates.push(key);
      }
      const pendingLogs = missingDates.length;
      const latestProgress = progressRes.data?.[0];

      const [subMgmtRes, subPendingRes, qualRes, qualOpenRes, archRes, inspRes, matEntryRes, matTestRes] = await Promise.all([
        supabase.from('mcs_submission').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('mcs_submission').select('id', { count: 'exact', head: true }).eq('project_id', projectId).neq('result', '同意備查'),
        supabase.from('quality_issues').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('quality_issues').select('id', { count: 'exact', head: true }).eq('project_id', projectId).in('status', ['open', 'in_progress']),
        supabase.from('archive_docs').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('construction_inspections').select('result').eq('project_id', projectId),
        // 日誌工項中含材料關鍵字 → 需回填管制
        supabase.from('daily_report_items').select('id', { count: 'exact', head: true }).eq('project_id', projectId)
          .or('item_name.ilike.%混凝土%,item_name.ilike.%鋼筋%,item_name.ilike.%瀝青%,item_name.ilike.%模板%,item_name.ilike.%地工織布%,item_name.ilike.%基樁%,item_name.ilike.%植筋%'),
        supabase.from('material_entries').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      ]);

      const inspData = inspRes.data || [];
      const inspPending = inspData.filter(r => r.result === '待複驗').length;
      const inspFail    = inspData.filter(r => r.result === '不合格').length;

      // 日誌有材料工項 but 尚未回填 material_entries（status 判斷移至 tasks 陣列）
      const matUnregistered =
        (matEntryRes.count || 0) > 0 && (matTestRes.count || 0) === 0 ? 1 : 0;

      setStats({
        totalLogs: logsRes.count || 0,
        thisMonthLogs: (monthLogsRes.data || []).length,
        pendingLogs,
        missingDates,
        latestPlanned: parseFloat((latestProgress?.planned_progress || 0).toFixed(2)),
        latestActual:  parseFloat((latestProgress?.actual_progress  || 0).toFixed(2)),
        mcsSubmissionCount: subRes.count || 0,
        mcsTestCount: tstRes.count || 0,
        mcsPlanCount: plnRes.count || 0,
        submissionCount: subMgmtRes.count || 0,
        submissionPending: subPendingRes.count || 0,
        qualityCount: qualRes.count || 0,
        qualityOpen: qualOpenRes.count || 0,
        archiveCount: archRes.count || 0,
        inspTotal: inspData.length,
        inspPending,
        inspFail,
        matUnregistered,
      });
      setStatsLoading(false);
    }

    fetchStats();
  }, [projectId]);

  const [now] = useState(() => Date.now());

  if (projectLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '8px', color: 'var(--color-text-muted)' }}>
      <Loader2 size={18} className="animate-spin" /><span>載入專案資料中…</span>
    </div>
  );

  if (!project) return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
      找不到此工程，請確認工程 ID 是否正確。
    </div>
  );

  const diff = stats.latestActual - stats.latestPlanned;
  const daysRemaining = project.end_date
    ? Math.ceil((new Date(project.end_date).getTime() - now) / 86400000)
    : null;

  const monthEnd = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()}`;
  })();

  const tasks = statsLoading ? [] : [
    stats.pendingLogs > 0 && {
      id: 'diary', level: stats.pendingLogs >= 3 ? 'urgent' : 'warning', icon: BookOpen,
      title: `施工日誌未補 ${stats.pendingLogs} 天`,
      desc: `本月已匯入 ${stats.thisMonthLogs} 筆，以下日期缺少日誌`,
      due: `補至 ${monthEnd}`, path: 'journal', action: '前往補填', dates: stats.missingDates,
    },
    stats.qualityOpen > 0 && {
      id: 'quality', level: 'urgent', icon: AlertCircle,
      title: `品管缺失未結案 ${stats.qualityOpen} 件`,
      desc: `共 ${stats.qualityCount} 件缺失，${stats.qualityOpen} 件待改善`,
      due: '請儘速結案', path: 'quality', action: '查看缺失',
    },
    stats.submissionPending > 0 && {
      id: 'submission', level: 'warning', icon: Clock,
      title: `送審件待處理 ${stats.submissionPending} 件`,
      desc: `共 ${stats.submissionCount} 件送審，${stats.submissionPending} 件待送出`,
      path: 'submission', action: '前往送審',
    },
    diff < -5 && {
      id: 'progress', level: 'urgent', icon: TrendingUp,
      title: `進度落後 ${Math.abs(diff).toFixed(1)}%，需提出趕工計畫`,
      desc: `預定 ${stats.latestPlanned}%，實際 ${stats.latestActual}%`,
      due: '請儘速更新', path: 'progress', action: '更新進度',
    },
    daysRemaining !== null && daysRemaining <= 30 && daysRemaining >= 0 && {
      id: 'deadline', level: daysRemaining <= 14 ? 'urgent' : 'warning', icon: Calendar,
      title: `工程剩餘工期 ${daysRemaining} 天`,
      desc: `完工期限：${project.end_date}，請確認驗收作業準備`,
      due: project.end_date, path: 'progress', action: '查看進度',
    },
    stats.inspFail > 0 && {
      id: 'insp-fail', level: 'urgent', icon: AlertCircle,
      title: `施工檢驗不合格 ${stats.inspFail} 項，需複驗`,
      desc: `共 ${stats.inspTotal} 項檢驗，${stats.inspFail} 不合格`,
      path: 'quality', action: '前往複驗',
    },
    stats.inspFail === 0 && stats.inspPending > 0 && {
      id: 'insp-pending', level: 'warning', icon: Clock,
      title: `施工檢驗待複驗 ${stats.inspPending} 項`,
      desc: `共 ${stats.inspTotal} 項檢驗，請安排複驗`,
      path: 'quality', action: '查看檢驗',
    },
    stats.matUnregistered > 0 && project?.status === 'active' && {
      id: 'mat-unregistered', level: 'warning', icon: Package,
      title: '材料進場管制尚未回填',
      desc: '廠商日誌已有記錄，請至材料管制頁回填進場資料',
      path: 'material', action: '前往回填',
    },
  ].filter(Boolean);

  const allDone = !statsLoading && tasks.length === 0;

  return (
    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>

      {/* ── PROJECT DASHBOARD 標籤列 ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '13px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}>
          PROJECT DASHBOARD
        </span>
        <span className={`status-badge ${project.status === 'active' ? 'active' : project.status === 'completed' ? 'completed' : project.status === 'accepted' ? 'completed' : project.status === 'pending' ? 'suspended' : 'suspended'}`}>
          {project.status === 'active' ? '執行中' : project.status === 'completed' ? '已完工' : project.status === 'accepted' ? '已竣工' : project.status === 'pending' ? '未發包' : '暫停'}
        </span>
      </div>

      {/* ── 專案標頭 ── */}
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text1)', margin: 0, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {project.name}
        </h1>
        {project.contractor && (
          <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            承包商：{project.contractor}
          </div>
        )}
      </div>

      {/* ── 六大功能模組 ── */}
      <div className="dash-sc-grid">
        {SHORTCUTS.map(({ icon: Icon, label, path, color }) => (
          <button key={path} className="dash-sc-card" style={{ '--btn-color': color }} onClick={() => navigate(`/projects/${projectId}/${path}`)}>
            <Icon size={28} style={{ color }} />
            <div className="dash-sc-label">{label}</div>
          </button>
        ))}
      </div>

      {/* ── 今日任務 ── */}
      <div className="task-board">
        <div className="task-board-header">
          <div className="task-board-title">
            {allDone
              ? <><CheckCircle2 size={14} style={{ color: 'var(--color-success)' }} />今日任務</>
              : <><AlertTriangle size={14} style={{ color: 'var(--color-warning)' }} />待辦任務</>
            }
          </div>
          {!allDone && (
            <span className="task-board-count">{statsLoading ? '載入中…' : `${tasks.length} 項待處理`}</span>
          )}
        </div>

        {statsLoading && (
          <div className="task-board-loading"><Loader2 size={14} className="animate-spin" />載入任務中…</div>
        )}

        {allDone && (
          <div className="task-board-done">
            <CheckCircle2 size={20} />
            <span>今日任務全數完成，繼續保持！</span>
          </div>
        )}

        {tasks.map(task => {
          const Icon = task.icon;
          return (
            <div key={task.id} className={`task-item task-item-${task.level}`} onClick={() => navigate(`/projects/${projectId}/${task.path}`)}>
              <div className="task-item-icon"><Icon size={15} /></div>
              <div className="task-item-body">
                <div className="task-item-title">{task.title}</div>
                <div className="task-item-desc">{task.desc}</div>
                {task.dates?.length > 0 && (
                  <div className="task-missing-dates">
                    {task.dates.map(d => {
                      const [, m, day] = d.split('-');
                      return <span key={d} className="task-missing-date-chip">{+m}/{+day}</span>;
                    })}
                  </div>
                )}
              </div>
              {task.due && <span className={`task-due-badge task-due-${task.level}`}>{task.due}</span>}
              <div className="task-item-action">{task.action}<ChevronRight size={13} /></div>
            </div>
          );
        })}
      </div>

      {/* ── 工程進度 ── */}
      <div className="stunning-card stunning-card-progress" style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${projectId}/progress`)}>
        <div className="stunning-card-header">
          <div className="stunning-icon-box"><TrendingUp size={14} /></div>
          <h3 className="stunning-card-title">工程進度</h3>
          {statsLoading && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--color-text-muted)', marginLeft: 'auto' }} />}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: 'var(--color-primary-light)', lineHeight: 1 }}>
              {stats.latestActual}%
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
              {stats.latestPlanned > 0 && (
                <span className={`diff-badge ${diff >= 0 ? 'diff-positive' : 'diff-negative'}`}>
                  {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
                </span>
              )}
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>預定 {stats.latestPlanned}%</span>
            </div>
          </div>
          <div className="stunning-progress-wrap">
            <div className="stunning-planned-bar" style={{ width: `${stats.latestPlanned}%` }} />
            <div className="stunning-actual-bar" style={{ width: `${stats.latestActual}%` }}>
              {stats.latestActual > 5 && `${stats.latestActual}%`}
            </div>
          </div>
        </div>
      </div>

      {/* ── 工程資訊 ── */}
      <div className="stunning-card stunning-card-info" style={{ cursor: 'pointer' }} onClick={() => { setEditMode(false); setEditForm({ name: project.name || '', contractor: project.contractor || '', start_date: project.start_date || '', end_date: project.end_date || '', status: project.status || 'active', supervisor_name: project.supervisor_name || '' }); setShowProjectInfo(true); }}>
        <div className="stunning-card-header">
          <div className="stunning-icon-box"><Calendar size={14} /></div>
          <h3 className="stunning-card-title">工程資訊</h3>
          <button
            className="proj-info-edit-btn"
            onClick={e => { e.stopPropagation(); setEditForm({ name: project.name || '', contractor: project.contractor || '', start_date: project.start_date || '', end_date: project.end_date || '', status: project.status || 'active', supervisor_name: project.supervisor_name || '' }); setEditMode(true); setShowProjectInfo(true); }}
            title="編輯工程資訊"
          >
            <Pencil size={12} />
          </button>
        </div>
        <div className="neon-stats-grid">
          <div className="neon-stat-box neon-yellow">
            <span className="neon-val">{daysRemaining !== null ? Math.max(0, daysRemaining) : '—'}</span>
            <span className="neon-label">剩餘工期(天)</span>
          </div>
          <div className="neon-stat-box neon-blue">
            <span className="neon-val">{project.start_date ? project.start_date.slice(0, 7) : '—'}</span>
            <span className="neon-label">開工年月</span>
          </div>
          <div className="neon-stat-box neon-red">
            <span className="neon-val">{daysRemaining !== null && daysRemaining < 0 ? Math.abs(daysRemaining) : '—'}</span>
            <span className="neon-label">逾期天數</span>
          </div>
          <div className="neon-stat-box neon-green">
            <span className="neon-val">{project.end_date ? project.end_date.slice(0, 7) : '—'}</span>
            <span className="neon-label">預計完工</span>
          </div>
        </div>
      </div>

      {/* ── 工程資訊 Modal ── */}
      {showProjectInfo && (
        <div className="proj-info-overlay" onClick={() => setShowProjectInfo(false)}>
          <div className="proj-info-modal" onClick={e => e.stopPropagation()}>
            <div className="proj-info-modal-header">
              <span className="proj-info-modal-title">工程基本資料</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {!editMode && (
                  <button className="proj-info-edit-btn" onClick={() => setEditMode(true)} title="編輯">
                    <Pencil size={13} />
                  </button>
                )}
                <button className="proj-info-close-btn" onClick={() => setShowProjectInfo(false)}>
                  <X size={14} />
                </button>
              </div>
            </div>

            {editMode ? (
              <div className="proj-info-modal-body">
                {[
                  { label: '工程名稱', key: 'name', type: 'text' },
                  { label: '承包商',   key: 'contractor', type: 'text' },
                  { label: '開工日期', key: 'start_date', type: 'date' },
                  { label: '完工日期', key: 'end_date',   type: 'date' },
                ].map(({ label, key, type }) => (
                  <div key={key} className="proj-info-field">
                    <label>{label}</label>
                    <input
                      type={type}
                      value={editForm[key]}
                      onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
                <div className="proj-info-field">
                  <label>監造人員</label>
                  <textarea
                    value={editForm.supervisor_name || ''}
                    onChange={e => setEditForm(f => ({ ...f, supervisor_name: e.target.value }))}
                    placeholder="每行一位監造人員姓名"
                    rows={3}
                    style={{ width: '100%', padding: '5px 8px', background: 'var(--color-bg1)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text1)', fontSize: '0.82rem', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                  />
                </div>
                <div className="proj-info-field">
                  <label>狀態</label>
                  <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="pending">未發包</option>
                    <option value="active">執行中</option>
                    <option value="completed">已完工</option>
                    <option value="accepted">已竣工</option>
                    <option value="suspended">暫停</option>
                  </select>
                </div>
                <div className="proj-info-modal-actions">
                  <button className="proj-info-cancel-btn" onClick={() => setEditMode(false)}>取消</button>
                  <button
                    className="proj-info-save-btn"
                    disabled={saving}
                    onClick={async () => {
                      setSaving(true);
                      await supabase.from('projects').update({
                        name: editForm.name,
                        contractor: editForm.contractor,
                        start_date: editForm.start_date || null,
                        end_date: editForm.end_date || null,
                        status: editForm.status,
                        supervisor_name: editForm.supervisor_name || null,
                      }).eq('id', projectId);
                      setSaving(false);
                      setEditMode(false);
                      setShowProjectInfo(false);
                      refetch();
                    }}
                  >
                    {saving ? '儲存中…' : '儲存'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="proj-info-modal-body">
                {[
                  { label: '工程名稱', value: project.name },
                  { label: '承包商',   value: project.contractor },
                  { label: '監造人員', value: project.supervisor_name },
                  { label: '開工日期', value: project.start_date },
                  { label: '完工日期', value: project.end_date },
                  { label: '狀態',     value: project.status === 'active' ? '執行中' : project.status === 'completed' ? '已完工' : '暫停' },
                  daysRemaining !== null && { label: '剩餘工期', value: daysRemaining > 0 ? `${daysRemaining} 天` : `已逾期 ${Math.abs(daysRemaining)} 天` },
                ].filter(Boolean).map(({ label, value }) => (
                  <div key={label} className="proj-info-row">
                    <span className="proj-info-row-label">{label}</span>
                    <span className="proj-info-row-value">{value || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
