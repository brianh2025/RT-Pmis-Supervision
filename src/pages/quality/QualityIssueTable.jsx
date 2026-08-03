import React, { useState } from 'react';
import { AlertTriangle, ClipboardCheck } from 'lucide-react';
import { SEVERITY_CONFIG, RESOLVE_STATUS } from './qualityConfig';

/* ── Mobile Card: 缺失改善 ── */
function MobileIssueCard({ row, selected, onToggleSel, onCycleStatus, onOpenVerify }) {
  const [expanded, setExpanded] = useState(false);
  const sevCfg = SEVERITY_CONFIG[row.severity] || SEVERITY_CONFIG.major;
  const resCfg = RESOLVE_STATUS[row.status] || RESOLVE_STATUS.open;
  const isOverdue = row.deadline && new Date(row.deadline) < new Date()
    && !['resolved', 'verified', 'waived'].includes(row.status);

  return (
    <div className={`mcs-mc${selected ? ' mcs-mc-sel' : ''}`}>
      <div className="mcs-mc-head" onClick={() => setExpanded(e => !e)}>
        <input type="checkbox" checked={selected} onChange={onToggleSel} onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }} />
        <span className="mcs-mc-date">{row.inspection_date || '—'}</span>
        <span className="mcs-mc-name">{row.item || '—'}</span>
        <span style={{ flexShrink: 0, padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
          color: sevCfg.color, background: sevCfg.bg, border: `1px solid ${sevCfg.color}40` }}>
          {sevCfg.label}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '14px', color: 'var(--color-text-muted)', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="mcs-mc-body">
          {[
            { label: '位置', value: row.location },
            { label: '缺失說明', value: row.description },
            { label: '責任廠商', value: row.responsible },
            { label: '改善期限', value: row.deadline, overdue: isOverdue },
            { label: '改善日期', value: row.resolve_date },
            { label: '備註', value: row.remark },
          ].filter(f => f.value).map(f => (
            <div key={f.label} className="mcs-mc-row">
              <span className="mcs-mc-label">{f.label}</span>
              <span className="mcs-mc-val" style={f.overdue ? { color: '#ef4444', fontWeight: 600 } : undefined}>{f.value}</span>
            </div>
          ))}
          <div className="mcs-mc-row" style={{ justifyContent: 'flex-end', alignItems: 'center' }}>
            {row.status === 'resolved' && (
              <button onClick={e => { e.stopPropagation(); onOpenVerify(row); }}
                style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                  background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer', marginRight: 'auto' }}>
                <ClipboardCheck size={11} />申請驗收
              </button>
            )}
            <span onClick={e => { e.stopPropagation(); onCycleStatus(row.id, row.status); }} title="點擊切換狀態"
              style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                color: resCfg.color, background: `${resCfg.color}15`, border: `1px solid ${resCfg.color}40` }}>
              {resCfg.label}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Tab 1: 缺失改善管制 ── */
