import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import './Modal.css';

const COLUMN_MAP = {
  '工程名稱': 'name',
  '施工地點': 'location',
  '承包商':   'contractor',
  '狀態':     'status',
  '開工日期': 'start_date',
  '預計完工': 'end_date',
  '預算萬元': 'budget',
  '預算元':   'budget',
};

const STATUS_MAP = {
  '執行中': 'active', '進行中': 'active', 'active': 'active',
  '已完工': 'completed', '完工': 'completed', 'completed': 'completed',
  '暫停': 'suspended', '暫停中': 'suspended', 'suspended': 'suspended',
};

function getCellValue(cell) {
  const val = cell.value;
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return val;
  if (typeof val === 'object') {
    if (val.richText) return val.richText.map(r => r.text).join('');
    if (val.result !== undefined) return val.result;
    if (val.text !== undefined) return val.text;
  }
  return val;
}

function parseExcelDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  const s = String(val).trim().replace(/[年/]/g, '-').replace(/月/g, '-').replace(/日/g, '');
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().split('T')[0];
}

export function ExcelImportModal({ onClose, onSuccess }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const buf = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.worksheets[0];

    const headers = [];
    ws.getRow(1).eachCell((cell, colNum) => {
      headers[colNum] = String(getCellValue(cell) ?? '').trim();
    });

    const parsed = [];
    const errs = [];

    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const rowObj = {};
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        const headerName = headers[colNum];
        if (!headerName) return;
        const dbField = COLUMN_MAP[headerName];
        if (dbField) {
          const val = getCellValue(cell);
          rowObj[dbField] = (headerName === '預算萬元' && val) ? parseFloat(val) * 10000 : val;
        }
      });

      if (!rowObj.name || !String(rowObj.name).trim()) {
        errs.push(`第 ${rowNum} 行：「工程名稱」為空，已略過`);
        return;
      }

      parsed.push({
        name:       String(rowObj.name).trim(),
        location:   rowObj.location   ? String(rowObj.location).trim()   : null,
        contractor: rowObj.contractor ? String(rowObj.contractor).trim() : null,
        status:     STATUS_MAP[String(rowObj.status || '').trim()] ?? 'active',
        start_date: parseExcelDate(rowObj.start_date),
        end_date:   parseExcelDate(rowObj.end_date),
        budget:     rowObj.budget ? parseFloat(rowObj.budget) : null,
        created_by: user?.id ?? null,
      });
    });

    setRows(parsed);
    setErrors(errs);
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    const { error } = await supabase.from('projects').insert(rows);
    setImporting(false);
    if (error) {
      setErrors((prev) => [...prev, `匯入失敗：${error.message}`]);
    } else {
      setDone(true);
      setTimeout(() => { onSuccess?.(); onClose(); }, 1500);
    }
  };

  const downloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('工程清單');
    ws.columns = [
      { header: '工程名稱', key: '工程名稱', width: 30 },
      { header: '施工地點', key: '施工地點', width: 20 },
      { header: '承包商',   key: '承包商',   width: 20 },
      { header: '狀態',     key: '狀態',     width: 10 },
      { header: '開工日期', key: '開工日期', width: 14 },
      { header: '預計完工', key: '預計完工', width: 14 },
      { header: '預算萬元', key: '預算萬元', width: 12 },
    ];
    ws.addRow({
      工程名稱: '虎尾鎮排水整治工程',
      施工地點: '虎尾鎮光復路沿線',
      承包商:   '中興土木工程公司',
      狀態:     '執行中',
      開工日期: '2025-10-15',
      預計完工: '2026-08-31',
      預算萬元: 5200,
    });
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), 'PMIS工程匯入範本.xlsx');
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel animate-slide-up" style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <div className="modal-title-group">
            <FileSpreadsheet size={18} className="modal-icon" />
            <div>
              <h2 className="modal-title">Excel 匯入工程</h2>
              <p className="modal-subtitle">EXCEL IMPORT</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {done ? (
            <div className="import-success">
              <CheckCircle2 size={40} color="var(--color-success)" />
              <p>成功匯入 {rows.length} 筆工程資料！</p>
            </div>
          ) : (
            <>
              <div
                className="upload-zone"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={32} className="upload-icon" />
                <p className="upload-text">
                  {fileName ? fileName : '點擊或拖曳 Excel 檔案至此'}
                </p>
                <p className="upload-hint">支援 .xlsx / .xls / .xlsm 格式</p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.xlsm"
                  ref={fileRef}
                  style={{ display: 'none' }}
                  onChange={handleFile}
                />
              </div>

              <button className="btn-template" onClick={downloadTemplate}>
                ⬇ 下載 Excel 範本
              </button>

              {rows.length > 0 && (
                <>
                  <p className="preview-count">
                    預覽：找到 <strong>{rows.length}</strong> 筆工程資料
                    {errors.length > 0 && `，略過 ${errors.length} 筆`}
                  </p>
                  <div className="preview-table-wrapper">
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>工程名稱</th>
                          <th>地點</th>
                          <th>承包商</th>
                          <th>狀態</th>
                          <th>完工日</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i}>
                            <td>{r.name}</td>
                            <td>{r.location ?? '—'}</td>
                            <td>{r.contractor ?? '—'}</td>
                            <td>{r.status}</td>
                            <td>{r.end_date ?? '—'}</td>
                          </tr>
                        ))}
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
