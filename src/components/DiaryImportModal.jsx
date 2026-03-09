import React, { useState, useRef, useEffect } from 'react';
import { X, FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, Settings2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import '../components/Modal.css';

/**
 * Attempts to auto-guess the column for a given field based on keywords.
 */
function guessColumn(headers, keywords) {
  for (const h of headers) {
    if (keywords.some(kw => String(h).includes(kw))) return h;
  }
  return '';
}

/**
 * Parses raw dates from Excel into YYYY-MM-DD
 */
function parseExcelDate(rawDate) {
  if (!rawDate) return null;
  if (rawDate instanceof Date) {
    return rawDate.toISOString().split('T')[0];
  } else if (typeof rawDate === 'number') {
    const d = XLSX.SSF.parse_date_code(rawDate);
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  } else {
    // String processing: try to handle "113/05/12" or "2024-05-12"
    let s = String(rawDate).trim().replace(/[年\/]/g,'-').replace(/月/g,'-').replace(/日/g,'');
    // ROC year handling (rudimentary): if starts with 11x, add 1911
    if (s.match(/^1\d{2}-/)) {
      const parts = s.split('-');
      parts[0] = parseInt(parts[0]) + 1911;
      s = parts.join('-');
    }
    const d = new Date(s);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
  }
  return null;
}

export function DiaryImportModal({ projectId, onClose, onSuccess }) {
  const { user } = useAuth();
  
  // -- Setup & State --
  const [step, setStep] = useState(1); // 1: Upload, 2: Map, 3: Preview
  const fileRef = useRef(null);
  
  // File data
  const [fileName, setFileName] = useState('');
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  
  // Mapping state
  const [selectedSheet, setSelectedSheet] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState({
    log_date: '',
    weather_am: '',
    weather_pm: '',
    work_items: '',
    notes: ''
  });

  // Preview & Import state
  const [mappedRows, setMappedRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  // -- Step 1: Upload --
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        
        // Auto-select "記事" or the first sheet
        const defaultSheet = wb.SheetNames.find(n => n.includes('記事')) ?? wb.SheetNames[0];
        setSelectedSheet(defaultSheet);
        
        setStep(2); // Move to Step 2
      } catch (err) {
        setErrors([`讀取檔案失敗：${err.message}`]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // -- Step 2: Mapping --
  useEffect(() => {
    if (step === 2 && workbook && selectedSheet) {
      const ws = workbook.Sheets[selectedSheet];
      // Get raw arrays of arrays to find header row reliably
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      
      // Auto-detect header row (look for "日期" or fallback to row 2)
      let headerIdx = rows.findIndex(r => r.some(c => String(c).includes('日期')));
      if (headerIdx === -1) headerIdx = 1;

      if (rows.length > headerIdx) {
        // Collect unique non-empty header names
        const rawHeaders = rows[headerIdx].map(String).map(s => s.trim());
        // Handle duplicate or empty headers by giving them fallback names
        const uniqueHeaders = rawHeaders.map((h, i) => h || `[無標題欄位 ${i + 1}]`);
        
        setHeaders(uniqueHeaders);
        
        // Convert the rest of the rows into objects based on these unique headers
        const dataRows = [];
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const rowObj = {};
          for (let j = 0; j < uniqueHeaders.length; j++) {
            rowObj[uniqueHeaders[j]] = rows[i][j] !== undefined ? rows[i][j] : '';
          }
          // Only keep row if it has some data
          if (Object.values(rowObj).some(v => String(v).trim() !== '')) {
            dataRows.push(rowObj);
          }
        }
        setRawRows(dataRows);

        // Auto-guess mapping
        setMapping({
          log_date: guessColumn(uniqueHeaders, ['日期', 'Date']),
          weather_am: guessColumn(uniqueHeaders, ['上午', '天氣(上)', 'AM']),
          weather_pm: guessColumn(uniqueHeaders, ['下午', '天氣(下)', 'PM']),
          work_items: guessColumn(uniqueHeaders, ['施工', '項目', '主辦工程']),
          notes: guessColumn(uniqueHeaders, ['記事', '備註', '說明', 'Notes'])
        });
      } else {
        setHeaders([]);
        setRawRows([]);
      }
    }
  }, [step, selectedSheet, workbook]);

  const handleMappingChange = (field, value) => {
    setMapping(prev => ({ ...prev, [field]: value }));
  };

  const processMapping = () => {
    if (!mapping.log_date) {
      setErrors(['必須指定「日期」欄位才能匯入']);
      return;
    }
    setErrors([]);

    const result = [];
    let parseErrs = 0;
    
    for (const row of rawRows) {
      const rawDate = row[mapping.log_date];
      if (!rawDate) continue;

      const logDate = parseExcelDate(rawDate);
      if (!logDate) {
        parseErrs++;
        continue;
      }

      result.push({
        log_date: logDate,
        weather_am: mapping.weather_am ? String(row[mapping.weather_am] ?? '').trim() : null,
        weather_pm: mapping.weather_pm ? String(row[mapping.weather_pm] ?? '').trim() : null,
        work_items: mapping.work_items ? String(row[mapping.work_items] ?? '').trim() : null,
        notes: mapping.notes ? String(row[mapping.notes] ?? '').trim() : null,
      });
    }

    if (result.length === 0) {
      setErrors(['無法根據當前對應解析出任何有效資料，請檢查欄位格式']);
      return;
    }

    if (parseErrs > 0) {
      setErrors([`有 ${parseErrs} 筆紀錄因日期格式無法辨識而被忽略`]);
    }

    setMappedRows(result);
    setStep(3); // Move to Preview
  };

  // -- Step 3: Import --
  const handleImport = async () => {
    if (!mappedRows.length) return;
    setImporting(true);
    setErrors([]);
    
    const payload = mappedRows.map(r => ({
      ...r,
      project_id: projectId,
      created_by: user?.id ?? null,
    }));

    const { error } = await supabase
      .from('daily_logs')
      .upsert(payload, { onConflict: 'project_id,log_date' });

    setImporting(false);
    if (error) {
      setErrors([`匯入失敗：${error.message}`]);
    } else {
      setDone(true);
      setTimeout(() => { onSuccess?.(); onClose(); }, 1500);
    }
  };

  // -- Renders --
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel animate-slide-up" style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <div className="modal-title-group">
            <FileSpreadsheet size={18} className="modal-icon" />
            <div>
              <h2 className="modal-title">匯入施工日誌 (智能對應)</h2>
              <p className="modal-subtitle">
                {step === 1 ? '1. 上傳檔案' : step === 2 ? '2. 對應欄位' : '3. 預覽與匯入'}
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ minHeight: '300px' }}>
          {done ? (
            <div className="import-success">
              <CheckCircle2 size={40} color="var(--color-success)" />
              <p>成功匯入 {mappedRows.length} 筆日誌記錄！</p>
            </div>
          ) : (
            <>
              {/* Step 1: Upload */}
              {step === 1 && (
                <div className="upload-zone" onClick={() => fileRef.current?.click()} style={{ marginTop: '2rem' }}>
                  <Upload size={32} className="upload-icon" />
                  <p className="upload-text">點擊上傳原始日誌 Excel 檔案</p>
                  <p className="upload-hint">支援各種格式，將透過智能對應選取資料</p>
                  <input type="file" accept=".xlsx,.xls,.xlsm" ref={fileRef} style={{ display: 'none' }} onChange={handleFile} />
                </div>
              )}

              {/* Step 2: Mapping */}
              {step === 2 && (
                <div className="mapping-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                    <label className="form-label">資料來源分頁 (Sheet)</label>
                    <div className="select-wrapper">
                      <select 
                        className="form-input" 
                        value={selectedSheet} 
                        onChange={e => setSelectedSheet(e.target.value)}
                      >
                        {sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="mapping-grid" style={{ 
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', 
                    background: 'var(--color-surface-hover)', padding: '1rem', borderRadius: 'var(--radius-md)' 
                  }}>
                    <div style={{ gridColumn: '1 / -1', fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Settings2 size={14} /> 系統已自動匹配欄位，請確認或修改：
                    </div>

                    {[
                      { key: 'log_date', label: '日期欄位 (必填)*' },
                      { key: 'weather_am', label: '上午天氣' },
                      { key: 'weather_pm', label: '下午天氣' },
                      { key: 'work_items', label: '施工項目' },
                      { key: 'notes', label: '重要記事 / 備註' }
                    ].map(field => (
                      <div className="form-group" key={field.key}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>{field.label}</label>
                        <div className="select-wrapper">
                          <select 
                            className="form-input" 
                            style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                            value={mapping[field.key]} 
                            onChange={e => handleMappingChange(field.key, e.target.value)}
                          >
                            <option value="">-- 不匯入此欄位 --</option>
                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Preview */}
              {step === 3 && mappedRows.length > 0 && (
                <>
                  <p className="preview-count" style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                    將匯入以下 <strong>{mappedRows.length}</strong> 筆日誌紀錄：
                  </p>
                  <div className="preview-table-wrapper" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table className="preview-table">
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr>
                          <th>日期</th><th>天氣(上/下)</th><th>施工項目</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mappedRows.slice(0, 8).map((r, i) => (
                          <tr key={i}>
                            <td style={{ whiteSpace: 'nowrap' }}>{r.log_date}</td>
                            <td>{r.weather_am || '—'} / {r.weather_pm || '—'}</td>
                            <td style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.work_items || r.notes || '—'}
                            </td>
                          </tr>
                        ))}
                        {mappedRows.length > 8 && (
                          <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>…共 {mappedRows.length} 筆，已省略其餘預覽</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {errors.length > 0 && (
                <div className="import-errors" style={{ marginTop: '1rem' }}>
                  <AlertTriangle size={14} /> 
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem' }}>
                    {errors.map((err, idx) => <li key={idx}>{err}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {!done && (
          <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
            {step === 1 ? (
              <div /> // empty placeholder for flex spacing
            ) : (
              <button className="btn-modal-cancel" onClick={() => setStep(step - 1)}>
                <ArrowLeft size={16} style={{ marginRight: '4px' }} /> 上一步
              </button>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-modal-cancel" onClick={onClose}>取消</button>
              
              {step === 2 && (
                <button className="btn-modal-save" onClick={processMapping}>
                  產生預覽 <ArrowRight size={16} style={{ marginLeft: '4px' }} />
                </button>
              )}
              
              {step === 3 && (
                <button
                  className="btn-modal-save"
                  onClick={handleImport}
                  disabled={importing}
                >
                  {importing ? '寫入資料庫中...' : `確認匯入`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
