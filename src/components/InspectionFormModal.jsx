/* ============================================================
   InspectionFormModal.jsx — 施工抽查紀錄表填寫 Modal
   ============================================================ */
import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Printer, Cloud, Loader2, CheckSquare, Save, Trash2, Camera, ScanText } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import {
  INSPECTION_TEMPLATES, TEMPLATE_OPTIONS, INSPECT_TYPE_OPTIONS,
  FLOW_OPTIONS, RESULT_SYMBOL, guessTemplateCode,
} from '../config/inspectionFormTemplates';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import './InspectionFormModal.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/* ── Google Drive 工具（與 PhotoTable.jsx 相同邏輯） ── */
const GCLIENT_ID           = import.meta.env.VITE_GOOGLE_CLIENT_ID                  || '';
const INSPECTION_FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_INSPECTION_FOLDER_ID || '';
/* ── Google Vision 文字辨識（與 PhotoTable.jsx 相同邏輯） ── */
const GAPI_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';

let _gisReady = false;
function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}
async function getGoogleToken() {
  if (!_gisReady) { await loadScript('https://accounts.google.com/gsi/client'); _gisReady = true; }
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GCLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: resp => resp.error ? reject(new Error(resp.error)) : resolve(resp.access_token),
    });
    client.requestAccessToken({ prompt: '' });
  });
}
async function getOrCreateFolder(token, parentId, name) {
  const q = encodeURIComponent(
    `'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const { files } = await res.json();
  if (files?.length > 0) return files[0].id;
  const cr = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  return (await cr.json()).id;
}
async function uploadHtmlToDrive(htmlBlob, filename, token, workItem, date) {
  if (!INSPECTION_FOLDER_ID) throw new Error('尚未設定 VITE_GOOGLE_DRIVE_INSPECTION_FOLDER_ID');
  let parentId = INSPECTION_FOLDER_ID;
  if (workItem) parentId = await getOrCreateFolder(token, parentId, workItem);
  const dateStr = (date || new Date().toISOString().split('T')[0]).replace(/-/g, '');
  parentId = await getOrCreateFolder(token, parentId, dateStr);

  const form = new FormData();
  form.append('metadata', new Blob(
    [JSON.stringify({ name: filename, parents: [parentId], mimeType: 'text/html' })],
    { type: 'application/json' }
  ));
  form.append('file', htmlBlob);
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink',
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
  );
  if (!res.ok) throw new Error(`上傳失敗（${res.status}）`);
  return await res.json();
}

/* ── ROC 日期格式 ── */
function toRocDate(d) {
  if (!d) return '　　年　　月　　日';
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getFullYear() - 1911} 年 ${dt.getMonth() + 1} 月 ${dt.getDate()} 日`;
}

/* ── PDF 掃描檔辨識匯入：民國年字串 → 西元 ISO 日期 ── */
function parseRocDateStr(str) {
  const m = String(str || '').match(/(\d{2,3})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const year = y < 1000 ? y + 1911 : y;
  return `${year}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
}

/* ── PDF 掃描檔辨識匯入：將 PDF 各頁轉為圖片（供 Vision OCR 使用） ── */
async function renderPdfPagesToImages(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: buf, cMapUrl: '/cmaps/', cMapPacked: true, standardFontDataUrl: '/standard_fonts/',
  }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    pages.push({ pageNum: i, dataUrl: canvas.toDataURL('image/jpeg', 0.85) });
  }
  return pages;
}

/* ── PDF 掃描檔辨識匯入：呼叫 Google Vision DOCUMENT_TEXT_DETECTION，回傳含座標的完整結果 ── */
async function recognizeInspectionImage(imageDataUrl) {
  const base64 = imageDataUrl.split(',')[1];
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${GAPI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{ image: { content: base64 }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] }],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'Vision API 錯誤');
  return json.responses?.[0] || {};
}

/* ── PDF 掃描檔辨識匯入：將 Vision 回傳的段落攤平為含座標的清單，依 y 再 x 排序 ──
   表格為「管理項目/抽查標準」印刷體＋「實際抽查情形/抽查結果」手寫的固定版面，
   若只用攤平文字比對，遇到印刷體換行、或標準說明文字剛好包含其他項目名稱時容易對錯欄位，
   因此改用段落座標分辨欄位（管理項目 vs 抽查標準 vs 實際抽查情形 vs 抽查結果），避免誤植。 */
function collectOcrParagraphs(visionResponse) {
  const page = visionResponse?.fullTextAnnotation?.pages?.[0];
  if (!page) return [];
  const out = [];
  for (const block of page.blocks || []) {
    for (const para of block.paragraphs || []) {
      const text = (para.words || []).map(w => (w.symbols || []).map(s => s.text).join('')).join('');
      const verts = para.boundingBox?.vertices || [];
      const xs = verts.map(v => v.x || 0);
      const ys = verts.map(v => v.y || 0);
      if (!text.trim() || !xs.length) continue;
      out.push({ text: text.trim(), x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) });
    }
  }
  return out.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
}

function yOverlaps(a, b, tol = 10) {
  return a.y0 <= b.y1 + tol && b.y0 <= a.y1 + tol;
}

/* ── PDF 掃描檔辨識匯入：解析表頭欄位（工程名稱等已由系統帶入，僅解析手寫欄位） ──
   檢查位置值可能多行，垂直範圍以上一列標籤（分項工程名稱）底部與下一列標籤（施工流程）頂部為界，
   避免吸入相鄰列的勾選框文字。 */
function parseInspectionHeader(paragraphs) {
  const result = { formTitle: paragraphs[0]?.text || '' };

  const locLabel  = paragraphs.find(p => p.text.includes('檢查位置'));
  const dateLabel = paragraphs.find(p => p.text.includes('檢查日期'));
  if (locLabel) {
    const aboveLabel = paragraphs.find(p => p.text.includes('分項工程名稱'));
    const belowLabel = paragraphs.find(p => p.text.includes('施工流程') || p.text.includes('檢查時機'));
    const yTop    = aboveLabel ? aboveLabel.y1 : locLabel.y0 - 40;
    const yBottom = belowLabel ? belowLabel.y0 : locLabel.y1 + 40;
    const rightBound = dateLabel ? dateLabel.x0 : Infinity;
    // Vision 可能把位置最後一行與下一列的勾選框文字合併成同一段，故在「□／☑」處截斷
    const loc = paragraphs
      .filter(p => p !== locLabel && p !== dateLabel
        && p.y0 > yTop - 6 && p.y0 < yBottom - 4
        && p.x0 > locLabel.x1 - 4 && p.x0 < rightBound)
      .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)
      .map(p => p.text).join('')
      .split(/[□☑✓]/)[0].trim();
    if (loc) result.location = loc;
  }
  if (dateLabel) {
    const dateVal = paragraphs
      .find(p => p !== dateLabel && yOverlaps(p, dateLabel) && p.x0 > dateLabel.x1 - 4 && /\d/.test(p.text));
    if (dateVal) result.date = parseRocDateStr(dateVal.text);
  }

  return result;
}

/* ── PDF 掃描檔辨識匯入：手寫結果符號比對 ──
   實測 Vision 會把手寫「○」辨識成「。」「D」「0」等相近字元，故放寬符號集；
   僅比對結果欄內「單獨成段」的字元，不會影響其他欄位文字。 */
const PASS_SYMBOL_RE = /^[○◯〇Oo0。D]$/;
const FAIL_SYMBOL_RE = /^[╳×Xx乂]$/;
const NA_SYMBOL_RE   = /^[／/\\]$/;

/* ── PDF 掃描檔辨識匯入：依「管理項目」欄位座標比對範本項目名稱，
   再依同一列的 y 範圍取「實際抽查情形」「抽查結果」欄位內容 ──
   若紙本表單多出範本沒有的項目（例如客製化追加的檢查列），該列直接被忽略，不會污染到相鄰項目。 */
function extractItemsFromParagraphs(paragraphs, template) {
  if (!paragraphs.length) return {};

  // 以四個欄位表頭的實際座標推算欄界（相鄰表頭間取中點），不依賴固定欄寬比例；
  // 掃描歪斜或表頭被拆段（「抽查結果」常被拆成「抽查結」「果」）時仍能定位。
  // find() 依 y 排序後由上而下，先找到表頭列文字，不會誤抓備註區的同字樣（如「2.抽查結果合格者…」）。
  const headerItem   = paragraphs.find(p => p.text.includes('管理項目'));
  const headerStd    = paragraphs.find(p => p.text.includes('抽查標準'));
  const headerActual = paragraphs.find(p => p.text.includes('實際抽查情形'));
  const headerResult = paragraphs.find(p => p.text.includes('抽查結'));
  if (!headerItem || !headerStd || !headerActual || !headerResult) return {};

  const itemColEnd     = (headerItem.x1 + headerStd.x0) / 2;
  const actualColStart = (headerStd.x1 + headerActual.x0) / 2;
  const resultColStart = (headerActual.x1 + headerResult.x0) / 2;

  const dataTop = headerItem.y1;
  const stopLabel = paragraphs.find(p => p.y0 > dataTop && p.text.includes('缺失複查結果'));
  const dataBottom = stopLabel ? stopLabel.y0 : Infinity;

  // 每一列的錨點（含範本沒有的客製化列）：手寫內容常跨列邊界，依「垂直中心最接近的錨點」歸屬列；
  // 客製化列的錨點會吸走屬於它的手寫字，之後因無對應範本項目而整列捨棄，不污染相鄰項目
  const allRows = paragraphs
    .filter(p => p.y0 >= dataTop - 4 && p.y0 < dataBottom && p.x0 < itemColEnd)
    .sort((a, b) => a.y0 - b.y0);
  if (!allRows.length) return {};

  const rowEntries = allRows.map(r => ({
    centerY: (r.y0 + r.y1) / 2,
    it: template.items.find(x => r.text.includes(x.name) || x.name.includes(r.text)) || null,
  }));

  const closestEntry = (p) => {
    const c = (p.y0 + p.y1) / 2;
    let best = null, bestD = Infinity;
    for (const e of rowEntries) {
      const d = Math.abs(c - e.centerY);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  };

  const acc = {}; // { itemName: { actualParts: [para], resultParts: [para] } }
  for (const p of paragraphs) {
    if (p.y0 < dataTop - 8 || p.y0 >= dataBottom || p.x0 < actualColStart) continue;
    const e = closestEntry(p);
    if (!e?.it) continue;
    const slot = acc[e.it.name] || (acc[e.it.name] = { actualParts: [], resultParts: [] });
    if (p.x0 >= resultColStart) slot.resultParts.push(p);
    else slot.actualParts.push(p);
  }

  const items = {};
  for (const [name, { actualParts, resultParts }] of Object.entries(acc)) {
    const actual = actualParts
      .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)
      .map(p => p.text).join(' ').trim();
    let result = '';
    if (resultParts.some(p => FAIL_SYMBOL_RE.test(p.text)))      result = 'fail';
    else if (resultParts.some(p => PASS_SYMBOL_RE.test(p.text))) result = 'pass';
    else if (resultParts.some(p => NA_SYMBOL_RE.test(p.text)))   result = 'na';
    if (result || actual) items[name] = { result, actual };
  }

  return items;
}

/* ── 產生抽查單 HTML（用於列印 / Drive 上傳） ── */
function buildFormHtml({ template, header, items, defect, signImgSrc, supervisorImgSrc, projectName, contractor }) {
  const phases = ['施工前', '施工中', '施工完成'];
  const PHASE_LABELS = { '施工前': '施工前', '施工中': '施工中', '施工完成': '施工<br>完成' };

  const rowsHtml = phases.map(phase => {
    const phaseItems = template.items.filter(it => it.phase === phase);
    if (!phaseItems.length) return '';
    return phaseItems.map((it, idx) => {
      const res = items[it.name] || {};
      const SYM = {
        pass: `<svg width="19" height="19" viewBox="0 0 19 19" style="vertical-align:middle;display:inline-block"><path d="M9.5,2 C14,2.4 16.8,6 16.5,10.2 C16.2,14.5 12.8,17.2 9.2,17 C5.4,16.8 2.5,13.5 2.8,9.8 C3.1,5.8 6.2,2.4 9.5,2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
        fail: `<svg width="19" height="19" viewBox="0 0 19 19" style="vertical-align:middle;display:inline-block"><path d="M3.5,3.5 Q7,8.5 15.5,15.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M15.5,3.5 Q11,9 3.5,15.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
        na:   `<svg width="19" height="19" viewBox="0 0 19 19" style="vertical-align:middle;display:inline-block"><path d="M14,2.5 Q9.5,9.5 5,16.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
      };
      const sym = SYM[res.result] || '';
      const td1 = idx === 0
        ? `<td class="phase-cell" rowspan="${phaseItems.length}">${PHASE_LABELS[phase]}</td>`
        : '';
      return `<tr>
        ${td1}
        <td class="item-cell">${it.key ? '★' : ''}${it.name}</td>
        <td class="std-cell">${it.standard}</td>
        <td class="actual-cell">${(res.actual || '').replace(/\n/g, '<br>')}</td>
        <td class="result-cell">${sym}</td>
      </tr>`;
    }).join('');
  }).join('');

  const defectChecked1 = defect.resolved ? '☑' : '☐';
  const defectChecked2 = defect.unresolved ? '☑' : '☐';

  const signBlock = (label, src) => src
    ? `<span style="font-size:13pt;">${label}：<img src="${src}" style="height:40px;vertical-align:middle;margin-left:8px;"></span>`
    : `<span style="font-size:13pt;">${label}：＿＿＿＿＿＿＿</span>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>${template.label}施工抽查紀錄表</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700&family=Caveat:wght@600&display=swap" rel="stylesheet">
<style>
  body { font-family:'標楷體','DFKai-SB','BiauKai','Noto Serif TC',serif; margin:1.5cm; font-size:11pt; color:#000; }
  .title-row { display:flex; align-items:center; margin-bottom:6px; }
  .title-row h2 { flex:1; text-align:center; font-size:15pt; margin:0; white-space:nowrap; }
  .title-spacer { min-width:90px; }
  .title-row .serial { min-width:90px; font-size:10pt; text-align:right; white-space:nowrap; }
  .serial-blank { display:inline-block; width:60px; border-bottom:1px solid #333; vertical-align:bottom; margin-left:2px; }
  table { width:100%; border-collapse:collapse; table-layout:fixed; }
  th, td { border:1px solid #000; padding:5px 7px; vertical-align:middle; }
  .hdr-label { font-weight:bold; background:#f5f5f5; text-align:center; white-space:nowrap; }
  .phase-cell { text-align:center; font-weight:bold; background:#f5f5f5; white-space:nowrap; }
  .item-cell { word-break:break-word; line-height:1.5; }
  .std-cell { font-size:11pt; line-height:1.5; word-break:break-word; }
  .actual-cell { font-size:11pt; line-height:1.5; }
  .result-cell { text-align:center; font-family:'Caveat','Comic Sans MS',cursive; font-size:18pt; font-weight:600; }
  .defect-row td { font-size:10pt; }
  .note-row td { font-size:10pt; }
  .sign-row { margin-top:12px; display:flex; justify-content:flex-start; gap:60px; align-items:center; }
  @media print { body { margin:1cm; } }
</style>
</head>
<body>
<div class="title-row">
  <span class="title-spacer"></span>
  <h2>${template.label}施工抽查紀錄表</h2>
  <span class="serial">編號：${template.code}-01-<span class="serial-blank"></span></span>
</div>
<table>
  <colgroup>
    <col style="width:9%">
    <col style="width:21%">
    <col style="width:32%">
    <col style="width:27%">
    <col style="width:11%">
  </colgroup>
  <tr><td class="hdr-label">工程名稱</td><td colspan="4">${projectName || ''}</td></tr>
  <tr><td class="hdr-label">承包廠商</td><td colspan="4">${contractor || ''}</td></tr>
  <tr>
    <td class="hdr-label">檢查位置</td>
    <td>${header.location || ''}</td>
    <td class="hdr-label">檢查日期</td>
    <td colspan="2">${toRocDate(header.date)}</td>
  </tr>
  <tr>
    <td class="hdr-label">檢查時機</td>
    <td colspan="4">
      ${header.inspectType === '施工檢驗停留點' ? '☑' : '☐'} 施工檢驗停留點
      &emsp;${header.inspectType === '不定期檢查' ? '☑' : '☐'} 不定期檢查
    </td>
  </tr>
  <tr>
    <td class="hdr-label">施工流程</td>
    <td colspan="4">
      ${header.flow === '施工前' ? '☑' : '☐'} 施工前
      &emsp;${header.flow === '施工中檢查' ? '☑' : '☐'} 施工中檢查
      &emsp;${header.flow === '施工完成檢查' ? '☑' : '☐'} 施工完成檢查
    </td>
  </tr>
  <tr>
    <td class="hdr-label">檢查結果</td>
    <td colspan="4">○ 檢查合格　╳ 有缺失需改正　／ 無此檢查項目</td>
  </tr>
  <tr>
    <th colspan="2">管理項目</th>
    <th class="std-cell">依設計圖說、規範之抽查標準（定量定性，含容許誤差）</th>
    <th class="actual-cell">實際抽查情形（含檢查數據）</th>
    <th class="result-cell" style="font-family:inherit;font-size:11pt;white-space:nowrap;">抽查結果</th>
  </tr>
  ${rowsHtml}
  <tr class="defect-row">
    <td colspan="5">
      <strong>缺失複查結果：</strong><br>
      ${defectChecked1} 已立即完成改善（檢附改善前中後照片）<br>
      ${defectChecked2} 未完成改善，填具「不符合事項追蹤改善表」進行追蹤改善<br>
      複查日期：${defect.date ? toRocDate(defect.date) : '　　年　　月　　日'}　　複查人員職稱：${defect.reviewer || ''}　　簽名：${defect.reviewSign || ''}
    </td>
  </tr>
  <tr class="note-row">
    <td colspan="5">
      <strong>備註：</strong><br>
      1. 檢查標準及實際檢查情形應具體明確或量化尺寸。<br>
      2. 檢查結果合格者註明「○」，不合格者註明「╳」，如無需檢查之項目則打「／」。<br>
      3. 嚴重缺失、缺失複查未完成改善，應填具「不符合事項追蹤改善表」進行追蹤改善。
    </td>
  </tr>
</table>
<div class="sign-row">
  ${signBlock('監造人員', signImgSrc)}
  ${signBlock('監造主管', supervisorImgSrc)}
</div>
</body></html>`;
}

