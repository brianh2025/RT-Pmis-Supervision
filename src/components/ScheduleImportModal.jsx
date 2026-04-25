import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle2, AlertTriangle, Download, ArrowLeft } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabase } from '../lib/supabaseClient';
import './Modal.css';

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

function parseWeight(v) {
  const n = parseFloat(String(v).replace('%','').trim());
  return isNaN(n) ? null : n;
}

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

function parseCellRef(ref) {
  const m = String(ref).toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  let c = 0;
  for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
  return { r: parseInt(m[2]), c };
}

function autoGuess(headers, dataRows) {
  const first = dataRows[0] || [];
  const guess = (regexList, valueTest) => {
    const byName = headers.findIndex(h => regexList.some(r => r.test(String(h))));
    if (byName !== -1) return byName;
    const byVal = headers.findIndex((_, i) => valueTest(first[i]));
    return byVal !== -1 ? byVal : null;
  };
  const nameByName = headers.findIndex(h => /名稱|工項|項目|item|name/i.test(String(h)));
  const nameByVal  = headers.findIndex((_, i) => { const v = first[i]; return typeof v === 'string' && String(v).trim().length > 1; });
  const nameIdx = (nameByName !== -1 && typeof first[nameByName] === 'string' && String(first[nameByName]).trim().length > 1)
    ? nameByName
    : (nameByVal !== -1 ? nameByVal : (nameByName !== -1 ? nameByName : null));
  return {
    name:   nameIdx !== null ? [nameIdx] : [],
    start:  guess([/開始|start|開工/i],            v => !!parseDate(v)),
    end:    guess([/結束|end|完工|竣工/i],          v => !!parseDate(v)),
    weight: guess([/權重|比重|佔比|weight/i, /%/],  v => parseWeight(v) !== null && parseWeight(v) >= 0),
  };
}

async function downloadTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('計畫進度表');
  ws.columns = [
    { header: '工項名稱', key: 'name',   width: 20 },
    { header: '開始日期', key: 'start',  width: 14 },
    { header: '結束日期', key: 'end',    width: 14 },
    { header: '權重(%)',  key: 'weight', width: 10 },
  ];
  [
    { name: '假設工程', start: '113-01-01', end: '113-02-28', weight: 5.0  },
    { name: '土方開挖', start: '113-02-01', end: '113-04-30', weight: 15.0 },
    { name: '基礎工程', start: '113-04-01', end: '113-07-31', weight: 20.0 },
    { name: '結構體',   start: '113-06-01', end: '113-12-31', weight: 35.0 },
    { name: '裝修工程', start: '113-11-01', end: '114-02-28', weight: 20.0 },
    { name: '竣工驗收', start: '114-02-01', end: '114-03-31', weight: 5.0  },
  ].forEach(r => ws.addRow(r));
  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf]), '工程計畫進度表範本.xlsx');
}

const FIELDS = [
  { key: 'name',   label: '工項名稱', required: true },
  { key: 'start',  label: '開始日期', required: false },
  { key: 'end',    label: '結束日期', required: false },
  { key: 'weight', label: '權重(%)',  required: false },
];

const selectStyle = {
  fontSize: '12px', padding: '4px 8px', borderRadius: '6px',
  border: '1px solid var(--color-block-border)',
  background: 'var(--color-bg1)', color: 'var(--color-text1)',
  width: '100%', cursor: 'pointer',
};

