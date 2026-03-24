import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, DollarSign, Clock, TrendingUp, CreditCard, 
  AlertCircle, PieChart, Info, Activity, Calendar,
  FileText, Package, ClipboardCheck, CalendarPlus, PackageCheck
} from 'lucide-react';

import { useProject } from '../hooks/useProject';
import './Dashboard.css';

export function ProjectDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { project, loading, error } = useProject(id);

  if (loading) return <div className="dash-main"><div className="diary-loading">載入中...</div></div>;
  if (error) return <div className="dash-main"><div className="dash-error-msg">{error}</div></div>;

  const lp = project?.latest_progress;
  const planned = lp?.planned_progress || 0;
  const actual = lp?.actual_progress || 0;
  const diff = actual - planned;
  
  const paymentProg = project.budget ? Math.min(100, Math.round(((actual || 0) * project.budget) / 10000)) : 0;
  
  const stats = [
    { label: "契約金額 (萬)", value: project?.budget || '—', icon: <DollarSign size={18} />, accent: "sky" },
    { label: "工期天數", value: project?.days || '180', icon: <Clock size={18} />, accent: "emerald" },
    { label: "施工進度", value: `${actual}%`, icon: <TrendingUp size={18} />, accent: "blue" },
    { label: "請款進度", value: `${paymentProg}%`, icon: <CreditCard size={18} />, accent: "violet" },
  ];
  
  const sCurveData = [
    { m: "8月", p: 10, a: 12 }, 
    { m: "9月", p: 20, a: 22 }, 
    { m: "10月", p: 32, a: 30 }, 
    { m: "11月", p: 45, a: 38 }, 
    { m: "12月", p: 55, a: Math.min(43, actual) }, 
    { m: "1月", p: 60, a: actual }
  ];

  const recentActivities = [
    { date: "2026/03/20", event: "提交第 5 期工程估驗單", type: "document" },
    { date: "2026/03/18", event: "監造日誌：完成區段 A 鋼筋綁紮檢查", type: "log" },
    { date: "2026/03/15", event: "現場照片：新增 12 張施工紀錄", type: "photo" },
  ];

  // Mock data for dashboard extension panels
  const planSubmissionStats = { totalRequired: 25, rejected: 1, underReview: 2, approved: 15 };
  const planUnsub = planSubmissionStats.totalRequired - planSubmissionStats.approved - planSubmissionStats.rejected - planSubmissionStats.underReview;

  const materialSubmissionStats = { totalRequired: 40, rejected: 0, underReview: 4, approved: 28 };
  const matUnsub = materialSubmissionStats.totalRequired - materialSubmissionStats.approved - materialSubmissionStats.rejected - materialSubmissionStats.underReview;

  const constructionInspectionStats = { weeklyComplete: true, thisWeekCount: 12, todayCount: 3 };
  const materialInspectionStats = { weeklyComplete: false, thisWeekCount: 5, todayCount: 1 };

  return (
    <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="dash-page-header" style={{ marginBottom: '4px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
            <span className={`status-badge ${project?.status || 'active'}`}>{project?.status === 'active' ? '執行中' : '已完工'}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{project?.id?.slice(0, 8).toUpperCase()}</span>
          </div>
          <h1 className="dash-title" style={{ fontSize: '1.25rem', lineHeight: 1.2, margin: 0 }}>
            {project?.name || '專案載入中...'}
          </h1>
        </div>
      </div>

      <div className="stunning-bento-grid">
        
        {/* 1. ACTUAL VS PLANNED PROGRESS (Wide Card) */}
        <div className="stunning-card stunning-card-wide">
          <div className="stunning-card-header">
            <div className="stunning-icon-box">
              <TrendingUp size={16} />
            </div>
            <h2 className="stunning-card-title">工程進度與財務追蹤</h2>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <span>施工進度</span>
                <span className={diff < 0 ? 'neon-red' : 'neon-green'} style={{ fontWeight: 800 }}>
                  實: {actual}% / 預: {planned}%
                </span>
              </div>
              <div className="stunning-progress-wrap">
                <div className="stunning-planned-bar" style={{ width: `${planned}%` }}></div>
                <div className="stunning-actual-bar" style={{ width: `${actual}%` }}>{actual}%</div>
              </div>
            </div>
            <div style={{ flex: '1 1 300px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <span>請款金額進度</span>
                <span className="neon-blue" style={{ fontWeight: 800 }}>{paymentProg}%</span>
              </div>
              <div className="stunning-progress-wrap">
                <div className="stunning-actual-bar" style={{ width: `${paymentProg}%`, background: 'linear-gradient(90deg, #4c1d95, #8b5cf6, #c084fc)' }}>{paymentProg}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. PLAN SUBMISSION STATUS */}
        <div className="stunning-card">
          <div className="stunning-card-header">
            <div className="stunning-icon-box">
              <FileText size={16} />
            </div>
            <h2 className="stunning-card-title">計畫書送審管制狀態</h2>
          </div>
          <div className="neon-stats-grid">
            <div className="neon-stat-box neon-yellow">
              <span className="neon-val">{planUnsub}/{planSubmissionStats.totalRequired}</span>
              <span className="neon-label">未提送/應提送</span>
            </div>
            <div className="neon-stat-box neon-blue">
              <span className="neon-val">{planSubmissionStats.underReview}</span>
              <span className="neon-label">審查中</span>
            </div>
            <div className="neon-stat-box neon-red">
              <span className="neon-val">{planSubmissionStats.rejected}</span>
              <span className="neon-label">已審退</span>
            </div>
            <div className="neon-stat-box neon-green">
              <span className="neon-val">{planSubmissionStats.approved}</span>
              <span className="neon-label">已核定</span>
            </div>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex' }}>
            <button className="btn-cyber primary" style={{ width: '100%' }}>
              <FileText size={14} /> 進入管制總表
            </button>
          </div>
        </div>

        {/* 3. MATERIAL SUBMISSION STATUS */}
        <div className="stunning-card">
          <div className="stunning-card-header">
            <div className="stunning-icon-box">
              <Package size={16} />
            </div>
            <h2 className="stunning-card-title">材料送審管制狀態</h2>
          </div>
          <div className="neon-stats-grid">
            <div className="neon-stat-box neon-yellow">
              <span className="neon-val">{matUnsub}/{materialSubmissionStats.totalRequired}</span>
              <span className="neon-label">未提送/應提送</span>
            </div>
            <div className="neon-stat-box neon-blue">
              <span className="neon-val">{materialSubmissionStats.underReview}</span>
              <span className="neon-label">審查中</span>
            </div>
            <div className="neon-stat-box neon-red">
              <span className="neon-val">{materialSubmissionStats.rejected}</span>
              <span className="neon-label">已審退</span>
            </div>
            <div className="neon-stat-box neon-green">
              <span className="neon-val">{materialSubmissionStats.approved}</span>
              <span className="neon-label">已核定</span>
            </div>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex' }}>
            <button className="btn-cyber primary" style={{ width: '100%' }}>
              <Package size={14} /> 進入管制總表
            </button>
          </div>
        </div>

        {/* 4. CONSTRUCTION INSPECTION STATUS */}
        <div className="stunning-card sci-fi-tracker">
          <div className="stunning-card-header" style={{ marginBottom: 0 }}>
            <div className="stunning-icon-box">
              <ClipboardCheck size={16} />
            </div>
            <h2 className="stunning-card-title">施工檢驗停留點查驗</h2>
          </div>
          
          <div className="sci-fi-status-row">
            <span className="sci-fi-text">每週抽查執行狀態</span>
            <div className={`sci-fi-indicator ${constructionInspectionStats.weeklyComplete ? 'orb-green' : 'orb-red'}`}>
              <div className="sci-fi-orb" />
              {constructionInspectionStats.weeklyComplete ? 'ACTIVE' : 'INACTIVE'}
            </div>
          </div>

          <div className="inspection-counters">
            <div className="counter-box">
              <div className="c-val highlight-val">{constructionInspectionStats.thisWeekCount}</div>
              <div className="c-label">本週查驗總件數</div>
            </div>
            <div className="counter-box">
              <div className="c-val">{constructionInspectionStats.todayCount}</div>
              <div className="c-label">今日查驗件數</div>
            </div>
          </div>

          <div className="cool-btn-group">
            <button className="btn-cyber">進入管制總表</button>
            <button className="btn-cyber primary" onClick={() => alert('已模擬新增至 Google 日曆！')}>
              <CalendarPlus size={14} /> 同步日曆
            </button>
          </div>
        </div>

        {/* 5. MATERIAL INSPECTION STATUS */}
        <div className="stunning-card sci-fi-tracker">
          <div className="stunning-card-header">
            <div className="stunning-icon-box">
              <PackageCheck size={16} />
            </div>
            <h2 className="stunning-card-title">材料進場查驗管制</h2>
          </div>

          <div className="inspection-counters">
            <div className="counter-box">
              <div className="c-val highlight-val">{materialInspectionStats.thisWeekCount}</div>
              <div className="c-label">本週進場總件數</div>
            </div>
            <div className="counter-box">
              <div className="c-val">{materialInspectionStats.todayCount}</div>
              <div className="c-label">今日進場件數</div>
            </div>
          </div>

          <div className="cool-btn-group">
            <button className="btn-cyber">進入管制總表</button>
            <button className="btn-cyber primary" onClick={() => alert('已模擬新增至 Google 日曆！')}>
              <CalendarPlus size={14} /> 同步日曆
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
