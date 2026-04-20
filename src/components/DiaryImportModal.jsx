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
  /^\d*\.?\s*本表原則應按日填寫/,
  /^\d*\.?\s*本監造報告表格式/,
  /^\d*\.?\s*契約工期如有修正/,
  /^\d*\.?\s*公共工程屬建築物者/,
  /^施工廠商施工前檢查/,
  /其他工地安全衛生督導/,
  /告知承商/,
  /■|□/,  // checkbox markers
  /超前（＋）或落後/,
  /^(公共工程監造報表|施工日誌|監造單位|主辦機關|設計單位|施工廠商|表報編號|工程編號|填表日期|契約工期|開工日期|預定完工日期|累計工期|工期展延天數|契約金額|預定進度|實際進度|本日天氣)/,
  /(含約定之檢驗停留點|主辦機關指示及通知廠商辦理事項|請參詳施工日誌)/
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
  // Remove all spaces and normalize delimiters
  let s = String(raw).replace(/\s+/g, '')
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
async function parseMonitoringPage(page, pageNum) {
  const items = await extractPageItems(page);
  const allText = items.map(i => i.str).join(' ');

  // DEBUG: Log extracted text for troubleshooting
  console.log(`[PDF Parser] Page ${pageNum} — first 300 chars:`, allText.substring(0, 300));
  console.log(`[PDF Parser] Page ${pageNum} — total items:`, items.length);
  console.log(`[PDF Parser] Page ${pageNum} — first 15 items:`, items.slice(0, 15).map(i => `(${i.x},${i.y})"${i.str}"`));

  // Quick check: must contain "公共工程監造報表" OR "施工日誌" to be a valid log page
  // Use regex to allow spaces between characters which sometimes happens in PDF extraction
  if (!/公共\s*工程\s*監造\s*報表/.test(allText) && !/施工日誌/.test(allText)) {
    console.warn(`[PDF Parser] Page ${pageNum} — SKIP: 未找到「公共工程監造報表」或「施工日誌」標題`);
    // Also try looser match
    const hasPublic = allText.includes('公共');
    const hasEngineering = allText.includes('工程');
    const hasMonitor = allText.includes('監造');
    const hasReport = allText.includes('報表');
    console.warn(`[PDF Parser] 個別關鍵字: 公共=${hasPublic}, 工程=${hasEngineering}, 監造=${hasMonitor}, 報表=${hasReport}`);
    return null;
  }

  // --- 1. Report Date ---
  //    The label may be "填表日期" or "填表日期：" (with colon)
  //    The date value may be "115/3/30" or "115年3月30日"
  const dateLabelItem = items.find(i => i.str.startsWith('填表日期'));
  let logDate = null;
  console.log(`[PDF Parser] Page ${pageNum} — 填表日期 label:`, dateLabelItem || 'NOT FOUND');
  if (dateLabelItem) {
    // Check if the date is embedded in the label itself (e.g. "填表日期：115年3月30日" as one item)
    const embeddedDate = dateLabelItem.str.match(/(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (embeddedDate) {
      logDate = parseDate(`${embeddedDate[1]}年${embeddedDate[2]}月${embeddedDate[3]}日`);
    }
    if (!logDate) {
      // Look for date items near the label (same y ± 8, to the right)
      const near = items.filter(i =>
        Math.abs(i.y - dateLabelItem.y) <= 8 &&
        i.x > dateLabelItem.x - 10 &&
        i.x < dateLabelItem.x + 200 &&
        i.str !== dateLabelItem.str &&
        (/\d{2,3}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(i.str) || /\d{2,3}\s*年/.test(i.str))
      );
      console.log(`[PDF Parser] Page ${pageNum} — date candidates near label:`, near);
      if (near.length) logDate = parseDate(near[0].str);
    }
  }
  // Fallback: any date-like string in the page
  if (!logDate) {
    // Try 年月日 format first
    const cjkDateItems = items.filter(i => /\d{2,3}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日/.test(i.str));
    if (cjkDateItems.length) {
      logDate = parseDate(cjkDateItems[0].str);
    }
  }
  if (!logDate) {
    // Try slash format, prefer items near the top of the page (y > 700)
    const dateItems = items.filter(i =>
      /^\d{2,3}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(i.str)
    );
    console.log(`[PDF Parser] Page ${pageNum} — all date-like items (fallback):`, dateItems.slice(0, 5));
    // Pick the one closest to the label's y coordinate, or the first one
    const labelY = dateLabelItem?.y ?? 770;
    const sorted = dateItems.sort((a, b) => Math.abs(a.y - labelY) - Math.abs(b.y - labelY));
    if (sorted.length) logDate = parseDate(sorted[0].str);
  }
  console.log(`[PDF Parser] Page ${pageNum} — resolved logDate:`, logDate);
  if (!logDate) return null;

  // --- 2. Weather ---
  const VALID_WEATHER = ['晴', '多雲', '陰', '小雨', '中雨', '大雨', '颱風', '豪雨'];
  let weatherAm = null;
  let weatherPm = null;

  // Find items containing '上午' and '下午'
  const amItem = items.find(i => i.str.includes('上午'));
  const pmItem = items.find(i => i.str.includes('下午'));

  if (amItem) {
    // Check if weather is embedded (e.g. "上午：晴")
    const embeddedMatch = amItem.str.match(/(?:上午)[:：\s]*(晴|多雲|陰|小雨|中雨|大雨|颱風|豪雨)/);
    if (embeddedMatch) {
      weatherAm = embeddedMatch[1];
    } else {
      // Look for the weather word to the right (same y ± 5)
      const afterAm = items.filter(i => Math.abs(i.y - amItem.y) <= 5 && i.x > amItem.x).sort((a,b) => a.x - b.x);
      weatherAm = afterAm.find(i => VALID_WEATHER.includes(i.str))?.str ?? null;
    }
  }

  if (pmItem) {
    const embeddedMatch = pmItem.str.match(/(?:下午)[:：\s]*(晴|多雲|陰|小雨|中雨|大雨|颱風|豪雨)/);
    if (embeddedMatch) {
      weatherPm = embeddedMatch[1];
    } else {
      const afterPm = items.filter(i => Math.abs(i.y - pmItem.y) <= 5 && i.x > pmItem.x).sort((a,b) => a.x - b.x);
      weatherPm = afterPm.find(i => VALID_WEATHER.includes(i.str))?.str ?? null;
    }
  }

  // --- 3. Progress ---
  let plannedProgress = null;
  let actualProgress = null;
  
  // Find labels for progress anywhere on the page
  const predLabel = items.find(i => i.str.includes('預定進度') || i.str.includes('預定'));
  const actLabel = items.find(i => i.str.includes('實際進度') || i.str.includes('實際'));

  if (predLabel) {
    // Look for numbers on the same line (y ± 5)
    const nums = items.filter(i => Math.abs(i.y - predLabel.y) <= 5 && /^[\d.]+$/.test(i.str));
    if (nums.length) {
      // Pick the number closest to the label to its right, or to its left if none on right
      const rightNums = nums.filter(i => i.x > predLabel.x).sort((a,b) => a.x - b.x);
      const leftNums = nums.filter(i => i.x < predLabel.x).sort((a,b) => predLabel.x - a.x);
      plannedProgress = parseFloat((rightNums[0] || leftNums[0])?.str) || null;
    }
  }

  if (actLabel) {
    const nums = items.filter(i => Math.abs(i.y - actLabel.y) <= 5 && /^[\d.]+$/.test(i.str));
    if (nums.length) {
      const rightNums = nums.filter(i => i.x > actLabel.x).sort((a,b) => a.x - b.x);
      const leftNums = nums.filter(i => i.x < actLabel.x).sort((a,b) => actLabel.x - a.x);
      actualProgress = parseFloat((rightNums[0] || leftNums[0])?.str) || null;
    }
  }

  // --- 4. Work Items (Table section) ---
  // A coordinate-agnostic approach:
  // 1. Filter out boilerplate headers and footers (y > 740 or y < 50)
  // 2. Group Remaining items by Y coordinate
  // 3. Keep rows that look like table data (contain at least one non-number string and at least one number)
  const tableItems = items.filter(i => i.y < 740 && i.y > 50 && !isBoilerplate(i.str));
  
  // Group by Y (allow 4px variance for slight misalignments)
  const rowsByY = [];
  tableItems.forEach(item => {
    // skip section headers
    if (/^[壹貳參肆一二三四五六七八九十]$/.test(item.str)) return;
    if (/^(工程項目|單位|契約數量|今日|累計|發包工程費|第.號明細表|約定之重要施工)/.test(item.str)) return;
    
    let row = rowsByY.find(r => Math.abs(r.y - item.y) <= 4);
    if (!row) {
      row = { y: item.y, items: [] };
      rowsByY.push(row);
    }
    row.items.push(item);
  });

  // Find the exact X coordinates for all numeric columns based on the table headers
  const contractHeader = items.find(i => i.str.includes('契約') || i.str.includes('設計數量'));
  const todayHeader = items.find(i => (i.str.includes('今日') || i.str.includes('本日')) && i.str.includes('數'));
  const cumulHeader = items.find(i => i.str.includes('累計'));

  const colXs = {
    contract: contractHeader ? contractHeader.x : 250,
    today: todayHeader ? todayHeader.x : 330,
    cumul: cumulHeader ? cumulHeader.x : 410,
  };

  const workItemsArr = [];
  rowsByY.sort((a, b) => b.y - a.y); // top to bottom

  for (const row of rowsByY) {
    if (row.items.length < 2) continue; // skip floating single items
    row.items.sort((a, b) => a.x - b.x); // left to right
    
    const texts = row.items.filter(i => /[^\d,.%\-\s]/.test(i.str));
    const nums = row.items.filter(i => /^[\d,.%-]+$/.test(i.str));
    
    if (texts.length > 0 && nums.length > 0) {
      const name = texts[0].str;
      if (name.length <= 1) continue;

      // Skip overhead / pro-rata items commonly found in TW public works
      if (/(清運費|清潔費|清除費|灑水費|環境保護|作業費|搬運費|設施|管理費|利雜費|營業稅|攝影|測量|檢驗費|保險費|工程牌|維持費|應變措施|交通維持|圖說|安衛)/.test(name)) continue;
      
      const unit = texts.length > 1 ? texts[1].str : '';
      
      // Dynamic Nearest-Neighbor Column Mapping
      const assignedCols = {};
      for (const num of nums) {
        let bestCol = null;
        let minDistance = 9999;
        for (const [colName, colX] of Object.entries(colXs)) {
          const dist = Math.abs(num.x - colX);
          // If the text is long, its left X might be skewed. We allow flexible assignment.
          if (dist < minDistance) {
            minDistance = dist;
            bestCol = colName;
          }
        }
        if (bestCol && !assignedCols[bestCol]) {
            assignedCols[bestCol] = num.str;
        } else if (bestCol && assignedCols[bestCol]) {
            // Collision fallback: if mapped to same column, fallback to topology
            assignedCols.today = nums.length >= 3 ? nums[nums.length-2].str : num.str;
        }
      }

      let displayNum = assignedCols.today || '-';

      // Fallback: if 'today' was missing but num length === 2 and one mapped to cumul, the other to contract, today is truly empty.
      if (nums.length === 2 && assignedCols.contract && assignedCols.cumul && !assignedCols.today) {
          displayNum = '-';
      } else if (nums.length === 1 && !assignedCols.today) {
          displayNum = '-';
      }

      // Final sanitization
      if (displayNum !== '-' && displayNum !== '0' && displayNum !== '0.00' && displayNum !== '.') {
        workItemsArr.push(`${name}：${displayNum} ${unit}`.trim());
      }
    }
  }

  let workItemsStr = workItemsArr.join('\n') || null;

  // --- 5. Notes: section 二 content (excluding boilerplate) ---
  // Collect text from x<700, y<400 that is not boilerplate and not a table row
  
  // Track Y coordinates of ACTUAL table rows (where there are multiple columns)
  const validRowYs = rowsByY.filter(r => r.items.length >= 2).map(r => r.y);
  
  const noteItems = items.filter(i => {
    // If this item is vertically associated with a valid table row (within 4px), skip it
    const isTablePart = validRowYs.some(rowY => Math.abs(rowY - i.y) <= 4);
    
    return i.y < 700 && i.y > 50 &&
           !isBoilerplate(i.str) &&
           !isTablePart &&
           i.str.length > 2;
  }).sort((a,b) => b.y - a.y || a.x - b.x);
  
  const notes = [...new Set(noteItems.map(i => i.str))]
    .filter(s => !/^[\d,.%-]+$/.test(s) && !/^[壹貳參肆一二三四五六七八九十A-Za-z]$/.test(s))
    .filter(s => /^\d+\./.test(s.trim())) // Only accept enumerated list texts (e.g. "1. 進行整地")
    .slice(0, 10)
    .join('\n') || null;

  // Narrative Fallback: If the user didn't write ANY valid quantities in the formal matrix table,
  // but they DID write free text about what they worked on (e.g. "進行整地"), use it as the item!
  if (!workItemsStr && notes) {
      workItemsStr = notes;
  }

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
        const pdf = await pdfjsLib.getDocument({ 
          data: arrayBuffer,
          cMapUrl: 'https://unpkg.com/pdfjs-dist@5.6.205/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@5.6.205/standard_fonts/'
        }).promise;
        totalPages += pdf.numPages;
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const rec = await parseMonitoringPage(page, pageNum);
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
        
        if (rec.work_items) {
          const allItems = [ex.work_items, rec.work_items].filter(Boolean).join('\n').split('\n').map(s => s.trim()).filter(Boolean);
          const uniqueItems = new Map();
          allItems.forEach(item => {
              const normalized = item.replace(/\s+/g, '');
              if (!uniqueItems.has(normalized)) uniqueItems.set(normalized, item);
          });
          ex.work_items = Array.from(uniqueItems.values()).join('\n');
        }
        
        if (rec.notes) {
          const allNotes = [ex.notes, rec.notes].filter(Boolean).join('\n').split('\n').map(s => s.trim()).filter(Boolean);
          const uniqueNotes = new Map();
          allNotes.forEach(note => {
              const normalized = note.replace(/\s+/g, '');
              if (!uniqueNotes.has(normalized)) uniqueNotes.set(normalized, note);
          });
          ex.notes = Array.from(uniqueNotes.values()).join('\n');
        }
        
        if (!ex.weather_am && rec.weather_am) ex.weather_am = rec.weather_am;
        if (!ex.weather_pm && rec.weather_pm) ex.weather_pm = rec.weather_pm;
        
        if (typeof rec.planned_progress === 'number') {
            ex.planned_progress = Math.max(ex.planned_progress || 0, rec.planned_progress);
        }
        if (typeof rec.actual_progress === 'number') {
            ex.actual_progress = Math.max(ex.actual_progress || 0, rec.actual_progress);
        }
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
      await Promise.all([
        supabase.from('daily_logs').delete().eq('project_id', projectId).in('log_date', datesToClean),
        supabase.from('daily_report_items').delete().eq('project_id', projectId).in('log_date', datesToClean),
        supabase.from('progress_records').delete().eq('project_id', projectId).in('report_date', datesToClean),
      ]);

      // Step 2: Insert new daily_logs records
      const { error: insError } = await supabase
        .from('daily_logs')
        .insert(payload);

      if (insError) {
        throw new Error('寫入日誌失敗：' + insError.message);
      }

      // Step 3: Upsert progress_records (fixes Dashboard/Analytics data chain)
      const progressPayload = mappedRows
        .filter(r => r.planned_progress > 0 || r.actual_progress > 0)
        .map(r => ({
          project_id: projectId,
          report_date: r.log_date,
          planned_progress: r.planned_progress || 0,
          actual_progress: r.actual_progress || 0,
          created_by: user?.id || null,
        }));
      if (progressPayload.length) {
        const { error: progErr } = await supabase.from('progress_records').upsert(progressPayload, { onConflict: 'project_id,report_date' });
        if (progErr) throw new Error('寫入 progress_records 失敗: ' + progErr.message);
      }

      // Step 4: Parse work_items text → daily_report_items rows
      const itemPayload = [];
      for (const r of mappedRows) {
        if (!r.work_items) continue;
        r.work_items.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (!trimmed) return;
          const m = trimmed.match(/^(.+?)：([\d.]+)\s*(.*)$/);
          if (m) {
            itemPayload.push({
              project_id: projectId,
              log_date: r.log_date,
              item_name: m[1].trim(),
              unit: m[3].trim() || null,
              today_qty: parseFloat(m[2]) || 0,
              cumulative_qty: 0,
              note: null,
            });
          }
        });
      }
      if (itemPayload.length) {
        const { error: itemErr } = await supabase.from('daily_report_items').insert(itemPayload);
        if (itemErr) console.error('寫入 daily_report_items 失敗:', itemErr.message);
      }

      setDone(true);
      setTimeout(() => { onSuccess?.(); onClose(); }, 1200);

    } catch (err) {
      console.error('Import Exception:', err);
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