export function ScheduleImportModal({ projectId, onClose, onSuccess }) {
  const fileRef = useRef(null);
  const [step, setStep] = useState('upload');
  const [workbook, setWorkbook]     = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [rawHeaders, setRawHeaders] = useState([]);
  const [rawData, setRawData]       = useState([]);
  const [colMap, setColMap]         = useState({ name: [], start: null, end: null, weight: null });
  const [rows, setRows]             = useState([]);
  const [errors, setErrors]         = useState([]);
  const [importing, setImporting]   = useState(false);
  const [done, setDone]             = useState(false);

  const loadSheet = (wb, sheetName) => {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) return;

    // 建立合併格覆寫表（讓延伸格使用主格值），並收集垂直延伸列
    const cellOverrides = new Map();
    const vertContinueRows = new Set();
    (ws.model?.merges || []).forEach(mergeStr => {
      const parts = String(mergeStr).split(':');
      if (parts.length !== 2) return;
      const start = parseCellRef(parts[0]);
      const end   = parseCellRef(parts[1]);
      if (!start || !end) return;
      const masterVal = getCellValue(ws.getCell(start.r, start.c));
      for (let r = start.r; r <= end.r; r++) {
        for (let c = start.c; c <= end.c; c++) {
          if (r === start.r && c === start.c) continue;
          cellOverrides.set(`${r},${c}`, masterVal);
          if (r > start.r) vertContinueRows.add(r);
        }
      }
    });

    // 讀取所有非空列，建立 0-based cell arrays
    const allRows = [];
    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      const cells = [];
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        const key = `${rowNum},${colNum}`;
        cells[colNum - 1] = cellOverrides.has(key) ? cellOverrides.get(key) : getCellValue(cell);
      });
      allRows.push({ rowNum, cells });
    });

    const hIdx = allRows.findIndex(r => r.cells.some(c => String(c ?? '').trim() !== ''));
    if (hIdx === -1) { setErrors([`工作表「${sheetName}」是空的`]); return; }

    const headers  = allRows[hIdx].cells.map((h, i) => String(h ?? '').trim() || `欄 ${i + 1}`);
    const dataRows = allRows.slice(hIdx + 1)
      .filter(r => r.cells.some(c => String(c ?? '').trim() !== '') && !vertContinueRows.has(r.rowNum))
      .map(r => r.cells);

    setRawHeaders(headers);
    setRawData(dataRows);
    setColMap(autoGuess(headers, dataRows));
    setErrors([]);
    setStep('mapping');
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      setWorkbook(wb);
      const names = wb.worksheets.map(ws => ws.name);
      setSheetNames(names);
      setErrors([]);
      if (names.length === 1) {
        setSelectedSheet(names[0]);
        loadSheet(wb, names[0]);
      } else {
        setSelectedSheet('');
        setStep('sheet');
      }
    } catch (err) {
      setErrors([`讀取失敗：${err.message}`]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile({ target: { files: [file] } });
  };

  const handleParse = () => {
    const parsed = [];
    const errs = [];

    rawData.forEach((row, i) => {
      const rowNum = i + 2;
      const name  = colMap.name.length > 0
        ? colMap.name.map(ci => { const v = row[ci]; return (v instanceof Date || typeof v === 'number') ? '' : String(v ?? '').trim(); }).filter(Boolean).join(' - ')
        : '';
      const start = colMap.start !== null ? parseDate(row[colMap.start]) : null;
      const end   = colMap.end   !== null ? parseDate(row[colMap.end])   : null;
      const wt    = colMap.weight !== null ? parseWeight(row[colMap.weight]) : 0;

      if (!name)       { errs.push(`第 ${rowNum} 列：工項名稱為空`); return; }
      if (colMap.weight !== null && wt === null) { errs.push(`第 ${rowNum} 列 (${name})：權重欄位無效`); return; }
      if (start && end && start > end) { errs.push(`第 ${rowNum} 列 (${name})：開始日期不得晚於結束日期`); return; }

      parsed.push({ item_name: name, start_date: start, end_date: end, weight: wt, sort_order: i });
    });

    setRows(parsed);
    setErrors(errs);
    setStep('preview');
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    const payload = rows.map(r => ({ ...r, project_id: projectId }));
    const { error } = await supabase
      .from('schedule_items')
      .upsert(payload, { onConflict: 'project_id,item_name' });
    setImporting(false);
    if (error) {
      setErrors([`匯入失敗：${error.message}`]);
    } else {
      setDone(true);
      setTimeout(() => { onSuccess?.(); onClose(); }, 1500);
    }
  };

  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
  const weightOk    = Math.abs(totalWeight - 100) < 0.01;

  const stepLabels = sheetNames.length > 1 ? ['上傳', '選擇工作表', '欄位對應', '預覽確認'] : ['上傳', '欄位對應', '預覽確認'];
  const stepIdx    = step === 'upload' ? 0 : step === 'sheet' ? 1 : sheetNames.length > 1 ? (step === 'mapping' ? 2 : 3) : (step === 'mapping' ? 1 : 2);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" style={{ maxWidth: '680px' }}>

        <div className="modal-header">
          <div className="modal-title-group">
            <div>
              <h2 className="modal-title">匯入工程計畫進度表</h2>
              <p className="modal-subtitle">EXCEL IMPORT · SCHEDULE ITEMS</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '12px' }}>
            {stepLabels.map((label, idx) => (
              <React.Fragment key={idx}>
                <span style={{
                  fontSize: '10px', padding: '2px 8px', borderRadius: '12px', fontWeight: idx === stepIdx ? 600 : 400,
                  background: idx === stepIdx ? 'var(--color-primary)' : idx < stepIdx ? 'var(--color-success)' : 'var(--color-bg2)',
                  color: idx <= stepIdx ? '#fff' : 'var(--color-text-muted)',
                }}>
                  {label}
                </span>
                {idx < stepLabels.length - 1 && <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>›</span>}
              </React.Fragment>
            ))}
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {done ? (
            <div className="import-success">
              <CheckCircle2 size={40} color="var(--color-success)" />
              <p>成功匯入 {rows.length} 項工程計畫！</p>
            </div>

          ) : step === 'upload' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="upload-zone" onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
                <Upload size={28} className="upload-icon" />
                <p className="upload-text">點擊或拖曳上傳廠商計畫進度表</p>
                <p className="upload-hint">支援 .xlsx / .xls / .xlsm｜任何欄位格式皆可，下一步手動對應</p>
                <input type="file" accept=".xlsx,.xls,.xlsm" ref={fileRef} style={{ display: 'none' }} onChange={handleFile} />
              </div>
              <button className="btn-template" onClick={() => downloadTemplate()}>
                <Download size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                下載標準範本
              </button>
              {errors.length > 0 && (
                <div className="import-errors">
                  <AlertTriangle size={14} />
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem' }}>
                    {errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>

          ) : step === 'sheet' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0 }}>
                此 Excel 含 <strong>{sheetNames.length}</strong> 個工作表，請選擇包含進度資料的工作表：
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {sheetNames.map(name => (
                  <button
                    key={name}
                    onClick={() => setSelectedSheet(name)}
                    style={{
                      textAlign: 'left', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                      border: `1px solid ${selectedSheet === name ? 'var(--color-primary)' : 'var(--color-block-border)'}`,
                      background: selectedSheet === name ? 'rgba(var(--color-primary-rgb, 59,130,246),0.08)' : 'var(--color-bg2)',
                      color: 'var(--color-text1)', fontSize: '13px', fontWeight: selectedSheet === name ? 600 : 400,
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

          ) : step === 'mapping' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0 }}>
                偵測到 <strong>{rawHeaders.length}</strong> 欄、<strong>{rawData.length}</strong> 列資料。請確認或調整欄位對應：
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text2)', marginBottom: '6px' }}>
                    工項名稱 <span style={{ color: '#ef4444' }}>*</span>
                    <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: '6px' }}>可勾選多欄，串接為完整名稱</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {rawHeaders.map((h, idx) => {
                      const checked = colMap.name.includes(idx);
                      const sample = rawData[0]?.[idx];
                      const sampleStr = sample instanceof Date ? parseDate(sample) : String(sample ?? '');
                      const preview = sample !== undefined && sample !== '' ? `（${sampleStr.slice(0, 10)}）` : '';
                      return (
                        <label key={idx} style={{
                          display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
                          padding: '3px 10px', borderRadius: '6px', fontSize: '12px',
                          border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-block-border)'}`,
                          background: checked ? 'rgba(59,130,246,0.08)' : 'var(--color-bg2)',
                          color: checked ? 'var(--color-primary)' : 'var(--color-text2)',
                        }}>
                          <input type="checkbox" checked={checked} style={{ margin: 0 }}
                            onChange={e => {
                              setColMap(m => ({
                                ...m,
                                name: e.target.checked
                                  ? [...m.name, idx].sort((a, b) => a - b)
                                  : m.name.filter(i => i !== idx),
                              }));
                            }}
                          />
                          {h}{preview}
                        </label>
                      );
                    })}
                  </div>
                  {colMap.name.length > 1 && (
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                      預覽串接：{colMap.name.map(ci => String(rawData[0]?.[ci] ?? '').trim()).filter(Boolean).join(' - ')}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  {FIELDS.filter(f => f.key !== 'name').map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text2)', marginBottom: '4px' }}>
                        {f.label}{f.required && <span style={{ color: '#ef4444' }}> *</span>}
                      </div>
                      <select
                        style={selectStyle}
                        value={colMap[f.key] ?? ''}
                        onChange={e => setColMap(m => ({ ...m, [f.key]: e.target.value === '' ? null : parseInt(e.target.value) }))}
                      >
                        <option value="">— 不對應 —</option>
                        {rawHeaders.map((h, idx) => {
                          const sample = rawData[0]?.[idx];
                          const preview = sample !== undefined && sample !== '' ? `（${String(sample).slice(0, 12)}）` : '';
                          return <option key={idx} value={idx}>{h}{preview}</option>;
                        })}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>資料預覽（前 5 列）：</div>
                <div className="preview-table-wrapper" style={{ maxHeight: '180px' }}>
                  <table className="preview-table">
                    <thead>
                      <tr>{rawHeaders.map((h, i) => <th key={i}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {rawData.slice(0, 5).map((row, i) => (
                        <tr key={i}>
                          {rawHeaders.map((_, ci) => (
                            <td key={ci} style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {String(row[ci] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          ) : (
            <>
              <p style={{ fontSize: '13px', color: 'var(--color-text2)', marginBottom: '10px' }}>
                成功解析 <strong>{rows.length}</strong> 項
                {errors.length > 0 && <span style={{ color: 'var(--color-warning, #f59e0b)', marginLeft: '8px' }}>（{errors.length} 列略過）</span>}
              </p>
              {rows.length > 0 && (
                <div className="preview-table-wrapper" style={{ maxHeight: '280px' }}>
                  <table className="preview-table">
                    <thead>
                      <tr><th>#</th><th>工項名稱</th><th>開始日期</th><th>結束日期</th><th>工期(天)</th><th>權重(%)</th></tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const days = Math.round((new Date(r.end_date) - new Date(r.start_date)) / 86400000) + 1;
                        return (
                          <tr key={i}>
                            <td style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                            <td style={{ fontWeight: 500 }}>{r.item_name}</td>
                            <td>{r.start_date}</td>
                            <td>{r.end_date}</td>
                            <td style={{ textAlign: 'right' }}>{days}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{r.weight}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid var(--color-block-border)' }}>
                        <td colSpan={5} style={{ padding: '6px 12px', fontSize: '11px', color: 'var(--color-text-muted)' }}>權重合計</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: weightOk ? 'var(--color-success)' : 'var(--color-warning, #f59e0b)' }}>
                          {totalWeight.toFixed(2)}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
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
            {step === 'upload' && (
              <button className="btn-modal-cancel" onClick={onClose}>取消</button>
            )}
            {step === 'sheet' && (
              <>
                <button className="btn-modal-cancel" onClick={() => setStep('upload')} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ArrowLeft size={13} />重新上傳
                </button>
                <button
                  className="btn-modal-save"
                  onClick={() => loadSheet(workbook, selectedSheet)}
                  disabled={!selectedSheet}
                >
                  下一步：欄位對應 →
                </button>
              </>
            )}
            {step === 'mapping' && (
              <>
                <button className="btn-modal-cancel" onClick={() => setStep(sheetNames.length > 1 ? 'sheet' : 'upload')} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ArrowLeft size={13} />{sheetNames.length > 1 ? '選擇工作表' : '重新上傳'}
                </button>
                <button
                  className="btn-modal-save"
                  onClick={handleParse}
                  disabled={colMap.name.length === 0}
                >
                  下一步：預覽 →
                </button>
              </>
            )}
            {step === 'preview' && (
              <>
                <button className="btn-modal-cancel" onClick={() => setStep('mapping')} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ArrowLeft size={13} />修改對應
                </button>
                {rows.length > 0 && (
                  <button className="btn-modal-save" onClick={handleImport} disabled={importing}>
                    {importing ? '寫入中…' : `確認匯入 ${rows.length} 項`}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
