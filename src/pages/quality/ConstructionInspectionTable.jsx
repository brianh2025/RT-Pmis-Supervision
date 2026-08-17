import React, { useState } from 'react';
import { ShieldCheck, Camera, FileText, Printer, Trash2, Pencil } from 'lucide-react';
import { INSPECT_RESULT, RESOLVE_STATUS, FORM_STATUS, ISSUE_OVERDUE_DAYS } from './qualityConfig';

/* 已發出未回收天數：逾 ISSUE_OVERDUE_DAYS 天轉紅 */
function issuedDays(row) {
  const base = row.planned_date || row.inspect_date;
  if (!base) return 0;
  return Math.floor((Date.now() - new Date(base).getTime()) / 86400000);
}

/* 待回收狀態標籤（已回收的紀錄不顯示，維持原有版面密度） */
function FormStatusBadge({ row }) {
  if (row.form_status !== 'issued') return null;
  const days = issuedDays(row);
  const overdue = days >= ISSUE_OVERDUE_DAYS;
  const color = overdue ? '#ef4444' : FORM_STATUS.issued.color;
  return (
    <span title={`發出後已 ${days} 天未回收`}
      style={{ display: 'inline-block', padding: '1px 5px', borderRadius: 3, fontSize: '10px', fontWeight: 700,
        color, background: `${color}1a`, border: `1px solid ${color}59`, whiteSpace: 'nowrap' }}>
      待回收{days > 0 ? ` ${days}天` : ''}
    </span>
  );
}

