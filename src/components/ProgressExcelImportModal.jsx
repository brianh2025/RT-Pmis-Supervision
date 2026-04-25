import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import ExcelJS from 'exceljs';
import { supabase } from '../lib/supabaseClient';
import './Modal.css';

function parseNum(v) {
  const n = parseFloat(String(v).replace('%', '').trim());
  return isNaN(n) ? null : n;
}

function parseDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw.toISOString().split('T')[0];
  let s = String(raw).trim().replace(/[年/]/g,'-').replace(/月/g,'-').replace(/日/g,'');
  const roc = s.match(/^(\d{2,3})-(\d{1,2})-(\d{1,2})/);
  if (roc && parseInt(roc[1]) < 1911)
    s = `${parseInt(roc[1])+1911}-${roc[2].padStart(2,'0')}-${roc[3].padStart(2,'0')}`;
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().split('T')[0];
}

function getCellValue(cell) {
  const val = cell.value;
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return val;
  if (typeof val === 'object') {
    if (val.richText) return val.richText.map(r => r.text).join('');
    if (val.result !== undefined) return val.result;
  }
  return val;
}

export function ProgressExcelImportModal({ projectId, onClose, onSuccess }) {
  const fileRef = useRef(null);
  const [rows, setRows] = useState(null);
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const ws = wb.worksheets[0];

      // 第一列為標題
      const headers = [];
      ws.getRow(1).eachCell((cell, colNum) => {
        headers[colNum - 1] = String(getCellValue(cell) ?? '').trim();
      });

      const parsed = [];
      const errs = [];

      ws.eachRow((row, rowNum) => {
        if (rowNum === 1) return;
        const rowObj = {};
        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
          const h = headers[colNum - 1];
          if (h) rowObj[h] = getCellValue(cell);
        });

        const keys = Object.keys(rowObj);
        const dateKey   = keys.find(k => /日期|date/i.test(k));
        const planKey   = keys.find(k => /預定|planned/i.test(k));
        const actualKey = keys.find(k => /實際|actual/i.test(k));
        const noteKey   = keys.find(k => /備|note/i.test(k));

        const d = parseDate(rowObj[dateKey]);
        const p = parseNum(rowObj[planKey]);
        const a = parseNum(rowObj[actualKey]);

        if (!d) { errs.push(`第 ${rowNum} 列：無法辨識日期`); return; }
        if (p === null || a === null) { errs.push(`第 ${rowNum} 列 (${d})：進度欄位無效`); return; }
        parsed.push({ report_date: d, planned_progress: p, actual_progress: a, notes: noteKey ? String(rowObj[noteKey]) : null });
      });

      setErrors(errs);
      setRows(parsed);
    } catch (err) {
      setErrors([`讀取失敗：${err.message}`]);
    }
  };

  const handleImport = async () => {
    if (!rows?.length) return;
    setImporting(true);
    const payload = rows.map(r => ({ ...r, project_id: projectId }));
    const { error } = await supabase
      .from('progress_records')
      .upsert(payload, { onConflict: 'project_id,report_date' });
    setImporting(false);
    if (error) {
      setErrors([`匯入失敗：${error.message}`]);
    } else {
      setDone(true);
      setTimeout(() => { onSuccess?.(); onClose(); }, 1500);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div>
              <h2 className="modal-title">匯入進度 Excel</h2>
              <p className="modal-subtitle">EXCEL IMPORT · PROGRESS RECORDS</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {done ? (
            <div className="import-success">
              <CheckCircle2 size={40} color="var(--color-success)" />
              <p>成功匯入 {rows.length} 筆進度紀錄！</p>
            </div>
          ) : (
            <>
              {!rows ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="upload-zone" onClick={() => fileRef.current?.click()}>
                    <Upload size={28} className="upload-icon" />
                    <p className="upload-text">點擊上傳進度 Excel 檔案</p>
                    <p className="upload-hint">支援 .xlsx / .xls / .xlsm｜欄位需含：日期、預定進度(%)、實際進度(%)</p>
                    <input type="file" accept=".xlsx,.xls,.xlsm" ref={fileRef} style={{ display: 'none' }} onChange={handleFile} />
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.6, padding: '10px 14px', background: 'var(--color-bg2)', borderRadius: '8px' }}>
                    <strong>欄位命名範例：</strong><br />
                    「報告日期」、「預定進度」、「實際進度」、「備註」
                  </div>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: '13px', color: 'var(--color-text2)', marginBottom: '10px' }}>
                    成功解析 <strong>{rows.length}</strong> 筆紀錄：
                  </p>
                  <div className="preview-table-wrapper" style={{ maxHeight: '260px' }}>
                    <table className="preview-table">
                      <thead>
                        <tr><th>日期</th><th>預定(%)</th><th>實際(%)</th><th>差異</th></tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => {
                          const diff = (r.actual_progress - r.planned_progress).toFixed(2);
                          return (
                            <tr key={i}>
                              <td>{r.report_date}</td>
                              <td>{r.planned_progress}%</td>
                              <td>{r.actual_progress}%</td>
                              <td style={{ color: parseFloat(diff) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                {parseFloat(diff) >= 0 ? '+' : ''}{diff}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {errors.length > 0 && (
                <div className="import-errors" style={{ marginTop: '12px' }}>
                  <AlertTriangle size={14} />
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem' }}>
                    {errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {!done && (
          <div className="modal-actions">
            <button className="btn-modal-cancel" onClick={onClose}>取消</button>
            {rows && rows.length > 0 && (
              <button className="btn-modal-save" onClick={handleImport} disabled={importing}>
                {importing ? '寫入中…' : `確認匯入 ${rows.length} 筆`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
