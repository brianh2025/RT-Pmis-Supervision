import React from 'react';
import {
  X, HelpCircle, CheckCircle2,
  Building2, BookOpen, Camera, TrendingUp, Shield, Archive, BarChart2,
} from 'lucide-react';
import './TutorialModals.css';

const WELCOME_FEATURES = [
  { icon: Building2,  label: '工程總覽',  desc: '所有監造工程進度一覽，跨工程待辦彙整' },
  { icon: BookOpen,   label: '施工日誌',  desc: '每日施工情形填報，支援批次匯入與 PDF 報表' },
  { icon: Camera,     label: '照片記錄',  desc: '工程抽查照片管理，自動讀取 EXIF，一鍵出報告' },
  { icon: TrendingUp, label: '進度管理',  desc: '預定與實際進度記錄，S 曲線圖表視覺化追蹤' },
  { icon: Shield,     label: '品質管理',  desc: '缺失追蹤、施工抽查，到期自動警示' },
  { icon: Archive,    label: '歸檔管理',  desc: '送審文件、照片記錄統一歸檔，分類檢索' },
  { icon: BarChart2,  label: '統計分析',  desc: '工程數據視覺化，填報率、進度趨勢等圖表' },
];

/* ── 歡迎 / 系統概覽 ── */
export function WelcomeModal({ onClose }) {
  function dismiss() {
    localStorage.setItem('pmis-tutorial-seen', '1');
    onClose();
  }

  return (
    <div className="tut-overlay" onClick={dismiss}>
      <div className="tut-modal tut-welcome" onClick={e => e.stopPropagation()}>

        <div className="tut-welcome-header">
          <div className="tut-welcome-logo"><Building2 size={20} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="tut-welcome-title">RT-PMIS 系統使用指南</div>
            <div className="tut-welcome-subtitle">雲林縣公共工程監造管理系統</div>
          </div>
          <button className="tut-close-btn" onClick={dismiss}><X size={15} /></button>
        </div>

        <div className="tut-welcome-body">
          <div className="tut-welcome-intro">
            本系統提供完整的工程監造作業流程支援，以下為主要功能模組概覽：
          </div>
          <div className="tut-feature-grid">
            {WELCOME_FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="tut-feature-card">
                <div className="tut-feature-icon"><Icon size={15} /></div>
                <div>
                  <div className="tut-feature-label">{label}</div>
                  <div className="tut-feature-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="tut-welcome-footer">
          <span className="tut-tip">各頁面右上角點擊 <HelpCircle size={12} style={{ verticalAlign: 'middle' }} /> 可查閱頁面說明</span>
          <button className="tut-start-btn" onClick={dismiss}>
            <CheckCircle2 size={14} />開始使用
          </button>
        </div>

      </div>
    </div>
  );
}

/* ── 頁面說明 ── */
export function HelpModal({ content, onClose }) {
  if (!content) return null;
  return (
    <div className="tut-overlay" onClick={onClose}>
      <div className="tut-modal tut-help" onClick={e => e.stopPropagation()}>

        <div className="tut-help-header">
          <HelpCircle size={15} style={{ color: 'var(--color-primary-light)', flexShrink: 0 }} />
          <span className="tut-help-title">使用說明 — {content.title}</span>
          <button className="tut-close-btn" onClick={onClose}><X size={15} /></button>
        </div>

        <div className="tut-help-body">
          {content.sections.map(section => (
            <div key={section.heading} className="tut-help-section">
              <div className="tut-help-section-heading">{section.heading}</div>
              <ul className="tut-help-list">
                {section.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
