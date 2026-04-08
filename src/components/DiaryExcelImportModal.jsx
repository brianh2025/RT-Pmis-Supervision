import React, { useState, useRef } from 'react';
import { X, FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft } from 'lucide-react';
import * as XLSX from 'xlsx';
import './Modal.css';

// 嘗試解析民國或西元年日期字串，回傳 YYYY-MM-DD
function parseDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) {
    if (isNaN(raw)) return null;
    return raw.toISOString().split('T')[0];
  }
  let s = String(raw).trim().replace(/[年/．.]/g, '-').replace(/月/g, '-').replace(/日/g, '').trim();
  // 民國 113-05-12 或 114-4-8
  const rocMatch = s.match(/^(\d{2,3})-(\d{1,2})-(\d{1,2})$/);
  if (rocMatch) {
    const y = parseInt(rocMatch[1]);
    if (y < 200) {
      const m = rocMatch[2].padStart(2, '0');
      const d = rocMatch[3].padStart(2, '0');
      return `${y + 1911}-${m}-${d}`;
    }
  }
  // 西元 2026-04-08
  const ceMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ceMatch) return `${ceMatch[1]}-${ceMatch[2].padStart(2, '0')}-${ceMatch[3].padStart(2, '0')}`;
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().split('T')[0];
  return null;
}

// 欄位自動辨識關鍵字
const COL_PATTERNS = {
  date:    [/日期/, /date/i],
  weather: [/天氣/, /weather/i],
  tempHigh:[/最高/, /高溫/, /tempHigh/i],
  tempLow: [/最低/, /低溫/, /tempLow/i],
  planned: [/預定/, /計畫/, /planned/i],
  actual:  [/實際/, /actual/i],
  workItems:[/施工記事/, /工項/, /work/i],
  specialNote:[/特別/, /備註/, /note/i],
};

function detectCol(header, patterns) {
  return patterns.some(rx => rx.test(String(header)));
}

function buildMapping(headers) {
  const map = {};
  headers.forEach((h, i) => {
    for (const [field, patterns] of Object.entries(COL_PATTERNS)) {
      if (!map[field] && detectCol(h, patterns)) map[field] = i;
    }
  });
  return map;
}

