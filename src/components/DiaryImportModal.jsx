import React, { useState, useRef } from 'react';
import { X, FileSpreadsheet, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import '../components/Modal.css';

/**
 * Parse the "記事" sheet from the diary Excel.
 * Expected columns: A=序號, B=日期, C=天氣上午, D=天氣下午 (or merged B=天氣), D/E=施工項目, …
 * We detect by looking for a row where column values include '日期'.
 */
function parseDiarySheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  
  // Find header row (contains '日期')
  let headerIdx = rows.findIndex(r => r.some(c => String(c).includes('日期')));
  if (headerIdx === -1) headerIdx = 1; // fallback: row 2

  const headers = rows[headerIdx].map(c => String(c).trim());
  const dateCol      = headers.findIndex(h => h.includes('日期'));
  const weatherAmCol = headers.findIndex(h => h.includes('上午') || (h.includes('天氣') && !h.includes('下午')));
  const weatherPmCol = headers.findIndex(h => h.includes('下午'));
  const workCol      = headers.findIndex(h => h.includes('施工') || h.includes('項目'));
  const notesCol     = headers.findIndex(h => h.includes('記事') || h.includes('備註'));

  const records = [];
  for (let i = headerIdx + 2; i < rows.length; i++) {
    const row = rows[i];
    const rawDate = row[dateCol];
    if (!rawDate) continue;

    let logDate = null;
    if (rawDate instanceof Date) {
      logDate = rawDate.toISOString().split('T')[0];
    } else if (typeof rawDate === 'number') {
      const d = XLSX.SSF.parse_date_code(rawDate);
      if (d) logDate = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
    } else {
      const s = String(rawDate).trim().replace(/[年\/]/g,'-').replace(/月/g,'-').replace(/日/g,'');
      const d = new Date(s);
      if (!isNaN(d)) logDate = d.toISOString().split('T')[0];
    }

    if (!logDate) continue;

    records.push({
      log_date:   logDate,
      weather_am: weatherAmCol >= 0 ? String(row[weatherAmCol] ?? '').trim() || null : null,
      weather_pm: weatherPmCol >= 0 ? String(row[weatherPmCol] ?? '').trim() || null : null,
      work_items: workCol >= 0      ? String(row[workCol]      ?? '').trim() || null : null,
      notes:      notesCol >= 0     ? String(row[notesCol]     ?? '').trim() || null : null,
    });
  }
  return records;
}

export function DiaryImportModal({ projectId, onClose, onSuccess }) {
  const { user } = useAuth();
  const [rows, setRows]       = useState([]);
  const [errors, setErrors]   = useState([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [done, setDone]       = useState(false);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, { type: 'array', cellDates: true });

      // Find the sheet named '記事'
      const sheetName = wb.SheetNames.find(n => n.includes('記事')) ?? wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const parsed = parseDiarySheet(ws);
      const errs = parsed.length === 0 ? ['找不到有效記事資料，請確認使用「記事」分頁的格式'] : [];
      setRows(parsed);
      setErrors(errs);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    const payload = rows.map(r => ({
      ...r,
      project_id: projectId,
      created_by: user?.id ?? null,
    }));

    // Upsert to avoid duplicate date errors
    const { error } = await supabase
      .from('daily_logs')
      .upsert(payload, { onConflict: 'project_id,log_date' });

    setImporting(false);
    if (error) {
      setErrors(prev => [...prev, `匯入失敗：${error.message}`]);
    } else {
      setDone(true);
      setTimeout(() => { onSuccess?.(); onClose(); }, 1500);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel animate-slide-up" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div className="modal-title-group">
            <FileSpreadsheet size={18} className="modal-icon" />
            <div>
              <h2 className="modal-title">匯入施工日誌</h2>
              <p className="modal-subtitle">DIARY IMPORT — 記事分頁</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {done ? (
            <div className="import-success">
              <CheckCircle2 size={40} color="var(--color-success)" />
              <p>成功匯入 {rows.length} 筆日誌記錄！</p>
            </div>
          ) : (
            <>
              <div className="upload-zone" onClick={() => fileRef.current?.click()}>
                <Upload size={32} className="upload-icon" />
                <p className="upload-text">{fileName || '點擊上傳施工日誌 Excel 檔案'}</p>
                <p className="upload-hint">系統將自動讀取「記事」分頁 · 支援 .xlsx / .xlsm</p>
                <input type="file" accept=".xlsx,.xls,.xlsm" ref={fileRef} style={{ display: 'none' }} onChange={handleFile} />
              </div>

              {rows.length > 0 && (
                <>
                  <p className="preview-count">
                    預覽：找到 <strong>{rows.length}</strong> 筆記事資料
                  </p>
                  <div className="preview-table-wrapper">
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>日期</th><th>天氣(上/下)</th><th>施工項目</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 8).map((r, i) => (
                          <tr key={i}>
                            <td style={{ whiteSpace: 'nowrap' }}>{r.log_date}</td>
                            <td>{r.weather_am ?? '—'} / {r.weather_pm ?? '—'}</td>
                            <td style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.work_items ?? '—'}</td>
                          </tr>
                        ))}
                        {rows.length > 8 && (
                          <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>…共 {rows.length} 筆</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {errors.length > 0 && (
                <div className="import-errors">
                  <AlertTriangle size={14} /> {errors.join(' ∣ ')}
                </div>
              )}
            </>
          )}
        </div>

        {!done && (
          <div className="modal-actions">
            <button className="btn-modal-cancel" onClick={onClose}>取消</button>
            <button
              className="btn-modal-save"
              onClick={handleImport}
              disabled={rows.length === 0 || importing}
            >
              {importing ? '匯入中...' : `確認匯入 ${rows.length} 筆`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
