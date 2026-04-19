import React, { useState, useRef } from 'react';
import { X, FileText, Upload, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, Settings2, Eye } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import './Modal.css';

// Use local bundled worker - avoids CDN/network dependency
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// ---------------------------------------------------------------------------
// 公共工程監造報表 — Coordinate-based parser
// Calibrated from actual PDF structure of 11502.pdf
// Page layout (y coordinates, PDF units, origin at bottom-left):
//   y≈801 : 公共工程監造報表 (header)
//   y≈786 : 工程名稱 / 工程編號
//   y≈771 : 開工日期 | 填表日期 | 本日天氣
//   y≈770 : 上午 晴 下午 晴
//   y≈758 : 契約工期 日曆天 / 累計工期 / 剩餘工期
//   y≈745/746 : 預定進度 / 實際進度 / 累計進度
//   y<733  : 一、工項數量表格 (until section 二)
// ---------------------------------------------------------------------------

// Boilerplate text to skip (pre-filled sections 二/三/四 that appear in every page)
const SKIP_PATTERNS = [
  /^二、監督依照設計圖說/,
  /^三、查核材料規格/,
  /^四、督導工地職業安全/,
  /^PRINT$/,
  /^監造人員簽章/,
  /^監造單位/,
  /註：/,
  /^本表原則應按日填寫/,
  /^本監造報告表格式/,
  /^契約工期如有修正/,
  /^公共工程屬建築物者/,
  /^施工廠商施工前檢查/,
  /其他工地安全衛生督導/,
  /告知承商/,
  /■|□/,  // checkbox markers
  /超前（＋）或落後/,
];

function isBoilerplate(str) {
  return SKIP_PATTERNS.some(rx => rx.test(str.trim()));
}

// ---------------------------------------------------------------------------
// Extract raw items WITH coordinates from a PDF page
// ---------------------------------------------------------------------------
async function extractPageItems(page) {
  const content = await page.getTextContent();
  return content.items
    .map(item => ({
      str: item.str.trim(),
      x: Math.round(item.transform[4]),
      y: Math.round(item.transform[5]),
    }))
    .filter(i => i.str !== '');
}

// ---------------------------------------------------------------------------
// Date parsers: handles CE and ROC year strings
// ---------------------------------------------------------------------------
function parseDate(raw) {
  if (!raw) return null;
  let s = String(raw).trim()
    .replace(/[年/]/g, '-').replace(/月/g, '-').replace(/日/g, '')
    .trim();
  // ROC: 2~3 digit year like 113-05-12 or 99-05-12
  const rocMatch = s.match(/^(\d{2,3})-(\d{1,2})-(\d{1,2})$/);
  if (rocMatch) {
    const y = parseInt(rocMatch[1]);
    const m = rocMatch[2].padStart(2, '0');
    const d = rocMatch[3].padStart(2, '0');
    return `${y + 1911}-${m}-${d}`;
  }
  // CE formats: 2024-05-12, 2024/05/12
  const ceMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ceMatch) return `${ceMatch[1]}-${ceMatch[2].padStart(2,'0')}-${ceMatch[3].padStart(2,'0')}`;
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().split('T')[0];
  return null;
}