export function DiaryExcelImportModal({ projectId, onClose, onSuccess }) {
  const fileRef = useRef(null);
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [rawRows, setRawRows] = useState([]);
  const [preview, setPreview] = useState([]);
  const [errors, setErrors] = useState([]);
  const [done, setDone] = useState(false);

  // Step 1: 讀取 Excel
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setErrors([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (rows.length < 2) { setErrors(['Excel 內容不足，請確認格式']); return; }

        const hdrs = rows[0].map(h => String(h ?? '').trim());
        const dataRows = rows.slice(1).filter(r => r.some(c => c !== ''));
        setHeaders(hdrs);
        setRawRows(dataRows);
        setMapping(buildMapping(hdrs));
        setStep(2);
      } catch (err) {
        setErrors([`讀取失敗：${err.message}`]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // 欄位選單
  const ColSelect = ({ field, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--color-text2)', width: 90, flexShrink: 0 }}>{label}</span>
      <select
        className="form-input"
        style={{ fontSize: 12, padding: '4px 8px' }}
        value={mapping[field] ?? ''}
        onChange={e => setMapping(m => ({ ...m, [field]: e.target.value === '' ? undefined : Number(e.target.value) }))}
      >
        <option value="">— 略過 —</option>
        {headers.map((h, i) => <option key={i} value={i}>{h || `欄${i + 1}`}</option>)}
      </select>
    </div>
  );

  // Step 2 → 3: 產生預覽
  const buildPreview = () => {
    setErrors([]);
    const errs = [];
    const result = [];

    rawRows.forEach((row, ri) => {
      const dateVal = mapping.date !== undefined ? row[mapping.date] : null;
      const dateStr = parseDate(dateVal);
      if (!dateStr) {
        errs.push(`第 ${ri + 2} 列：無法識別日期「${dateVal}」`);
        return;
      }

      const get = (field) => mapping[field] !== undefined ? String(row[mapping[field]] ?? '').trim() : '';
      const getNum = (field) => {
        const v = mapping[field] !== undefined ? row[mapping[field]] : null;
        const n = parseFloat(v);
        return isNaN(n) ? 0 : n;
      };

      result.push({
        id: `import-${dateStr}-${Date.now()}-${ri}`,
        project_id: projectId,
        date: dateStr,
        reportNo: `匯入-${dateStr}`,
        weather: get('weather') || '晴',
        tempHigh: getNum('tempHigh'),
        tempLow: getNum('tempLow'),
        supervisor: '',
        contractor: '',
        plannedProgress: getNum('planned'),
        actualProgress: getNum('actual'),
        progressNote: '',
        quantities: [],
        inspections: [],
        qualityTests: [],
        documents: [],
        specialNote: [get('workItems'), get('specialNote')].filter(Boolean).join('\n'),
      });
    });

    if (errs.length) { setErrors(errs); }
    if (!result.length) { setErrors(prev => [...prev, '無有效資料列可匯入']); return; }
    setPreview(result);
    setStep(3);
  };

  // Step 3: 寫入 localStorage
  const handleImport = () => {
    const key = `daily_reports_${projectId}`;
    let existing = [];
    try { existing = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}

    const existingDates = new Set(existing.map(r => r.date));
    const toAdd = preview.filter(r => !existingDates.has(r.date));
    const toReplace = preview.filter(r => existingDates.has(r.date));

    // 以日期去重：舊資料中同日期者替換
    const merged = existing
      .map(r => {
        const rep = toReplace.find(nr => nr.date === r.date);
        return rep || r;
      })
      .concat(toAdd)
      .sort((a, b) => a.date.localeCompare(b.date));

    localStorage.setItem(key, JSON.stringify(merged));
    setDone(true);
    setTimeout(() => { onSuccess?.(); onClose(); }, 1200);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel animate-slide-up" style={{ maxWidth: 720, width: '92%' }}>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <FileSpreadsheet size={17} className="modal-icon" />
            <div>
              <h2 className="modal-title">施工日誌 Excel 匯入</h2>
              <p className="modal-subtitle">
                {step === 1 ? '1. 上傳 Excel' : step === 2 ? '2. 欄位對應' : '3. 預覽確認'}
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ minHeight: 320 }}>
          {done ? (
            <div className="import-success">
              <CheckCircle2 size={40} color="var(--color-success)" />
              <p>成功匯入 {preview.length} 筆施工日誌！</p>
            </div>
          ) : (
            <>
              {/* ── Step 1 ── */}
              {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginTop: '0.5rem' }}>
                  <div className="upload-zone" onClick={() => fileRef.current?.click()} style={{ cursor: 'pointer' }}>
                    <Upload size={30} className="upload-icon" />
                    <p className="upload-text">點擊上傳施工日誌 Excel 檔</p>
                    <p className="upload-hint">支援 .xlsx / .xls，第一列為欄位標題</p>
                    <input type="file" accept=".xlsx,.xls" ref={fileRef} style={{ display: 'none' }} onChange={handleFile} />
                  </div>
                  <div style={{ background: 'var(--color-surface-hover)', borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
                    <strong style={{ color: 'var(--color-text2)' }}>建議欄位名稱：</strong>
                    日期、天氣、最高溫、最低溫、預定進度、實際進度、施工記事、特別記載
                  </div>
                </div>
              )}

              {/* ── Step 2 ── */}
              {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ fontSize: 13, color: 'var(--color-text2)', marginBottom: 4 }}>
                    已讀取 <strong>{fileName}</strong>，共 {rawRows.length} 列資料。請確認欄位對應：
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                    <ColSelect field="date"        label="日期 *" />
                    <ColSelect field="weather"     label="天氣" />
                    <ColSelect field="planned"     label="預定進度(%)" />
                    <ColSelect field="actual"      label="實際進度(%)" />
                    <ColSelect field="tempHigh"    label="最高溫" />
                    <ColSelect field="tempLow"     label="最低溫" />
                    <ColSelect field="workItems"   label="施工記事" />
                    <ColSelect field="specialNote" label="特別記載" />
                  </div>
                  {mapping.date === undefined && (
                    <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>⚠ 請至少選擇「日期」欄位</div>
                  )}
                </div>
              )}

              {/* ── Step 3 ── */}
              {step === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <div style={{ fontSize: 13, color: 'var(--color-text2)' }}>
                    共 <strong>{preview.length}</strong> 筆日誌將匯入（同日期資料將覆蓋舊紀錄）：
                  </div>
                  <div className="preview-table-wrapper" style={{ maxHeight: 300, overflowY: 'auto' }}>
                    <table className="preview-table">
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--color-bg2)' }}>
                        <tr>
                          <th style={{ width: 90 }}>日期</th>
                          <th style={{ width: 60 }}>天氣</th>
                          <th style={{ width: 80 }}>預定 / 實際 %</th>
                          <th>施工記事</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((r, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{r.date}</td>
                            <td style={{ fontSize: 11 }}>{r.weather}</td>
                            <td style={{ fontSize: 11, textAlign: 'center' }}>{r.plannedProgress} / {r.actualProgress}</td>
                            <td style={{ fontSize: 11 }}>
                              <div style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {r.specialNote || '—'}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 錯誤 */}
              {errors.length > 0 && (
                <div className="import-errors" style={{ marginTop: '0.8rem' }}>
                  <AlertTriangle size={13} />
                  <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.78rem' }}>
                    {errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!done && (
          <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
            {step > 1 ? (
              <button className="btn-modal-cancel" onClick={() => setStep(step - 1)}>
                <ArrowLeft size={14} style={{ marginRight: 4 }} />上一步
              </button>
            ) : <div />}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-modal-cancel" onClick={onClose}>取消</button>
              {step === 2 && (
                <button
                  className="btn-modal-save"
                  onClick={buildPreview}
                  disabled={mapping.date === undefined}
                >
                  產生預覽 <ArrowRight size={14} style={{ marginLeft: 4 }} />
                </button>
              )}
              {step === 3 && (
                <button className="btn-modal-save" onClick={handleImport}>
                  確認匯入
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