export function QualityIssueTable({ isMobile, filteredIssues, selected, togSel, setSelected, cycleIssueStatus, openVerify, EditableCell }) {
  if (isMobile) {
    return (
      <div className="mcs-card-list">
        {filteredIssues.length === 0 ? (
          <div className="mcs-empty" style={{ padding: '32px 16px', textAlign: 'center' }}>
            <AlertTriangle size={28} style={{ opacity: 0.2, margin: '0 auto 8px', display: 'block' }} />
            <div>目前無品管缺失記錄 — 點擊「新增缺失」建立</div>
          </div>
        ) : filteredIssues.map(row => (
          <MobileIssueCard key={row.id}
            row={row}
            selected={selected.has(row.id)}
            onToggleSel={() => togSel(row.id)}
            onCycleStatus={cycleIssueStatus}
            onOpenVerify={openVerify}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="mcs-tbl-wrap">
      <table className="mcs-table">
        <thead>
          <tr>
            <th style={{ width: 28 }}>
              <input type="checkbox"
                checked={filteredIssues.length > 0 && selected.size === filteredIssues.length}
                onChange={() => setSelected(selected.size === filteredIssues.length ? new Set() : new Set(filteredIssues.map(r => r.id)))} />
            </th>
            <th style={{ width: 90 }}>查驗日期</th>
            <th style={{ width: 100 }}>位置</th>
            <th style={{ width: 160 }}>缺失項目</th>
            <th style={{ width: 80 }}>嚴重度</th>
            <th style={{ width: 200 }}>缺失說明</th>
            <th style={{ width: 80 }}>責任廠商</th>
            <th style={{ width: 90 }}>改善期限</th>
            <th style={{ width: 90 }}>狀態</th>
            <th style={{ width: 90 }}>改善日期</th>
            <th>備註</th>
          </tr>
        </thead>
        <tbody>
          {filteredIssues.length === 0 ? (
            <tr><td colSpan={11} className="mcs-empty">
              <AlertTriangle size={28} style={{ opacity: 0.2, margin: '0 auto 8px', display: 'block' }} />
              <div>目前無品管缺失記錄 — 點擊「新增缺失」建立</div>
            </td></tr>
          ) : filteredIssues.map(row => {
            const sevCfg = SEVERITY_CONFIG[row.severity] || SEVERITY_CONFIG.major;
            const resCfg = RESOLVE_STATUS[row.status] || RESOLVE_STATUS.open;
            const isOverdue = row.deadline && new Date(row.deadline) < new Date()
              && !['resolved', 'verified', 'waived'].includes(row.status);
            return (
              <tr key={row.id} className={selected.has(row.id) ? 'sel' : ''}
                style={isOverdue ? { background: 'rgba(239,68,68,0.03)' } : {}}>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={selected.has(row.id)} onChange={() => togSel(row.id)} />
                </td>
                <td style={{ padding: '2px 4px' }}>
                  {EditableCell({ id: row.id, field: 'inspection_date', table: 'quality_issues', val: row.inspection_date, type: 'date' })}
                </td>
                <td style={{ padding: '2px 4px' }}>
                  {EditableCell({ id: row.id, field: 'location', table: 'quality_issues', val: row.location })}
                </td>
                <td style={{ padding: '2px 4px' }}>
                  {EditableCell({ id: row.id, field: 'item', table: 'quality_issues', val: row.item })}
                </td>
                <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                  <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '4px', fontSize: '10px',
                    background: sevCfg.bg, color: sevCfg.color, border: `1px solid ${sevCfg.color}40` }}>
                    {sevCfg.label}
                  </span>
                </td>
                <td style={{ padding: '2px 4px' }}>
                  {EditableCell({ id: row.id, field: 'description', table: 'quality_issues', val: row.description })}
                </td>
                <td style={{ padding: '2px 4px' }}>
                  {EditableCell({ id: row.id, field: 'responsible', table: 'quality_issues', val: row.responsible })}
                </td>
                <td style={{ padding: '2px 4px' }}>
                  {EditableCell({ id: row.id, field: 'deadline', table: 'quality_issues', val: row.deadline, type: 'date' })}
                </td>
                <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                    <span onClick={() => cycleIssueStatus(row.id, row.status)} title="點擊切換狀態"
                      style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer',
                        color: resCfg.color, border: `1px solid ${resCfg.color}40`, background: `${resCfg.color}10` }}>
                      {resCfg.label}
                    </span>
                    {row.status === 'resolved' && (
                      <button onClick={() => openVerify(row)}
                        style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '1px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: 600,
                          background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer' }}>
                        <ClipboardCheck size={9} />申請驗收
                      </button>
                    )}
                  </div>
                </td>
                <td style={{ padding: '2px 4px' }}>
                  {EditableCell({ id: row.id, field: 'resolve_date', table: 'quality_issues', val: row.resolve_date, type: 'date' })}
                </td>
                <td style={{ padding: '2px 4px' }}>
                  {EditableCell({ id: row.id, field: 'remark', table: 'quality_issues', val: row.remark })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
