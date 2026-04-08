import React, { useState } from 'react';
import { X, RefreshCw, CheckCircle2, AlertTriangle, Loader2, CloudDownload } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import './Modal.css';

const EDGE_FN_URL = 'https://xbdchvmxgmypcyawavju.supabase.co/functions/v1/sync-diary';

export function DriveSyncModal({ projectId, startDate, onClose, onSuccess }) {
  const today = new Date().toISOString().split('T')[0];
  const [rangeStart, setRangeStart] = useState(startDate || '');
  const [rangeEnd,   setRangeEnd]   = useState(today);
  const [running,    setRunning]    = useState(false);
  const [results,    setResults]    = useState(null);
  const [error,      setError]      = useState('');

  const handleSync = async () => {
    if (!rangeStart) { setError('請選擇起始日期'); return; }
    setRunning(true);
    setError('');
    setResults(null);

    // 取得 SYNC_SECRET（從 Supabase Function 的 anon key 呼叫，secret 由後端驗證）
    // 前端只需傳 mode=batch + projectId + 日期範圍，secret 由環境變數注入
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(EDGE_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          mode: 'batch',
          projectId,
          startDate: rangeStart,
          endDate:   rangeEnd,
          secret:    import.meta.env.VITE_SYNC_SECRET || '',
        }),
      });

      const json = await res.json();
      if (!res.ok) { setError(json.error || `HTTP ${res.status}`); return; }
      setResults(json);
      onSuccess?.();
    } catch (err) {
      setError(String(err));
    } finally {
      setRunning(false);
    }
  };

  const successCount = results?.results?.filter(r => r.success).length ?? 0;
  const failCount    = results?.results?.filter(r => !r.success).length ?? 0;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel animate-slide-up" style={{ maxWidth: 540 }}>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <CloudDownload size={17} className="modal-icon" />
            <div>
              <h2 className="modal-title">從 Google Drive 回朔同步</h2>
              <p className="modal-subtitle">批次下載並解析廠商施工日誌 Excel</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 日期範圍 */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">起始日期（最早可回溯至開工日）</label>
              <input
                type="date"
                className="form-input"
                value={rangeStart}
                onChange={e => setRangeStart(e.target.value)}
                style={{ marginTop: 4 }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label">結束日期</label>
              <input
                type="date"
                className="form-input"
                value={rangeEnd}
                max={today}
                onChange={e => setRangeEnd(e.target.value)}
                style={{ marginTop: 4 }}
              />
            </div>
          </div>

          {/* 說明 */}
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.7, background: 'var(--color-surface-hover)', borderRadius: 8, padding: '10px 12px' }}>
            系統將掃描 Google Drive 工程資料夾內 <strong>施工日誌/施工日誌-*.xlsx</strong> 檔案，
            解析填表日期、天氣、施工工項、預定/實際進度，並同步寫入：
            <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
              <li>監造報表（daily_logs）</li>
              <li>進度管理（progress_records）</li>
              <li>施工日誌工項（daily_report_items）</li>
            </ul>
            同日期資料將覆蓋舊紀錄（增量校正）。
          </div>

          {/* 結果 */}
          {results && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 12, fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={13} /> 成功 {successCount} 筆
                </span>
                {failCount > 0 && (
                  <span style={{ color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={13} /> 失敗 {failCount} 筆
                  </span>
                )}
              </div>
              {results.results?.length > 0 && (
                <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: '0.74rem', borderRadius: 6, border: '1px solid var(--color-surface-border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-surface-hover)' }}>
                        <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 600 }}>檔案</th>
                        <th style={{ padding: '5px 8px', textAlign: 'center' }}>日期</th>
                        <th style={{ padding: '5px 8px', textAlign: 'center' }}>工項</th>
                        <th style={{ padding: '5px 8px', textAlign: 'center' }}>狀態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.results.map((r, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--color-surface-border)' }}>
                          <td style={{ padding: '4px 8px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.file}</td>
                          <td style={{ padding: '4px 8px', textAlign: 'center' }}>{r.date ?? '—'}</td>
                          <td style={{ padding: '4px 8px', textAlign: 'center' }}>{r.itemCount ?? 0}</td>
                          <td style={{ padding: '4px 8px', textAlign: 'center', color: r.success ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {r.success ? '✓' : '✗'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {results.total === 0 && (
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  Drive 資料夾內未找到符合條件的施工日誌檔案。
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{ color: 'var(--color-danger)', fontSize: '0.78rem', padding: '8px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 6, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
              {error}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-modal-cancel" onClick={onClose} disabled={running}>關閉</button>
          <button className="btn-modal-save" onClick={handleSync} disabled={running || !rangeStart}>
            {running
              ? <><Loader2 size={14} className="animate-spin" /> 同步中…</>
              : <><RefreshCw size={14} /> 開始回朔同步</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
