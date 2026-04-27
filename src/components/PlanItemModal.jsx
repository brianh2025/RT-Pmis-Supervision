/* ============================================================
   PlanItemModal.jsx — 監造計畫定項 Modal
   mode="submission"：表 5.3-1 材料設備送審管制總表
   mode="test"      ：表 5.3-4 材料設備檢試驗管制總表
   ============================================================ */
import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Save, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

/* ── 欄位定義（與 PDF 原表完全對應） ── */
const SUB_COLS = [
  { k: 'ci',      l: '契約項次',       w: 100, type: 'text' },
  { k: 'name',    l: '材料/設備名稱',   w: 180, type: 'text' },
  { k: 'qty',     l: '契約數量',        w: 80,  type: 'text' },
  { k: 'test',    l: '取樣試驗',        w: 60,  type: 'toggle', opts: ['V', 'X'] },
  { k: 'p_date',  l: '預定送審日期',    w: 110, type: 'date' },
  { k: 'factory', l: '驗廠',           w: 55,  type: 'toggle', opts: ['是', '否'] },
  { k: 'vendor',  l: '廠商資料',        w: 55,  type: 'toggle', opts: ['V', ''] },
  { k: 'cat',     l: '型錄',           w: 45,  type: 'toggle', opts: ['V', ''] },
  { k: 'rpt',     l: '試驗報告',        w: 55,  type: 'toggle', opts: ['V', ''] },
  { k: 'smp',     l: '樣品',           w: 45,  type: 'toggle', opts: ['V', ''] },
  { k: 'other',   l: '其他',           w: 160, type: 'text' },
];

const TST_COLS = [
  { k: 'ci',     l: '契約項次',        w: 100, type: 'text' },
  { k: 'name',   l: '材料/設備名稱',    w: 160, type: 'text' },
  { k: 'qty',    l: '契約數量',         w: 80,  type: 'text' },
  { k: 'p_date', l: '預定進場日期',     w: 110, type: 'date' },
  { k: 's_qty',  l: '試驗數量',         w: 70,  type: 'text' },
  { k: 'freq',   l: '規定抽樣頻率',     w: 220, type: 'textarea' },
];

const SUB_DEFAULTS = { test: 'V', vendor: 'V', rpt: 'V' };

function makeRow(mode) {
  const defaults = mode === 'submission' ? SUB_DEFAULTS : {};
  const cols = mode === 'submission' ? SUB_COLS : TST_COLS;
  const row = { _uid: crypto.randomUUID() };
  cols.forEach(c => { row[c.k] = defaults[c.k] ?? ''; });
  return row;
}

function ToggleBadge({ val, opts, onChange }) {
  const v = val || opts[0];
  const idx = opts.indexOf(v);
  const next = opts[(idx + 1) % opts.length];
  let bg = 'var(--color-border)';
  let color = 'var(--color-text-secondary)';
  if (v === 'V') { bg = 'var(--color-success)'; color = '#fff'; }
  else if (v === '是') { bg = '#1d4ed8'; color = '#fff'; }
  else if (v === 'X') { bg = 'var(--color-danger)'; color = '#fff'; }
  return (
    <span
      onClick={() => onChange(next)}
      style={{
        display: 'inline-block', minWidth: 28, padding: '2px 6px', borderRadius: 4,
        background: bg, color, fontSize: '0.78rem', fontWeight: 700,
        cursor: 'pointer', userSelect: 'none', textAlign: 'center',
      }}
    >
      {v || '—'}
    </span>
  );
}