/* ── 主元件 ── */
export default function InspectionFormModal({ inspection, project, onClose, onSave }) {
  const { user } = useAuth();
  const guessedCode = guessTemplateCode(inspection?.work_item);
  const [templateCode, setTemplateCode] = useState(guessedCode || '');
  const template = INSPECTION_TEMPLATES.find(t => t.code === templateCode) || null;

  /* 表頭資料 */
  const [header, setHeader] = useState({
    location:    inspection?.location    || '',
    date:        inspection?.inspect_date || new Date().toISOString().split('T')[0],
    inspectType: inspection?.inspect_type || '',
    flow:        '',
    inspector:   inspection?.inspector   || '',
  });

  /* 各子項目結果 { [itemName]: { result: 'pass'|'fail'|'na'|'', actual: '' } } */
  const [items, setItems] = useState({});

  /* 缺失複查 */
  const [defect, setDefect] = useState({ resolved: false, unresolved: false, date: '', reviewer: '', reviewSign: '' });

  /* 簽署影像 */
  const [signImg,      setSignImg]      = useState(null);
  const [supervisorImg, setSupervisorImg] = useState(null);
  const signRef      = useRef(null);
  const supervisorRef = useRef(null);

  const [saving,          setSaving]          = useState(false);
  const [savingDb,        setSavingDb]        = useState(false);
  const [driveLink,       setDriveLink]       = useState('');
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [photoBatches,    setPhotoBatches]    = useState([]);
  const [photoLoading,    setPhotoLoading]    = useState(false);

  /* PDF 掃描檔辨識匯入 */
  const pdfFileRef       = useRef(null);
  const pendingOcrItems  = useRef(null);
  const [pdfPages,    setPdfPages]    = useState([]);
  const [pdfPickerOpen, setPdfPickerOpen] = useState(false);
  const [ocrLoading,  setOcrLoading]  = useState(false);

  /* 切換 template 時重置 items（若剛由 PDF 辨識帶入待套用的項目，改套用該項目而非清空） */
  useEffect(() => {
    if (pendingOcrItems.current) {
      setItems(pendingOcrItems.current);
      pendingOcrItems.current = null;
    } else {
      setItems({});
    }
  }, [templateCode]);

  /* 選擇 PDF 掃描檔 → 轉為各頁圖片 → 開啟頁面選取 */
  async function handlePdfFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!GAPI_KEY) { alert('尚未設定 VITE_GOOGLE_API_KEY，無法使用 PDF 辨識匯入'); return; }
    setOcrLoading(true);
    try {
      const pages = await renderPdfPagesToImages(file);
      setPdfPages(pages);
      setPdfPickerOpen(true);
    } catch (err) {
      alert(`PDF 讀取失敗：${err.message}`);
    } finally {
      setOcrLoading(false);
    }
  }

  /* 選定頁面 → 呼叫 Vision 辨識 → 套用至表頭與抽查項目 */
  async function handlePickPdfPage(dataUrl) {
    setPdfPickerOpen(false);
    setOcrLoading(true);
    try {
      const visionResponse = await recognizeInspectionImage(dataUrl);
      const paragraphs = collectOcrParagraphs(visionResponse);
      if (!paragraphs.length) { alert('未辨識到任何文字，請確認掃描檔清晰度'); return; }
      const parsed = parseInspectionHeader(paragraphs);

      const headerHits = (parsed.location ? 1 : 0) + (parsed.date ? 1 : 0);
      setHeader(h => ({
        ...h,
        ...(parsed.location ? { location: parsed.location } : {}),
        ...(parsed.date     ? { date: parsed.date }         : {}),
      }));

      const guessedCodeFromOcr = guessTemplateCode(parsed.formTitle);
      const useCode = templateCode || guessedCodeFromOcr;
      const useTemplate = INSPECTION_TEMPLATES.find(t => t.code === useCode);
      let itemHits = 0;
      if (useTemplate) {
        const newItems = extractItemsFromParagraphs(paragraphs, useTemplate);
        itemHits = Object.keys(newItems).length;
        if (!templateCode && useCode) {
          pendingOcrItems.current = newItems;
          setTemplateCode(useCode);
        } else {
          setItems(prev => ({ ...prev, ...newItems }));
        }
      }

      alert(`辨識完成：帶入 ${headerHits} 項基本資料、${itemHits} 項抽查結果。手寫內容辨識準確度有限，請務必逐項覆核後再儲存。`);
    } catch (err) {
      alert(`辨識失敗：${err.message}`);
    } finally {
      setOcrLoading(false);
    }
  }

  function setResult(itemName, result) {
    setItems(prev => ({ ...prev, [itemName]: { ...(prev[itemName] || {}), result } }));
  }
  function setActual(itemName, actual) {
    setItems(prev => ({ ...prev, [itemName]: { ...(prev[itemName] || {}), actual } }));
  }
  function clearAllActual() {
    setItems(prev => Object.fromEntries(
      Object.entries(prev).map(([k, v]) => [k, { ...v, actual: '' }])
    ));
  }

  async function loadPhotoBatches() {
    if (!supabase || !project?.id || !header.date) return;
    setPhotoLoading(true);
    const { data } = await supabase.from('archive_docs')
      .select('id, title, doc_no, remark')
      .eq('project_id', project.id).eq('category', 'photo').eq('doc_date', header.date)
      .order('created_at', { ascending: false });
    setPhotoBatches(data || []);
    setPhotoLoading(false);
    setPhotoPickerOpen(true);
  }

  function importFromBatch(batch) {
    const info = JSON.parse(batch.remark || '{}');
    const locs = [...new Set((info.photos || []).map(p => p.location).filter(Boolean))];
    if (locs.length) setHeader(h => ({ ...h, location: locs.join('、') }));
    setPhotoPickerOpen(false);
  }

  function readImgFile(file, setter) {
    if (!file) return;
    const r = new FileReader();
    r.onload = e => setter(e.target.result);
    r.readAsDataURL(file);
  }

  /* 列印 */
  function handlePrint() {
    if (!template) return alert('請先選擇工項');
    const html = buildFormHtml({
      template, header, items, defect,
      signImgSrc: signImg, supervisorImgSrc: supervisorImg,
      projectName: project?.name, contractor: project?.contractor,
    });
    const w = window.open('', '_blank', 'width=900,height=800');
    w.document.write(html);
    w.document.close();
    w.onload = () => { w.focus(); w.print(); };
  }

  /* 上傳 Drive */
  async function handleUploadDrive() {
    if (!template) return alert('請先選擇工項');
    setSaving(true);
    try {
      const token = await getGoogleToken();
      const html = buildFormHtml({
        template, header, items, defect,
        signImgSrc: signImg, supervisorImgSrc: supervisorImg,
        projectName: project?.name, contractor: project?.contractor,
      });
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const filename = `${template.code}_${template.label}_${header.date || 'nodate'}.html`;
      const result = await uploadHtmlToDrive(blob, filename, token, `${template.code} ${template.label}`, header.date);
      setDriveLink(result.webViewLink || '');
      alert('已上傳至 Google Drive！');
    } catch (e) { alert(`上傳失敗：${e.message}`); }
    finally { setSaving(false); }
  }

  /* 儲存至 construction_inspections */
  async function handleSaveDb() {
    if (!template) return alert('請先選擇工項');
    if (!supabase) return alert('資料庫未連線');
    setSavingDb(true);
    try {
      const results = Object.values(items).map(v => v.result).filter(Boolean);
      const overallResult = results.includes('fail') ? '不合格'
        : results.length > 0 && results.every(r => r === 'pass') ? '合格'
        : '待複驗';
      const payload = {
        project_id:   project?.id,
        created_by:   user?.id,
        inspect_date: header.date,
        work_item:    template.label,
        location:     header.location || null,
        inspect_type: header.inspectType || null,
        inspector:    header.inspector || null,
        result:       overallResult,
        remark:       defect.resolved ? '已立即完成改善' : defect.unresolved ? '未完成改善，需追蹤' : null,
      };
      const { data, error } = await supabase.from('construction_inspections').insert([payload]).select().single();
      if (error) throw error;
      alert(`已儲存至施工檢驗管制表（結果：${overallResult}）`);
      onSave?.(data);
      onClose();
    } catch (e) { alert(`儲存失敗：${e.message}`); }
    finally { setSavingDb(false); }
  }

  /* 各 phase 的項目 */
  const phases = template ? ['施工前', '施工中', '施工完成'] : [];

  return (
    <>
    <div className="ifm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ifm-modal">

        {/* 標題列 */}
        <div className="ifm-header">
          <span className="ifm-title">填寫施工抽查紀錄表</span>
          <div className="ifm-header-actions">
            <button className="ifm-btn" onClick={() => pdfFileRef.current?.click()} disabled={ocrLoading}>
              {ocrLoading ? <Loader2 size={13} className="animate-spin" /> : <ScanText size={13} />}
              PDF辨識匯入
            </button>
            <input ref={pdfFileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handlePdfFile} />
            <button className="ifm-btn ifm-btn-primary" onClick={handleSaveDb} disabled={savingDb}>
              {savingDb ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              儲存至管制表
            </button>
            <button className="ifm-btn" onClick={handlePrint}><Printer size={13} />列印 / PDF</button>
            <button className="ifm-btn" onClick={handleUploadDrive} disabled={saving}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Cloud size={13} />}
              上傳 Drive
            </button>
            {driveLink && (
              <a className="ifm-btn" href={driveLink} target="_blank" rel="noreferrer">
                <CheckSquare size={13} />開啟 Drive
              </a>
            )}
            <button className="ifm-btn-close" onClick={onClose}><X size={15} /></button>
          </div>
        </div>

        <div className="ifm-body">

          {/* 選擇工項 */}
          <div className="ifm-section">
            <div className="ifm-row">
              <label className="ifm-label">工項表單</label>
              <select className="ifm-select" value={templateCode} onChange={e => setTemplateCode(e.target.value)}>
                <option value="">— 請選擇工項 —</option>
                {TEMPLATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {guessedCode && guessedCode !== templateCode && (
                <span className="ifm-hint">依工項「{inspection?.work_item}」建議：{guessedCode}</span>
              )}
            </div>
          </div>

          {/* 基本資料 */}
          <div className="ifm-section">
            <div className="ifm-section-title">基本資料</div>
            <div className="ifm-grid-4">
              <div>
                <label className="ifm-label">工程名稱</label>
                <input className="ifm-input" value={project?.name || ''} readOnly />
              </div>
              <div>
                <label className="ifm-label">承包廠商</label>
                <input className="ifm-input" value={project?.contractor || ''} readOnly />
              </div>
              <div>
                <label className="ifm-label">檢查位置</label>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input className="ifm-input" style={{ flex: 1 }} value={header.location}
                    onChange={e => setHeader(h => ({ ...h, location: e.target.value }))} />
                  <button type="button" className="ifm-btn" onClick={loadPhotoBatches}
                    disabled={!header.date || photoLoading}
                    style={{ whiteSpace: 'nowrap', padding: '4px 8px', fontSize: '12px' }}
                    title="從當日照片紀錄帶入位置">
                    {photoLoading ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
                    導入照片
                  </button>
                </div>
              </div>
              <div>
                <label className="ifm-label">檢查日期</label>
                <input className="ifm-input" type="date" value={header.date}
                  onChange={e => setHeader(h => ({ ...h, date: e.target.value }))} />
              </div>
              <div>
                <label className="ifm-label">監造人員</label>
                <input className="ifm-input" value={header.inspector}
                  placeholder="姓名"
                  onChange={e => setHeader(h => ({ ...h, inspector: e.target.value }))} />
              </div>
            </div>
            <div className="ifm-grid-2" style={{ marginTop: 8 }}>
              <div>
                <label className="ifm-label">檢查時機</label>
                <div className="ifm-radio-group">
                  {INSPECT_TYPE_OPTIONS.map(o => (
                    <label key={o} className="ifm-radio">
                      <input type="radio" name="inspectType" value={o}
                        checked={header.inspectType === o}
                        onChange={() => setHeader(h => ({ ...h, inspectType: o }))} />
                      {o}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="ifm-label">施工流程</label>
                <div className="ifm-radio-group">
                  {FLOW_OPTIONS.map(o => (
                    <label key={o} className="ifm-radio">
                      <input type="radio" name="flow" value={o}
                        checked={header.flow === o}
                        onChange={() => setHeader(h => ({ ...h, flow: o }))} />
                      {o}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 抽查項目表 */}
          {template && (
            <div className="ifm-section">
              <div className="ifm-section-title" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span>抽查項目</span>
                <button className="ifm-btn" style={{ fontSize:'var(--fs-xs)', padding:'2px 8px' }} onClick={clearAllActual}>
                  <Trash2 size={12} />清空實際欄
                </button>
              </div>
              <div className="ifm-table-wrap">
                <table className="ifm-table">
                  <thead>
                    <tr>
                      <th style={{ width: 48 }}>施工階段</th>
                      <th style={{ width: 130 }}>管理項目</th>
                      <th>依設計圖說、規範之抽查標準</th>
                      <th style={{ width: 160 }}>實際抽查情形（含檢查數據）</th>
                      <th style={{ width: 80 }}>抽查結果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {phases.map(phase => {
                      const phaseItems = template.items.filter(it => it.phase === phase);
                      if (!phaseItems.length) return null;
                      return phaseItems.map((it, idx) => (
                        <tr key={it.name}>
                          {idx === 0 && (
                            <td className="ifm-phase-cell" rowSpan={phaseItems.length}>
                              {phase}
                            </td>
                          )}
                          <td className="ifm-item-name">
                            {it.key && <span className="ifm-key-star">★</span>}{it.name}
                          </td>
                          <td className="ifm-std">{it.standard}</td>
                          <td>
                            <textarea className="ifm-textarea"
                              value={items[it.name]?.actual || ''}
                              onChange={e => setActual(it.name, e.target.value)}
                              rows={2} />
                          </td>
                          <td className="ifm-result-cell">
                            {['pass', 'fail', 'na'].map(sym => (
                              <button key={sym}
                                className={`ifm-sym-btn${(items[it.name]?.result || '') === sym ? ' active' : ''}`}
                                onClick={() => setResult(it.name, items[it.name]?.result === sym ? '' : sym)}>
                                {RESULT_SYMBOL[sym]}
                              </button>
                            ))}
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 缺失複查 */}
          <div className="ifm-section">
            <div className="ifm-section-title">缺失複查結果</div>
            <div className="ifm-defect-row">
              <label className="ifm-check">
                <input type="checkbox" checked={defect.resolved}
                  onChange={e => setDefect(d => ({ ...d, resolved: e.target.checked }))} />
                已立即完成改善（檢附改善前中後照片）
              </label>
              <label className="ifm-check">
                <input type="checkbox" checked={defect.unresolved}
                  onChange={e => setDefect(d => ({ ...d, unresolved: e.target.checked }))} />
                未完成改善，填具「不符合事項追蹤改善表」
              </label>
            </div>
            <div className="ifm-grid-3" style={{ marginTop: 8 }}>
              <div>
                <label className="ifm-label">複查日期</label>
                <input className="ifm-input" type="date" value={defect.date}
                  onChange={e => setDefect(d => ({ ...d, date: e.target.value }))} />
              </div>
              <div>
                <label className="ifm-label">複查人員職稱</label>
                <input className="ifm-input" value={defect.reviewer}
                  onChange={e => setDefect(d => ({ ...d, reviewer: e.target.value }))} />
              </div>
              <div>
                <label className="ifm-label">簽名（文字）</label>
                <input className="ifm-input" value={defect.reviewSign}
                  onChange={e => setDefect(d => ({ ...d, reviewSign: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* 簽署影像 */}
          <div className="ifm-section">
            <div className="ifm-section-title">簽署影像</div>
            <div className="ifm-grid-2">
              {[
                { label: '監造人員', img: signImg, setImg: setSignImg, ref: signRef },
                { label: '監造主管', img: supervisorImg, setImg: setSupervisorImg, ref: supervisorRef },
              ].map(({ label, img, setImg, ref: r }) => (
                <div key={label} className="ifm-sign-block">
                  <label className="ifm-label">{label}</label>
                  {img
                    ? <div className="ifm-sign-preview">
                        <img src={img} alt={label} />
                        <button className="ifm-btn" style={{ marginTop: 4 }} onClick={() => setImg(null)}>
                          <X size={12} />移除
                        </button>
                      </div>
                    : <button className="ifm-btn" onClick={() => r.current?.click()}>
                        <Upload size={12} />上傳簽署影像
                      </button>
                  }
                  <input ref={r} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => readImgFile(e.target.files[0], setImg)} />
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>

    {/* 照片批次選取 overlay */}
    {photoPickerOpen && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={() => setPhotoPickerOpen(false)}>
        <div style={{ background: 'var(--color-bg)', borderRadius: 10, padding: 20, minWidth: 320, maxWidth: 500, boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: 12, color: 'var(--color-text-main)' }}>
            選擇 {header.date} 的照片批次
          </div>
          {photoBatches.length === 0
            ? <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', padding: '8px 0' }}>當日無照片紀錄</div>
            : photoBatches.map(b => (
              <button key={b.id} onClick={() => importFromBatch(b)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', marginBottom: 6, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-main)' }}>
                {b.title || b.doc_no || '（無標題）'}
              </button>
            ))
          }
          <button onClick={() => setPhotoPickerOpen(false)}
            style={{ marginTop: 8, padding: '4px 12px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            取消
          </button>
        </div>
      </div>
    )}

    {/* PDF 掃描檔頁面選取 overlay */}
    {pdfPickerOpen && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={() => setPdfPickerOpen(false)}>
        <div style={{ background: 'var(--color-bg)', borderRadius: 10, padding: 20, maxWidth: 640, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: 12, color: 'var(--color-text-main)' }}>
            請選擇「施工抽查紀錄表」所在頁面
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {pdfPages.map(p => (
              <button key={p.pageNum} onClick={() => handlePickPdfPage(p.dataUrl)}
                style={{ padding: 0, border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden', cursor: 'pointer', background: 'var(--color-surface)' }}>
                <img src={p.dataUrl} alt={`第 ${p.pageNum} 頁`} style={{ width: '100%', display: 'block' }} />
                <div style={{ fontSize: '12px', padding: '4px 0', color: 'var(--color-text-muted)' }}>第 {p.pageNum} 頁</div>
              </button>
            ))}
          </div>
          <button onClick={() => setPdfPickerOpen(false)}
            style={{ marginTop: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            取消
          </button>
        </div>
      </div>
    )}
    </>
  );
}
