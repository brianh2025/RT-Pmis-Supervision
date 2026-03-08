import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import './Modal.css';

/** Expected Excel column headers → DB field mapping */
const COLUMN_MAP = {
  '工程名稱': 'name',
  '施工地點': 'location',
  '承包商':   'contractor',
  '狀態':     'status',
  '開工日期': 'start_date',
  '預計完工': 'end_date',
  '預算萬元': 'budget',
};

const STATUS_MAP = {
  '執行中': 'active', '進行中': 'active', 'active': 'active',
  '已完工': 'completed', '完工': 'completed', 'completed': 'completed',
  '暫停': 'suspended', '暫停中': 'suspended', 'suspended': 'suspended',
};

function parseExcelDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  // String: try to normalize
  const s = String(val).trim().replace(/[年\/]/g, '-').replace(/月/g, '-').replace(/日/g, '');
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

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const parsed = [];
      const errs = [];

      raw.forEach((rowRaw, idx) => {
        const row = {};
        Object.entries(rowRaw).forEach(([key, val]) => {
          const trimmedKey = key.trim();
          const dbField = COLUMN_MAP[trimmedKey];
          if (dbField) row[dbField] = val;
        });

        if (!row.name || !String(row.name).trim()) {
          errs.push(`第 ${idx + 2} 行：「工程名稱」為空，已略過`);
          return;
        }

        parsed.push({
          name:        String(row.name).trim(),
          location:    row.location  ? String(row.location).trim()  : null,
          contractor:  row.contractor ? String(row.contractor).trim() : null,
          status:      STATUS_MAP[String(row.status || '').trim()] ?? 'active',
          start_date:  parseExcelDate(row.start_date),
          end_date:    parseExcelDate(row.end_date),
          budget:      row.budget ? parseFloat(row.budget) : null,
          created_by:  user?.id ?? null,
        });
      });

      setRows(parsed);
      setErrors(errs);
    };
    reader.readAsArrayBuffer(file);
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

  const downloadTemplate = () => {
    const template = [
      {
        工程名稱: '虎尾鎮排水整治工程',
        施工地點: '虎尾鎮光復路沿線',
        承包商:   '中興土木工程公司',
        狀態:     '執行中',
        開工日期: '2025-10-15',
        預計完工: '2026-08-31',
        預算萬元: 5200,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '工程清單');
    XLSX.writeFile(wb, 'PMIS工程匯入範本.xlsx');
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel animate-slide-up" style={{ maxWidth: '680px' }}>
        {/* Header */}
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
              {/* Upload Area */}
              <div
                className="upload-zone"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={32} className="upload-icon" />
                <p className="upload-text">
                  {fileName ? fileName : '點擊或拖曳 Excel 檔案至此'}
                </p>
                <p className="upload-hint">支援 .xlsx / .xls 格式</p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  ref={fileRef}
                  style={{ display: 'none' }}
                  onChange={handleFile}
                />
              </div>

              <button className="btn-template" onClick={downloadTemplate}>
                ⬇ 下載 Excel 範本
              </button>

              {/* Preview */}
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

              {/* Errors */}
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