export function PlanItemModal({ mode, project, pdfUrl, onClose, onSaved }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([makeRow(mode)]);
  const [saving, setSaving] = useState(false);
  const [existingCount, setExistingCount] = useState(0);
  const tableRef = useRef(null);

  const cols = mode === 'submission' ? SUB_COLS : TST_COLS;
  const dbTable = mode === 'submission' ? 'mcs_submission' : 'mcs_test';
  const title = mode === 'submission' ? '表 5.3-1 材料設備送審管制總表定項' : '表 5.3-4 材料設備檢試驗管制總表定項';

  useEffect(() => {
    async function loadCount() {
      if (!supabase || !project?.id) return;
      const { count } = await supabase.from(dbTable).select('id', { count: 'exact', head: true }).eq('project_id', project.id);
      setExistingCount(count || 0);
    }
    loadCount();
  }, [dbTable, project?.id]);

  function updateCell(uid, key, val) {
    setRows(prev => prev.map(r => r._uid === uid ? { ...r, [key]: val } : r));
  }

  function addRow() {
    setRows(prev => [...prev, makeRow(mode)]);
    setTimeout(() => {
      const tbl = tableRef.current;
      if (tbl) tbl.scrollTop = tbl.scrollHeight;
    }, 50);
  }

  function deleteRow(uid) {
    setRows(prev => prev.length <= 1 ? [makeRow(mode)] : prev.filter(r => r._uid !== uid));
  }

  function handleKeyDown(e, rowIdx, colIdx) {
    if (e.key !== 'Tab') return;
    const isLast = colIdx === cols.length - 1;
    const isLastRow = rowIdx === rows.length - 1;
    if (isLast && isLastRow) {
      e.preventDefault();
      setRows(prev => [...prev, makeRow(mode)]);
      setTimeout(() => {
        const inputs = tableRef.current?.querySelectorAll('input:not([type=checkbox]), textarea');
        if (inputs?.length) inputs[inputs.length - 1]?.focus();
      }, 50);
    }
  }

  async function handleSave() {
    const filled = rows.filter(r => r.name?.trim() || r.ci?.trim());
    if (!filled.length) { alert('請至少輸入一筆資料（填寫材料名稱或契約項次）'); return; }
    if (!supabase || !project?.id) return;
    setSaving(true);
    try {
      const inserts = filled.map((r, idx) => {
        const row = { project_id: project.id, created_by: user?.id, sort_order: existingCount + idx };
        cols.forEach(c => { row[c.k] = r[c.k] ?? ''; });
        return row;
      });
      const { error } = await supabase.from(dbTable).insert(inserts);
      if (error) throw error;
      onSaved?.();
    } catch (err) {
      alert(`儲存失敗：${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--color-surface)', borderRadius: 12,
        boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
        width: '96vw', maxWidth: 1200, maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>{title}</span>
            {existingCount > 0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', background: 'var(--color-bg)', padding: '2px 8px', borderRadius: 10 }}>
                現有 {existingCount} 筆，此次將額外新增
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{
                display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem',
                color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600,
              }}>
                <ExternalLink size={13} /> 查看監造計畫 PDF
              </a>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4 }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div ref={tableRef} style={{ flex: 1, overflow: 'auto', padding: '0 4px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ width: 32, padding: '8px 4px', borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>#</th>
                {cols.map(c => (
                  <th key={c.k} style={{ width: c.w, minWidth: c.w, padding: '8px 6px', borderBottom: '2px solid var(--color-border)', textAlign: 'center', color: 'var(--color-text)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {c.l}
                  </th>
                ))}
                <th style={{ width: 36, borderBottom: '2px solid var(--color-border)' }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={row._uid} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.72rem', padding: '4px 2px' }}>{rowIdx + 1}</td>
                  {cols.map((c, colIdx) => (
                    <td key={c.k} style={{ padding: '3px 4px', verticalAlign: 'middle' }}>
                      {c.type === 'toggle' ? (
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <ToggleBadge val={row[c.k]} opts={c.opts} onChange={v => updateCell(row._uid, c.k, v)} />
                        </div>
                      ) : c.type === 'textarea' ? (
                        <textarea
                          value={row[c.k]}
                          onChange={e => updateCell(row._uid, c.k, e.target.value)}
                          onKeyDown={e => handleKeyDown(e, rowIdx, colIdx)}
                          rows={2}
                          style={{
                            width: '100%', boxSizing: 'border-box', resize: 'vertical',
                            fontSize: '0.78rem', border: '1px solid var(--color-border)',
                            borderRadius: 4, padding: '4px 6px',
                            background: 'var(--color-input-bg)', color: 'var(--color-text)',
                          }}
                        />
                      ) : (
                        <input
                          type={c.type === 'date' ? 'date' : 'text'}
                          value={row[c.k]}
                          onChange={e => updateCell(row._uid, c.k, e.target.value)}
                          onKeyDown={e => handleKeyDown(e, rowIdx, colIdx)}
                          style={{
                            width: '100%', boxSizing: 'border-box', fontSize: '0.8rem',
                            border: '1px solid var(--color-border)', borderRadius: 4, padding: '4px 6px',
                            background: 'var(--color-input-bg)', color: 'var(--color-text)',
                          }}
                        />
                      )}
                    </td>
                  ))}
                  <td style={{ textAlign: 'center', padding: '3px 4px' }}>
                    <button onClick={() => deleteRow(row._uid)} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--color-danger)', padding: '2px 4px', borderRadius: 4,
                    }}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', borderTop: '1px solid var(--color-border)', flexShrink: 0,
        }}>
          <button onClick={addRow} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
            background: 'var(--color-bg)', border: '1px solid var(--color-border)',
            borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--color-text)',
          }}>
            <Plus size={14} /> 新增列
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{
              padding: '6px 16px', background: 'var(--color-bg)', border: '1px solid var(--color-border)',
              borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--color-text)',
            }}>
              取消
            </button>
            <button onClick={handleSave} disabled={saving} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px',
              background: 'var(--color-primary)', color: '#fff', border: 'none',
              borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.82rem', fontWeight: 600,
              opacity: saving ? 0.7 : 1,
            }}>
              {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
              儲存所有項目
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
