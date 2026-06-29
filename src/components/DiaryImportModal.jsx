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
  // NFKC 正規化：將 CJK 相容字元（例如 U+F98E「年」）轉為標準字元（U+5E74）
  // 否則 regex /年/ 無法匹配相容區的「年」，導致日期解析失敗
  return content.items
    .map(item => ({
      str: item.str.normalize('NFKC').trim(),
      x: Math.round(item.transform[4]),
      y: Math.round(item.transform[5]),
      w: Math.round(item.width || 0),
    }))
    .filter(i => i.str !== '');
}

// 合併同列相鄰 item（處理 pdfjs 將每個漢字拆成獨立 item 的 PDF）
// gap ≤ 12px 視為相鄰字元，> 12px 視為不同欄位
// 同列 items 的 y 會統一為該列的「群組 key y」，避免後續以 y 排序時亂序
function mergeAdjacentItems(rawItems) {
  if (!rawItems.length) return rawItems;
  const lines = new Map();
  for (const item of rawItems) {
    let key = item.y;
    for (const y of lines.keys()) {
      if (Math.abs(y - item.y) <= 2) { key = y; break; }
    }
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push(item);
  }
  const result = [];
  for (const [keyY, lineItems] of lines.entries()) {
    lineItems.sort((a, b) => a.x - b.x);
    let cur = { ...lineItems[0], y: keyY };
    for (let i = 1; i < lineItems.length; i++) {
      const next = lineItems[i];
      const curEnd = cur.x + (cur.w || cur.str.length * 10);
      if (next.x - curEnd <= 12) {
        cur = { str: cur.str + next.str, x: cur.x, y: keyY, w: (next.x + (next.w || 0)) - cur.x };
      } else {
        result.push(cur);
        cur = { ...next, y: keyY };
      }
    }
    result.push(cur);
  }
  return result;
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

// 由 開工日期 + 累計天數 推算當日日期
function dateFromStartPlusCumul(startStr, cumulDays) {
  const startISO = parseDate(startStr);
  if (!startISO || !Number.isFinite(cumulDays) || cumulDays < 1) return null;
  const d = new Date(startISO + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + cumulDays - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// 在 items 中找出區段 (一/二/三/四/五) 的索引 (依閱讀順序)
function findSectionIdxs(items) {
  const result = { '一': -1, '二': -1, '三': -1, '四': -1, '五': -1 };
  for (let i = 0; i < items.length; i++) {
    for (const ch of Object.keys(result)) {
      if (result[ch] !== -1) continue;
      if (new RegExp(`^${ch}\\s*[、,，]`).test(items[i].str)) {
        result[ch] = i;
      }
    }
  }
  return result;
}

// 判斷兩個 item 是否在同一邏輯列 (同頁 + y 差 ≤ tol)
function sameRow(a, b, tol = 5) {
  return a.pageNum === b.pageNum && Math.abs(a.y - b.y) <= tol;
}

// ---------------------------------------------------------------------------
// 將一份「監造報表」(可能跨頁) 的 item 串流解析為結構化記錄
// items: 已按閱讀順序排序、含 pageNum 的 item 陣列
// ---------------------------------------------------------------------------
function parseReport(items) {
  if (!items.length) return null;

  const sectionIdxs = findSectionIdxs(items);
  const signIdx = items.findIndex(i => i.str.includes('監造單位簽章'));

  // --- 1. Report Date ---
  let logDate = null;
  const dateLabelItem = items.find(i =>
    i.str.startsWith('填表日期') || i.str.startsWith('填報日期')
  );
  if (dateLabelItem) {
    const embeddedDate = dateLabelItem.str.match(/(\d{2,4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (embeddedDate) {
      logDate = parseDate(`${embeddedDate[1]}年${embeddedDate[2]}月${embeddedDate[3]}日`);
    }
    if (!logDate) {
      const near = items.filter(i =>
        sameRow(i, dateLabelItem, 8) &&
        i.x > dateLabelItem.x - 10 &&
        i.x < dateLabelItem.x + 200 &&
        i !== dateLabelItem &&
        (/\d{2,4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(i.str) || /\d{2,4}\s*年/.test(i.str))
      );
      if (near.length) logDate = parseDate(near[0].str);
    }
  }

  // Fallback 1: 累計日期 + 開工日期
  if (!logDate) {
    const contractRow = items.find(i => i.str === '契約工期' || i.str.startsWith('契約工期'));
    if (contractRow) {
      const rowItems = items
        .filter(i => sameRow(i, contractRow, 3))
        .sort((a, b) => a.x - b.x);
      const startIdx = rowItems.findIndex(i => i.str.includes('開工日期'));
      const cumulIdx = rowItems.findIndex(i =>
        i.str.includes('累計日期') || i.str.includes('累計工期') || i.str.includes('累計天數')
      );
      const startStr = startIdx >= 0 ? rowItems[startIdx + 1]?.str : null;
      const cumulStr = cumulIdx >= 0 ? rowItems[cumulIdx + 1]?.str : null;
      const cumulDays = cumulStr ? parseInt(String(cumulStr).replace(/[^\d]/g, ''), 10) : NaN;
      logDate = dateFromStartPlusCumul(startStr, cumulDays);
    }
  }
  if (!logDate) return null;

  // --- 2. Weather ---
  const VALID_WEATHER = ['晴', '多雲', '陰', '豪雨', '大雨', '中雨', '小雨', '颱風', '雨'];
  const WEATHER_RX_ALT = VALID_WEATHER.join('|');
  let weatherAm = null;
  let weatherPm = null;

  const amItem = items.find(i => i.str.includes('上午'));
  const pmItem = items.find(i => i.str.includes('下午'));

  if (amItem) {
    const m = amItem.str.match(new RegExp(`(?:上午)[:：\\s]*(${WEATHER_RX_ALT})`));
    if (m) {
      weatherAm = m[1];
    } else {
      const after = items
        .filter(i => sameRow(i, amItem) && i.x > amItem.x)
        .sort((a, b) => a.x - b.x);
      weatherAm = after.find(i => VALID_WEATHER.includes(i.str))?.str ?? null;
    }
  }
  if (pmItem) {
    const m = pmItem.str.match(new RegExp(`(?:下午)[:：\\s]*(${WEATHER_RX_ALT})`));
    if (m) {
      weatherPm = m[1];
    } else {
      const after = items
        .filter(i => sameRow(i, pmItem) && i.x > pmItem.x)
        .sort((a, b) => a.x - b.x);
      weatherPm = after.find(i => VALID_WEATHER.includes(i.str))?.str ?? null;
    }
  }

  // --- 3. Progress ---
  let plannedProgress = null;
  let actualProgress = null;

  const predLabel = items.find(i => i.str.includes('預定進度'))
    || items.find(i => i.str.includes('預定') && !i.str.includes('完工') && !i.str.includes('日期'));
  const actLabel = items.find(i => i.str.includes('實際進度'))
    || items.find(i => i.str.includes('實際') && !i.str.includes('完工') && !i.str.includes('日期'));

  if (predLabel) {
    const nums = items.filter(i => sameRow(i, predLabel) && /^[\d.]+$/.test(i.str));
    if (nums.length) {
      const r = nums.filter(i => i.x > predLabel.x).sort((a, b) => a.x - b.x);
      const l = nums.filter(i => i.x < predLabel.x).sort((a, b) => predLabel.x - a.x);
      plannedProgress = parseFloat((r[0] || l[0])?.str) || null;
    }
  }
  if (actLabel) {
    const nums = items.filter(i => sameRow(i, actLabel) && /^[\d.]+$/.test(i.str));
    if (nums.length) {
      const r = nums.filter(i => i.x > actLabel.x).sort((a, b) => a.x - b.x);
      const l = nums.filter(i => i.x < actLabel.x).sort((a, b) => actLabel.x - a.x);
      actualProgress = parseFloat((r[0] || l[0])?.str) || null;
    }
  }

  // --- 4. Work Items: 區段一 ~ 區段二 之間 ---
  const workArea = (sectionIdxs['一'] >= 0 && sectionIdxs['二'] > sectionIdxs['一'])
    ? items.slice(sectionIdxs['一'] + 1, sectionIdxs['二'])
    : [];

  // 嘗試矩陣解析 (依 (pageNum, y) 群組成列)
  const rowsByY = [];
  workArea.forEach(item => {
    if (isBoilerplate(item.str)) return;
    if (/^[壹貳參肆一二三四五六七八九十]$/.test(item.str)) return;
    if (/^(工程項目|單位|契約數量|今日|累計|發包工程費|第.號明細表|約定之重要施工)/.test(item.str)) return;
    let row = rowsByY.find(r => r.pageNum === item.pageNum && Math.abs(r.y - item.y) <= 4);
    if (!row) {
      row = { pageNum: item.pageNum, y: item.y, items: [] };
      rowsByY.push(row);
    }
    row.items.push(item);
  });

  const colXs = { contract: 250, today: 330, cumul: 410 };
  const contractHeader = items.find(i => i.str.includes('契約數量') || i.str.includes('設計數量'));
  const todayHeader = items.find(i => (i.str.includes('今日') || i.str.includes('本日')) && i.str.includes('數'));
  const cumulHeader = items.find(i => i.str.includes('累計') && i.str.includes('數'));
  if (contractHeader) colXs.contract = contractHeader.x;
  if (todayHeader) colXs.today = todayHeader.x;
  if (cumulHeader) colXs.cumul = cumulHeader.x;

  const workItemsArr = [];
  rowsByY.sort((a, b) => a.pageNum - b.pageNum || b.y - a.y);

  for (const row of rowsByY) {
    if (row.items.length < 2) continue;
    row.items.sort((a, b) => a.x - b.x);

    const texts = row.items.filter(i => /[^\d,.%\-\s]/.test(i.str));
    const nums = row.items.filter(i => /^[\d,.%-]+$/.test(i.str));

    if (texts.length > 0 && nums.length > 0) {
      const name = texts[0].str;
      if (name.length <= 1) continue;
      if (/(清運費|清潔費|清除費|灑水費|環境保護|作業費|搬運費|設施|管理費|利雜費|營業稅|攝影|測量|檢驗費|保險費|工程牌|維持費|應變措施|交通維持|圖說|安衛)/.test(name)) continue;
      const unit = texts.length > 1 ? texts[1].str : '';

      const assignedCols = {};
      for (const num of nums) {
        let bestCol = null;
        let minDistance = 9999;
        for (const [colName, colX] of Object.entries(colXs)) {
          const dist = Math.abs(num.x - colX);
          if (dist < minDistance) { minDistance = dist; bestCol = colName; }
        }
        if (bestCol && !assignedCols[bestCol]) {
          assignedCols[bestCol] = num.str;
        } else if (bestCol && assignedCols[bestCol]) {
          assignedCols.today = nums.length >= 3 ? nums[nums.length - 2].str : num.str;
        }
      }

      let displayNum = assignedCols.today || '-';
      if (nums.length === 2 && assignedCols.contract && assignedCols.cumul && !assignedCols.today) displayNum = '-';
      else if (nums.length === 1 && !assignedCols.today) displayNum = '-';

      if (displayNum !== '-' && displayNum !== '0' && displayNum !== '0.00' && displayNum !== '.') {
        workItemsArr.push(`${name}：${displayNum} ${unit}`.trim());
      }
    }
  }
  let workItemsStr = workItemsArr.join('\n') || null;

  // 敘述式工項擷取 (例：「1.荷苞嶼橋下游段… 2.…混凝土澆置」)
  if (!workItemsStr) {
    const narrative = workArea
      .filter(i => i.str.length >= 4 && !/^[\d,.%-]+$/.test(i.str) && !isBoilerplate(i.str))
      .map(i => i.str.trim())
      .join(' ')
      .trim();
    if (narrative) workItemsStr = narrative;
  }

  // --- 5. Notes: 區段五 ~ 監造單位簽章 之間 ---
  const noteEndIdx = signIdx > sectionIdxs['五'] ? signIdx : items.length;
  const noteArea = sectionIdxs['五'] >= 0
    ? items.slice(sectionIdxs['五'] + 1, noteEndIdx)
    : [];

  const noteSeen = new Set();
  const noteParts = [];
  for (const item of noteArea) {
    const s = item.str.trim();
    if (s.length <= 2) continue;
    if (isBoilerplate(s)) continue;
    if (/^[\d,.%-]+$/.test(s)) continue;
    if (/^[壹貳參肆一二三四五六七八九十A-Za-z]$/.test(s)) continue;
    if (noteSeen.has(s)) continue;
    noteSeen.add(s);
    noteParts.push(s);
  }
  let notes = noteParts.join('\n') || null;
  if (notes && notes.length > 500) notes = notes.slice(0, 500);

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
// 將整份 PDF 的 items 依「本日天氣」標記分段為多份報表
// ---------------------------------------------------------------------------
function segmentReports(allItems) {
  const weatherIdxs = [];
  for (let i = 0; i < allItems.length; i++) {
    if (allItems[i].str.includes('本日天氣')) weatherIdxs.push(i);
  }
  if (!weatherIdxs.length) return [];

  const segments = [];
  for (let n = 0; n < weatherIdxs.length; n++) {
    const start = weatherIdxs[n];
    const end = n + 1 < weatherIdxs.length ? weatherIdxs[n + 1] : allItems.length;
    segments.push(allItems.slice(start, end));
  }
  return segments;
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
          cMapUrl: '/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/standard_fonts/',
        }).promise;
        totalPages += pdf.numPages;

        // 將整份 PDF 的 items 依「閱讀順序」(頁碼遞增、頁內 y 從大到小) 排序
        const allItems = [];
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const items = mergeAdjacentItems(await extractPageItems(page));
          items.forEach(it => allItems.push({ ...it, pageNum }));
        }
        allItems.sort((a, b) => a.pageNum - b.pageNum || b.y - a.y);

        // 以「本日天氣」標記分段，每段對應一份每日報表 (可能跨 2 頁)
        const segments = segmentReports(allItems);
        for (const seg of segments) {
          const rec = parseReport(seg);
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
      // 支援兩種格式：
      //   (a) 矩陣式：「name：N unit」(舊版每行一項)
      //   (b) 敘述式：「1.XXX 2.YYY 3.ZZZ」(監造報表narrative)
      const itemPayload = [];
      for (const r of mappedRows) {
        if (!r.work_items) continue;
        const text = r.work_items.trim();
        if (text === '本日無施工' || /^1\.?\s*無施工$/.test(text)) continue;

        const matrixLines = text.split('\n').map(s => s.trim()).filter(Boolean);
        const matrixRows = [];
        for (const line of matrixLines) {
          const m = line.match(/^(.+?)：([\d.]+)\s*(.*)$/);
          if (m) {
            matrixRows.push({
              project_id: projectId, log_date: r.log_date,
              item_name: m[1].trim(),
              unit: m[3].trim() || null,
              today_qty: parseFloat(m[2]) || 0,
              cumulative_qty: 0, note: null,
            });
          }
        }
        if (matrixRows.length) {
          itemPayload.push(...matrixRows);
          continue;
        }

        // 敘述式：以「(行首或空白)+數字.」為項次分隔符拆出多項
        // 例：「1.荷苞嶼橋下游段...pc樁打設 2.1K+718~1K+844 140混凝土澆置」
        //  → ["荷苞嶼橋下游段...pc樁打設", "1K+718~1K+844 140混凝土澆置"]
        // 註：要求項次符號前有空白或字串開頭，避免把 "1.5公斤" 拆錯
        const narrative = text.replace(/\n/g, ' ').trim();
        const parts = narrative.split(/(?:^|\s)\d+[\.\．、]\s*/).map(s => s.trim()).filter(Boolean);
        if (parts.length === 0) continue;
        for (const part of parts) {
          itemPayload.push({
            project_id: projectId, log_date: r.log_date,
            item_name: part.length > 200 ? part.slice(0, 200) : part,
            unit: null,
            today_qty: 1,
            cumulative_qty: 0,
            note: null,
          });
        }
      }
      if (itemPayload.length) {
        const { error: itemErr } = await supabase.from('daily_report_items').insert(itemPayload);
        if (itemErr) console.error('寫入 daily_report_items 失敗:', itemErr.message);
      }

      setDone(true);
      const importedDates = mappedRows.map(r => r.log_date);
      setTimeout(() => { onSuccess?.(importedDates); onClose(); }, 1200);

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
