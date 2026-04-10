import React, { useState, Suspense } from 'react';
import { ClipboardList, BookOpen } from 'lucide-react';
import { DailyReportController } from './DailyReport/DailyReportController';
import { DiaryLog } from './DiaryLog';

export function DiaryJournal() {
  const [tab, setTab] = useState('diary');

  const tabs = [
    { key: 'diary',      label: '施工日誌', icon: ClipboardList },
    { key: 'supervision', label: '監造報表', icon: BookOpen },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 頁籤列 */}
      <div style={{
        display: 'flex', flexShrink: 0,
        borderBottom: '1px solid var(--color-surface-border)',
        background: 'var(--color-surface)',
        padding: '0 12px',
      }}>
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 16px',
              border: 'none', background: 'none', cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: tab === key ? 700 : 400,
              color: tab === key ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderBottom: tab === key
                ? '2px solid var(--color-primary)'
                : '2px solid transparent',
              marginBottom: -1,
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* 內容區 */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <Suspense fallback={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', fontSize: '13px' }}>
            載入中…
          </div>
        }>
          {tab === 'diary' ? <DailyReportController /> : <DiaryLog />}
        </Suspense>
      </div>
    </div>
  );
}