/* ── Mobile Card: 施工檢驗 ── */
function MobileInspCard({ row, inspPhotoMap, issueByInspMap, navigate, projectId, selected, onToggleSel, onCycleResult, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const resCfg = INSPECT_RESULT[row.result] || INSPECT_RESULT['待複驗'];
  const iss = issueByInspMap[row.id];
  const issueCfg = iss ? (RESOLVE_STATUS[iss.status] || RESOLVE_STATUS.open) : null;
  const issueClosed = iss && (iss.status === 'verified' || iss.status === 'waived');
  const photoCount = inspPhotoMap[row.id] || 0;

  return (
    <div className={`mcs-mc${selected ? ' mcs-mc-sel' : ''}`}>
      <div className="mcs-mc-head" onClick={() => setExpanded(e => !e)}>
        <input type="checkbox" checked={selected} onChange={onToggleSel} onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }} />
        <span className="mcs-mc-date">{row.inspect_date || '—'}</span>
        <button className="mcs-photo-btn" title="照片"
          onClick={e => { e.stopPropagation(); navigate(`/projects/${projectId}/photos?src_table=construction_inspections&src_id=${row.id}&src_name=${encodeURIComponent((row.work_item || '施工抽查') + (row.location ? ' ' + row.location : ''))}`); }}>
          <Camera size={11} />{photoCount > 0 ? photoCount : ''}
        </button>
        <span className="mcs-mc-name">{row.work_item || '—'}</span>
        {row.form_status === 'issued' ? (
          <FormStatusBadge row={row} />
        ) : (
          <span onClick={e => { e.stopPropagation(); onCycleResult(row.id, row.result); }}
            style={{ flexShrink: 0, padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              color: resCfg.color, background: resCfg.bg, border: `1px solid ${resCfg.color}40` }}>
            {row.result || '待複驗'}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '14px', color: 'var(--color-text-muted)', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="mcs-mc-body">
          {[
            { label: '工程位置及部位', value: row.location },
            { label: '檢驗類型', value: row.inspect_type },
            { label: '人員', value: row.inspector },
            { label: '缺失狀態', value: iss ? (issueClosed ? '✅ 結案' : issueCfg?.label) : (row.result === '不合格' ? '無缺失單' : null) },
            { label: '備註', value: row.remark },
          ].filter(f => f.value).map(f => (
            <div key={f.label} className="mcs-mc-row">
              <span className="mcs-mc-label">{f.label}</span>
              <span className="mcs-mc-val">{f.value}</span>
            </div>
          ))}
          {/* 編輯入口：開啟標準抽查單 Modal 編修本筆內容 */}
          <div className="mcs-mc-row" style={{ justifyContent: 'flex-end' }}>
            <button className="mcs-btn mcs-btn-add" onClick={e => { e.stopPropagation(); onEdit(row); }}>
              <Pencil size={12} /> 編輯內容
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Tab 0: 施工檢驗管制 ── */
export function ConstructionInspectionTable({
  isMobile, filteredInsp, inspPhotoMap, issueByInspMap, navigate, projectId,
  selected, togSel, setSelected, cycleInspResult, setFormRow, setPrintRow, deleteOneInsp, EditableCell,
}) {
  if (isMobile) {
    return (
      <div className="mcs-card-list">
        {filteredInsp.length === 0 ? (
          <div className="mcs-empty" style={{ padding: '32px 16px', textAlign: 'center' }}>
            <ShieldCheck size={28} style={{ opacity: 0.2, margin: '0 auto 8px', display: 'block' }} />
            <div>尚無施工檢驗記錄 — 點擊「新增檢驗」建立</div>
          </div>
        ) : filteredInsp.map(row => (
          <MobileInspCard key={row.id}
            row={row}
            inspPhotoMap={inspPhotoMap}
            issueByInspMap={issueByInspMap}
            navigate={navigate}
            projectId={projectId}
            selected={selected.has(row.id)}
            onToggleSel={() => togSel(row.id)}
            onCycleResult={cycleInspResult}
            onEdit={setFormRow}
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
                checked={filteredInsp.length > 0 && selected.size === filteredInsp.length}
                onChange={() => setSelected(selected.size === filteredInsp.length ? new Set() : new Set(filteredInsp.map(r => r.id)))} />
            </th>
            <th style={{ width: 90 }}>檢驗日期</th>
            <th>工程項目</th>
            <th style={{ width: 150 }}>工程位置及部位</th>
            <th style={{ width: 100 }}>檢驗類型</th>
            <th style={{ width: 90 }}>人員</th>
            <th style={{ width: 80 }}>結果</th>
            <th style={{ width: 90 }}>缺失狀態</th>
            <th style={{ width: 52 }}>照片</th>
            <th style={{ width: 96 }}></th>
            <th style={{ width: 120 }}>備註</th>
          </tr>
        </thead>
        <tbody>
          {filteredInsp.length === 0 ? (
            <tr><td colSpan={11} className="mcs-empty">
              <ShieldCheck size={28} style={{ opacity: 0.2, margin: '0 auto 8px', display: 'block' }} />
              <div>尚無施工檢驗記錄 — 點擊「新增檢驗」建立</div>
            </td></tr>
          ) : filteredInsp.map(row => {
            const resCfg = INSPECT_RESULT[row.result] || INSPECT_RESULT['待複驗'];
            return (
              <tr key={row.id} className={selected.has(row.id) ? 'sel' : ''}>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={selected.has(row.id)} onChange={() => togSel(row.id)} />
                </td>
                <td style={{ padding: '2px 4px' }}>
                  {EditableCell({ id: row.id, field: 'inspect_date', table: 'construction_inspections', val: row.inspect_date, type: 'date' })}
                </td>
                <td style={{ padding: '2px 4px' }}>
                  {EditableCell({ id: row.id, field: 'work_item', table: 'construction_inspections', val: row.work_item })}
                </td>
                <td style={{ padding: '2px 4px' }}>
                  {EditableCell({ id: row.id, field: 'location', table: 'construction_inspections', val: row.location })}
                </td>
                <td style={{ padding: '2px 4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {row.inspect_category === '材料檢驗' && (
                      <span style={{ flexShrink: 0, padding: '1px 4px', borderRadius: 3, fontSize: '10px', fontWeight: 700,
                        color: '#10b981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)' }}>材</span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {EditableCell({ id: row.id, field: 'inspect_type', table: 'construction_inspections', val: row.inspect_type })}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '2px 4px' }}>
                  {EditableCell({ id: row.id, field: 'inspector', table: 'construction_inspections', val: row.inspector })}
                </td>
                <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                  {row.form_status === 'issued' ? (
                    <FormStatusBadge row={row} />
                  ) : (
                    <span onClick={() => cycleInspResult(row.id, row.result)} title="點擊切換結果"
                      style={{ display: 'inline-block', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 600,
                        color: resCfg.color, background: resCfg.bg, border: `1px solid ${resCfg.color}40` }}>
                      {row.result || '待複驗'}
                    </span>
                  )}
                </td>
                <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                  {(() => {
                    const iss = issueByInspMap[row.id];
                    if (!iss) return row.result === '不合格' ? <span style={{ fontSize: '10px', color: '#94a3b8' }}>無缺失單</span> : null;
                    const cfg = RESOLVE_STATUS[iss.status] || RESOLVE_STATUS.open;
                    const closed = iss.status === 'verified' || iss.status === 'waived';
                    return (
                      <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                        color: cfg.color, background: `${cfg.color}15`, border: `1px solid ${cfg.color}40` }}>
                        {closed ? '✅ 結案' : cfg.label}
                      </span>
                    );
                  })()}
                </td>
                <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                  <button className="mcs-photo-btn" title="點擊查看/上傳照片記錄"
                    onClick={() => navigate(`/projects/${projectId}/photos?src_table=construction_inspections&src_id=${row.id}&src_name=${encodeURIComponent((row.work_item || '施工抽查') + (row.location ? ' ' + row.location : ''))}`)}>
                    <Camera size={11} />
                    {inspPhotoMap[row.id] > 0 ? inspPhotoMap[row.id] : ''}
                  </button>
                </td>
                <td style={{ padding: '2px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <button className="mcs-photo-btn" title="填寫標準抽查單" onClick={() => setFormRow(row)}>
                    <FileText size={11} />
                  </button>
                  <button className="mcs-photo-btn" title="列印抽查單" onClick={() => setPrintRow(row)}>
                    <Printer size={11} />
                  </button>
                  <button className="mcs-photo-btn" title="刪除這筆記錄" style={{ color: '#ef4444' }}
                    onClick={() => deleteOneInsp(row)}>
                    <Trash2 size={11} />
                  </button>
                </td>
                <td style={{ padding: '2px 4px' }}>
                  {EditableCell({ id: row.id, field: 'remark', table: 'construction_inspections', val: row.remark })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
