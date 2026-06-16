import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import './Modal.css';

const COLUMN_MAP = {
  '查驗日期': 'inspect_date',
  '工項':     'work_item',
  '位置':     'location',
  '查驗方式': 'inspect_type',
  '查驗人員': 'inspector',
  '結果':     'result',
  '備註':     'remark',
};

const RESULT_MAP = {
  '合格': '合格', '不合格': '不合格', '待複驗': '待複驗',
  'pass': '合格', 'fail': '不合格',
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

export function InspectionImportModal({ projectId, onClose, onSuccess }) {
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
        if (dbField) rowObj[dbField] = getCellValue(cell);
      });

      if (!rowObj.work_item || !String(rowObj.work_item).trim()) {
        errs.push(`第 ${rowNum} 行：「工項」為空，已略過`);
        return;
      }

      parsed.push({
        project_id: projectId,
        created_by: user?.id ?? null,
        inspect_date: parseExcelDate(rowObj.inspect_date) || new Date().toISOString().split('T')[0],
        work_item:    String(rowObj.work_item).trim(),
        location:     rowObj.location     ? String(rowObj.location).trim()     : null,
        inspect_type: rowObj.inspect_type ? String(rowObj.inspect_type).trim() : null,
        inspector:    rowObj.inspector    ? String(rowObj.inspector).trim()    : null,
        result:       RESULT_MAP[String(rowObj.result || '').trim()] ?? '待複驗',
        remark:       rowObj.remark ? String(rowObj.remark).trim() : null,
      });
    });

    setRows(parsed);
    setErrors(errs);
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    const { error } = await supabase.from('construction_inspections').insert(rows);
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
    const ws = wb.addWorksheet('施工抽查紀錄');
    ws.columns = [
      { header: '查驗日期', key: '查驗日期', width: 14 },
      { header: '工項',     key: '工項',     width: 24 },
      { header: '位置',     key: '位置',     width: 20 },
      { header: '查驗方式', key: '查驗方式', width: 14 },
      { header: '查驗人員', key: '查驗人員', width: 14 },
      { header: '結果',     key: '結果',     width: 10 },
      { header: '備註',     key: '備註',     width: 24 },
    ];
    ws.addRow({
      查驗日期: '2026-06-01',
      工項:     '排水管溝開挖',
      位置:     '光復路 K2+100',
      查驗方式: '抽查',
      查驗人員: '王監造',
      結果:     '合格',
      備註:     '',
    });
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), 'PMIS施工抽查匯入範本.xlsx');
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel animate-slide-up" style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <div className="modal-title-group">
            <FileSpreadsheet size={18} className="modal-icon" />
            <div>
              <h2 className="modal-title">Excel 匯入抽查單</h2>
              <p className="modal-subtitle">INSPECTION IMPORT</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {done ? (
            <div className="import-success">
              <CheckCircle2 size={40} color="var(--color-success)" />
              <p>成功匯入 {rows.length} 筆抽查紀錄！</p>
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
                    預覽：找到 <strong>{rows.length}</strong> 筆抽查紀錄
                    {errors.length > 0 && `，略過 ${errors.length} 筆`}
                  </p>
                  <div className="preview-table-wrapper">
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>日期</th>
                          <th>工項</th>
                          <th>位置</th>
                          <th>人員</th>
                          <th>結果</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i}>
                            <td>{r.inspect_date}</td>
                            <td>{r.work_item}</td>
                            <td>{r.location ?? '—'}</td>
                            <td>{r.inspector ?? '—'}</td>
                            <td>{r.result}</td>
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
