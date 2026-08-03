/* 品質管理三個管制表（施工檢驗／缺失改善／試驗報告）共用的顯示設定常數 */

export const SEVERITY_CONFIG = {
  critical:    { label: '重大缺失', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  major:       { label: '一般缺失', color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  minor:       { label: '輕微缺失', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  observation: { label: '觀察項目', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
};

export const RESOLVE_STATUS = {
  open:        { label: '待改善', color: '#ef4444' },
  in_progress: { label: '改善中', color: '#f59e0b' },
  resolved:    { label: '已改善', color: '#10b981' },
  verified:    { label: '已驗收', color: '#6366f1' },
  waived:      { label: '免改善', color: '#6b7280' },
};
export const RESOLVE_CYCLE = ['open', 'in_progress', 'resolved', 'verified', 'waived'];

export const INSPECT_RESULT = {
  '合格':  { color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  '不合格': { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  '待複驗': { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
};
export const RESULT_CYCLE = ['合格', '不合格', '待複驗'];

export const TEST_RESULT_CYCLE = ['待審閱', '審閱中', '可入', '不可入'];
export const TEST_RESULT_CFG = {
  '待審閱': { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  '審閱中': { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  '可入':   { color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  '不可入': { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};
