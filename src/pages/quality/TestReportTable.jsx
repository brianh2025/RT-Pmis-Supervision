import React, { useState } from 'react';
import { FlaskConical, CheckCircle2 } from 'lucide-react';
import { TEST_RESULT_CFG } from './qualityConfig';

/* ── Mobile Card: 試驗報告 ── */
function MobileTestCard({ row, selected, onToggleSel, onCycleResult }) {
  const [expanded, setExpanded] = useState(false);
  const resultKey = row.result || '待審閱';
  const cfg = TEST_RESULT_CFG[resultKey] || TEST_RESULT_CFG['待審閱'];

  return (
    <div className={`mcs-mc${selected ? ' mcs-mc-sel' : ''}`}>
      <div className="mcs-mc-head" onClick={() => setExpanded(e => !e)}>
        <input type="checkbox" checked={selected} onChange={onToggleSel} onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }} />
        <span className="mcs-mc-name">{row.name || '—'}</span>
        <span onClick={e => { e.stopPropagation(); onCycleResult(row.id, resultKey); }} title="點擊切換可入判定"
          style={{ flexShrink: 0, padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}40` }}>
          {resultKey}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '14px', color: 'var(--color-text-muted)', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="mcs-mc-body">
          {[
            { label: '契約項次', value: row.ci },
            { label: '抽樣頻率', value: row.freq },
            { label: '預定進場', value: row.p_date },
            { label: '實際進場', value: row.a_date },
            { label: '累積進場', value: row.cum_qty },
            { label: '累積抽樣', value: row.cum_smp },
            { label: '備註', value: row.remark },
          ].filter(f => f.value).map(f => (
            <div key={f.label} className="mcs-mc-row">
              <span className="mcs-mc-label">{f.label}</span>
              <span className="mcs-mc-val">{f.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Tab 2: 試驗報告管制 ── */
export function TestReportTable({ isMobile, filteredTests, selected, togSel, setSelected, cycleTestResult, EditableCell }) {
  if (isMobile) {
    return (
      <div className="mcs-card-list">
        {filteredTests.length === 0 ? (
          <div className="mcs-empty" style={{ padding: '32px 16px', textAlign: 'center' }}>
            <FlaskConical size={28} style={{ opacity: 0.2, margin: '0 auto 8px', display: 'block' }} />
            <div>尚無試驗報告記錄 — 請至「材料管制」頁面的「檢試驗管制表」新增資料</div>
          </div>
        ) : filteredTests.map(row => (
          <MobileTestCard key={row.id}
            row={row}
            selected={selected.has(row.id)}
            onToggleSel={() => togSel(row.id)}
            onCycleResult={cycleTestResult}
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
                checked={filteredTests.length > 0 && selected.size === filteredTests.length}
                onChange={() => setSelected(selected.size === filteredTests.length ? new Set() : new Set(filteredTests.map(r => r.id)))} />
            </th>
            <th style={{ width: 36 }}>#</th>
            <th style={{ width: 88 }}>契約項次</th>
            <th style={{ width: 180 }}>材料/設備名稱</th>
            <th style={{ width: 200 }}>抽樣頻率</th>
            <th style={{ width: 82 }}>預定進場</th>
            <th style={{ width: 82 }}>實際進場</th>
            <th style={{ width: 76 }}>累積進場</th>
            <th style={{ width: 72 }}>累積抽樣</th>
            <th style={{ width: 80 }}>可入判定</th>
            <th>備註</th>
          </tr>
        </thead>
        <tbody>
          {filteredTests.length === 0 ? (
            <tr><td colSpan={11} className="mcs-empty">
              <FlaskConical size={28} style={{ opacity: 0.2, margin: '0 auto 8px', display: 'block' }} />
              <div>尚無試驗報告記錄 — 請至「材料管制」頁面的「檢試驗管制表」新增資料</div>
            </td></tr>
          ) : filteredTests.map(row => {
            const resultKey = row.result || '待審閱';
            const cfg = TEST_RESULT_CFG[resultKey] || TEST_RESULT_CFG['待審閱'];
            return (
              <tr key={row.id} className={selected.has(row.id) ? 'sel' : ''}>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={selected.has(row.id)} onChange={() => togSel(row.id)} />
                </td>
                <td style={{ padding: '2px 6px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-text-muted)' }}>{row.no || '—'}</td>
                <td style={{ padding: '2px 4px' }}>
                  {EditableCell({ id: row.id, field: 'ci', table: 'mcs_test', val: row.ci })}
                </td>
                <td style={{ padding: '2px 4px' }}>
                  {EditableCell({ id: row.id, field: 'name', table: 'mcs_test', val: row.name })}
                </td>
                <td style={{ padding: '2px 4px' }}>
                  {EditableCell({ id: row.id, field: 'freq', table: 'mcs_test', val: row.freq })}
                </td>
                <td style={{ padding: '2px 4px' }}>
                  {EditableCell({ id: row.id, field: 'p_date', table: 'mcs_test', val: row.p_date })}
                </td>
                <td style={{ padding: '2px 4px' }}>
                  {EditableCell({ id: row.id, field: 'a_date', table: 'mcs_test', val: row.a_date })}
                </td>
                <td style={{ padding: '2px 4px' }}>
                  {EditableCell({ id: row.id, field: 'cum_qty', table: 'mcs_test', val: row.cum_qty })}
                </td>
                <td style={{ padding: '2px 4px' }}>
                  {EditableCell({ id: row.id, field: 'cum_smp', table: 'mcs_test', val: row.cum_smp })}
                </td>
                <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                  <span onClick={() => cycleTestResult(row.id, resultKey)} title="點擊切換可入判定"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 600,
                      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}40` }}>
                    {resultKey === '可入' && <CheckCircle2 size={10} />}
                    {resultKey}
                  </span>
                </td>
                <td style={{ padding: '2px 4px' }}>
                  {EditableCell({ id: row.id, field: 'remark', table: 'mcs_test', val: row.remark })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