// ---------------------------------------------------------------------------
// Parse one PDF page into a structured log record
// Returns null if this page is not a 監造報表 daily log page
// ---------------------------------------------------------------------------
async function parseMonitoringPage(page) {
  const items = await extractPageItems(page);
  const allText = items.map(i => i.str).join(' ');

  // Quick check: must contain "公共工程監造報表" to be a log page
  // Use regex to allow spaces between characters which sometimes happens in PDF extraction
  if (!/公共\s*工程\s*監造\s*報表/.test(allText)) return null;

  // --- 1. Report Date (填表日期, x≈250, y≈770-771) ---
  //    Layout: "填表日期" (x≈222 y≈770)  "115/2/28" (x≈260 y≈771)
  const dateLabelItem = items.find(i => i.str === '填表日期');
  let logDate = null;
  if (dateLabelItem) {
    const near = items.filter(i =>
      Math.abs(i.y - dateLabelItem.y) <= 5 &&
      i.x > dateLabelItem.x &&
      i.x < dateLabelItem.x + 120 &&
      /\d{2,3}\/\d{1,2}\/\d{1,2}/.test(i.str)
    );
    if (near.length) logDate = parseDate(near[0].str);
  }
  // Fallback: any date-like string near y≈770
  if (!logDate) {
    const dateItems = items.filter(i =>
      /^\d{2,3}\/\d{1,2}\/\d{1,2}$/.test(i.str) &&
      i.y >= 768 && i.y <= 775
    );
    if (dateItems.length) logDate = parseDate(dateItems[0].str);
  }
  if (!logDate) return null;

  // --- 2. Weather (y≈770, "上午" x≈386, value x≈427; "下午" x≈474, value x≈531) ---
  const weatherItems = items.filter(i => Math.abs(i.y - (dateLabelItem?.y ?? 770)) <= 5);
  const amIdx = weatherItems.findIndex(i => i.str === '上午');
  const pmIdx = weatherItems.findIndex(i => i.str === '下午');
  weatherItems.sort((a, b) => a.x - b.x);
  
  const VALID_WEATHER = ['晴', '多雲', '陰', '小雨', '中雨', '大雨', '颱風'];
  let weatherAm = null;
  let weatherPm = null;
  if (amIdx >= 0) {
    const amItem = weatherItems.find(i => i.str === '上午');
    const afterAm = weatherItems.filter(i => i.x > (amItem?.x ?? 0) + 10).sort((a,b) => a.x - b.x);
    weatherAm = afterAm.find(i => VALID_WEATHER.includes(i.str))?.str ?? null;
  }
  if (pmIdx >= 0) {
    const pmItem = weatherItems.find(i => i.str === '下午');
    const afterPm = weatherItems.filter(i => i.x > (pmItem?.x ?? 0) + 10).sort((a,b) => a.x - b.x);
    weatherPm = afterPm.find(i => VALID_WEATHER.includes(i.str))?.str ?? null;
  }

  // --- 3. Progress (y≈745, "預定" → next float; "實際" → next float) ---
  const progItems = items.filter(i => i.y >= 742 && i.y <= 750).sort((a,b) => a.x - b.x);
  let plannedProgress = null;
  let actualProgress = null;
  const predIdx = progItems.findIndex(i => i.str === '預定');
  const actIdx  = progItems.findIndex(i => i.str === '實際');
  if (predIdx >= 0) plannedProgress = parseFloat(progItems[predIdx + 1]?.str) || null;
  if (actIdx >= 0)  actualProgress  = parseFloat(progItems[actIdx  + 1]?.str) || null;

  // --- 4. Work Items Matrix (y < 733, x≈83=name, x≈486=today qty, x≈541=cumulative qty) ---
  // Collect rows: items with x around 83±30 are work item names
  const workItemRows = {};
  const nameItems  = items.filter(i => i.y < 733 && i.y > 50 && i.x >= 60 && i.x <= 160 && !isBoilerplate(i.str));
  const todayItems = items.filter(i => i.y < 733 && i.y > 50 && i.x >= 455 && i.x <= 510);
  const unitItems  = items.filter(i => i.y < 733 && i.y > 50 && i.x >= 375 && i.x <= 415);

  for (const ni of nameItems) {
    // Skip section headers (壹, 一, 二, 三... single char or table headers)
    if (/^[壹貳參肆一二三四五六七八九十]$/.test(ni.str)) continue;
    if (/^(工程項目|單位|契約數量|今日完成數量|累計完成數量|發包工程費|第.號明細表)/.test(ni.str)) continue;
    if (isBoilerplate(ni.str)) continue;

    // Find today's qty for this row (same y ± 4)
    const todayQty = todayItems.find(i => Math.abs(i.y - ni.y) <= 4);
    if (!todayQty || todayQty.str === '-' || todayQty.str === '0' || todayQty.str === '0.00') continue;

    const unit = unitItems.find(i => Math.abs(i.y - ni.y) <= 4)?.str ?? '';
    const qty  = todayQty.str;
    workItemRows[ni.y] = `${ni.str}：${qty} ${unit}`.trim();
  }

  const workItemsStr = Object.values(workItemRows).join('\n') || null;

  // --- 5. Notes: section 二 content (excluding boilerplate) ---
  // Collect text from x<400, y<400 that is not boilerplate and not in work table
  const noteItems = items.filter(i =>
    i.y < 450 && i.y > 50 &&
    !isBoilerplate(i.str) &&
    !nameItems.some(n => n.y === i.y) &&
    !todayItems.some(t => t.y === i.y) &&
    i.str.length > 2
  ).sort((a,b) => b.y - a.y || a.x - b.x);
  
  const notes = [...new Set(noteItems.map(i => i.str))]
    .filter(s => !/^[\d,.%-]+$/.test(s) && !/^[壹貳參肆一二三四五六七八九十]$/.test(s))
    .slice(0, 10)
    .join('\n') || null;

  return {
    log_date: logDate,
    weather_am: weatherAm,
    weather_pm: weatherPm,
    planned_progress: plannedProgress,
    actual_progress: actualProgress,
    work_items: workItemsStr,
    notes: notes,
  };
}



// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function DiaryImportModal({ projectId, onClose, onSuccess }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const fileRef = useRef(null);

  // PDF state
  const [fileNames, setFileNames] = useState([]);
  const [parsedRecords, setParsedRecords] = useState([]); // Array of structured log records
  const [parsing, setParsing] = useState(false);
  const [parsedPageCount, setParsedPageCount] = useState(0);

  // Preview & Import state
  const [mappedRows, setMappedRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  // ---------------------------------------------------------------------------
  // Step 1: Upload & Parse PDFs
  // ---------------------------------------------------------------------------
  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setFileNames(files.map(f => f.name));
    setParsing(true);
    setErrors([]);
    setParsedRecords([]);
    setParsedPageCount(0);

    const records = [];
    let totalPages = 0;
    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        totalPages += pdf.numPages;
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const rec = await parseMonitoringPage(page);
          if (rec) records.push(rec);
        }
      } catch (err) {
        setErrors(prev => [...prev, `讀取 ${file.name} 失敗：${err.message}`]);
      }
    }

    setParsedPageCount(totalPages);
    setParsedRecords(records);
    setParsing(false);
    if (records.length > 0) setStep(2);
    else if (totalPages > 0) setErrors(prev => [...prev, '未能在上傳的 PDF 中辨識出任何「公共工程監造報表」頁面，請確認 PDF 格式正確']);
  };

  // ---------------------------------------------------------------------------
  // Step 2 → 3: Merge parsed records by date and build final import rows
  // ---------------------------------------------------------------------------
  const processMapping = () => {
    setErrors([]);
    const dateMap = {};

    for (const rec of parsedRecords) {
      if (!rec.log_date) continue;
      if (!dateMap[rec.log_date]) {
        dateMap[rec.log_date] = { ...rec };
      } else {
        // Merge multi-page same-day records
        const ex = dateMap[rec.log_date];
        if (rec.work_items) ex.work_items = [ex.work_items, rec.work_items].filter(Boolean).join('\n');
        if (rec.notes)      ex.notes      = [ex.notes, rec.notes].filter(Boolean).join('\n');
        if (!ex.weather_am && rec.weather_am) ex.weather_am = rec.weather_am;
        if (!ex.weather_pm && rec.weather_pm) ex.weather_pm = rec.weather_pm;
      }
    }

    const result = Object.values(dateMap)
      .sort((a, b) => a.log_date.localeCompare(b.log_date))
      .map(rec => ({
        ...rec
      }));

    if (!result.length) {
      setErrors(['無法從解析結果中建立有效日誌記錄，請確認 PDF 格式']);
      return;
    }

    setMappedRows(result);
    setStep(3);
  };

  // ---------------------------------------------------------------------------
  // Step 3: Write to Supabase
  // ---------------------------------------------------------------------------
  const handleImport = async () => {
    if (!mappedRows.length) {
      alert('無待匯入資料');
      return;
    }
    
    setImporting(true);
    setErrors([]);

    try {
      const payload = mappedRows.map(r => ({
        project_id: projectId,
        log_date: r.log_date,
        weather_am: r.weather_am || null,
        weather_pm: r.weather_pm || null,
        work_items: r.work_items || null,
        notes: r.notes || null,
        planned_progress: r.planned_progress || 0,
        actual_progress: r.actual_progress || 0,
        created_by: user?.id || null,
      }));

      const datesToClean = mappedRows.map(r => r.log_date);

      // Step 1: Delete existing records for these dates to avoid unique constraint error
      const { error: delError } = await supabase
        .from('daily_logs')
        .delete()
        .eq('project_id', projectId)
        .in('log_date', datesToClean);

      if (delError) {
        throw new Error('清理舊資料失敗：' + delError.message);
      }

      // Step 2: Insert new records
      const { error: insError } = await supabase
        .from('daily_logs')
        .insert(payload);

      if (insError) {
        throw new Error('寫入資料失敗：' + insError.message);
      }

      setDone(true);
      setTimeout(() => { onSuccess?.(); onClose(); }, 1200);

    } catch (err) {
      console.error('Import Exception:', err);
      // Only keep error alert for user feedback
      alert(err.message);
      setErrors([err.message]);
    } finally {
      setImporting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Field label map
  // ---------------------------------------------------------------------------
  const FIELD_LABELS = {
    log_date:   '日期',
    weather_am: '上午天氣',
    weather_pm: '下午天氣',
    work_items: '施工項目',
    notes:      '重要記事/備註',
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel animate-slide-up" style={{ maxWidth: '820px', width: '92%' }}>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <FileText size={18} className="modal-icon" />
            <div>
              <h2 className="modal-title">PDF 監造報表匯入</h2>
              <p className="modal-subtitle">
                {step === 1 ? '1. 上傳 PDF' : step === 2 ? '2. 辨識設定與確認' : '3. 預覽與匯入'}
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {done ? (
            <div className="import-success">
              <CheckCircle2 size={40} color="var(--color-success)" />
              <p>成功匯入 {mappedRows.length} 筆監造報表記錄！</p>
            </div>
          ) : (
            <>
              {/* ── Step 1: Upload ── */}
              {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
                  <div
                    className="upload-zone"
                    onClick={() => !parsing && fileRef.current?.click()}
                    style={{ cursor: parsing ? 'wait' : 'pointer' }}
                  >
                    {parsing ? (
                      <>
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
                        <p className="upload-text">正在解析 PDF，請稍候…</p>
                      </>
                    ) : (
                      <>
                        <Upload size={32} className="upload-icon" />
                        <p className="upload-text">點擊上傳施工日誌 / 監造日報 PDF</p>
                        <p className="upload-hint">支援 .pdf，可一次上傳多份檔案（每頁視為一份日誌）</p>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".pdf"
                      multiple
                      ref={fileRef}
                      style={{ display: 'none' }}
                      onChange={handleFiles}
                    />
                  </div>

                  {fileNames.length > 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      已選取：{fileNames.join('、')}
                    </div>
                  )}

                  <div style={{ background: 'var(--color-surface-hover)', borderRadius: '8px', padding: '12px', fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                    <strong style={{ color: 'var(--color-text2)' }}>提示：</strong> 系統將自動掃描 PDF 中的「日期」、「天氣」、「施工項目」等關鍵字，並智能填入對應欄位。若您的 PDF 使用不同欄位名稱，可在下一步手動調整辨識關鍵字。
                  </div>
                </div>
              )}

              {/* ── Step 2: Parsed Summary ── */}
              {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'rgba(16,185,129,0.08)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <CheckCircle2 size={20} color="var(--color-success)" />
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text1)', margin: 0 }}>
                        解析完成！由 {parsedPageCount} 頁 PDF 中辨識出 <strong>{parsedRecords.length}</strong> 筆日誌記錄
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                        系統已自動過濾範本預填文字（二、監督依照設計圖說… 等固定段落），僅擷取每日實際填寫的內容。
                      </p>
                    </div>
                  </div>

                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>以下為解析預覽（前 5 筆），請確認內容正確後，點擊「產生預覽與匯入」：</p>

                  <div className="preview-table-wrapper" style={{ maxHeight: '260px', overflowY: 'auto' }}>
                    <table className="preview-table">
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--color-bg2)' }}>
                        <tr>
                          <th style={{ width: '95px' }}>填表日期</th>
                          <th style={{ width: '70px' }}>天氣(上/下)</th>
                          <th>今日施工工項（有數量者）</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRecords.slice(0, 5).map((r, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{r.log_date}</td>
                            <td style={{ fontSize: '11px' }}>{r.weather_am || '—'} / {r.weather_pm || '—'}</td>
                            <td style={{ fontSize: '11px', verticalAlign: 'top' }}>
                              <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap' }}>
                                {r.work_items || '（本日無施工數量）'}
                              </pre>
                            </td>
                          </tr>
                        ))}
                        {parsedRecords.length > 5 && (
                          <tr>
                            <td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '11px', padding: '10px' }}>
                              …共 {parsedRecords.length} 筆，已省略其餘預覽
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Step 3: Preview ── */}
              {step === 3 && mappedRows.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <p style={{ fontSize: '13px', color: 'var(--color-text2)' }}>
                    PDF 解析完成，將匯入 <strong>{mappedRows.length}</strong> 筆日誌記錄：
                  </p>
                  <div className="preview-table-wrapper" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                    <table className="preview-table">
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--color-bg2)' }}>
                        <tr>
                          <th style={{ width: '95px' }}>日期</th>
                          <th style={{ width: '80px' }}>天氣(上/下)</th>
                          <th>施工項目</th>
                          <th>重要記事</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mappedRows.map((r, i) => (
                          <tr key={i}>
                            <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{r.log_date}</td>
                            <td style={{ fontSize: '11px' }}>{r.weather_am || '—'}<br />{r.weather_pm || '—'}</td>
                            <td style={{ fontSize: '11px', verticalAlign: 'top' }}>
                              <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap' }}>{r.work_items || '—'}</pre>
                            </td>
                            <td style={{ fontSize: '11px', verticalAlign: 'top' }}>
                              <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap' }}>{r.notes || '—'}</pre>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Errors */}
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

        {/* Footer Actions */}
        {!done && (
          <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
            {step > 1 ? (
              <button className="btn-modal-cancel" onClick={() => setStep(step - 1)}>
                <ArrowLeft size={16} style={{ marginRight: '4px' }} /> 上一步
              </button>
            ) : <div />}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-modal-cancel" onClick={onClose}>取消</button>

              {step === 2 && (
                <button className="btn-modal-save" onClick={processMapping}>
                  開始解析與預覽 <ArrowRight size={16} style={{ marginLeft: '4px' }} />
                </button>
              )}

              {step === 3 && (
                <button className="btn-modal-save" onClick={handleImport} disabled={importing}>
                  {importing ? '寫入資料庫中...' : '確認匯入'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
