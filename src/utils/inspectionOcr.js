/* ============================================================
   inspectionOcr.js — 施工抽查紀錄表掃描檔辨識管線
   PDF 轉圖 → Google Vision OCR → 座標式表格解析
   （由 InspectionFormModal 抽出，供標準抽查單與新增檢驗記錄共用）
   ============================================================ */
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const GAPI_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';

/* ── 民國年字串 → 西元 ISO 日期 ── */
function parseRocDateStr(str) {
  const m = String(str || '').match(/(\d{2,3})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const year = y < 1000 ? y + 1911 : y;
  return `${year}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
}

/* ── 將 PDF 各頁轉為圖片（供 Vision OCR 使用） ── */
export async function renderPdfPagesToImages(file) {
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

/* ── 呼叫 Google Vision DOCUMENT_TEXT_DETECTION，回傳含座標的完整結果 ── */
export async function recognizeInspectionImage(imageDataUrl) {
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

/* ── 將 Vision 回傳的段落攤平為含座標的清單，依 y 再 x 排序 ──
   表格為「管理項目/抽查標準」印刷體＋「實際抽查情形/抽查結果」手寫的固定版面，
   若只用攤平文字比對，遇到印刷體換行、或標準說明文字剛好包含其他項目名稱時容易對錯欄位，
   因此改用段落座標分辨欄位（管理項目 vs 抽查標準 vs 實際抽查情形 vs 抽查結果），避免誤植。 */
export function collectOcrParagraphs(visionResponse) {
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

/* ── 解析表頭欄位（工程名稱等已由系統帶入，僅解析手寫欄位） ──
   檢查位置值可能多行，垂直範圍以上一列標籤（分項工程名稱）底部與下一列標籤（施工流程）頂部為界，
   避免吸入相鄰列的勾選框文字。 */
export function parseInspectionHeader(paragraphs) {
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

/* ── 手寫結果符號比對 ──
   實測 Vision 會把手寫「○」辨識成「。」「D」「0」等相近字元，故放寬符號集；
   僅比對結果欄內「單獨成段」的字元，不會影響其他欄位文字。 */
const PASS_SYMBOL_RE = /^[○◯〇Oo0。D]$/;
const FAIL_SYMBOL_RE = /^[╳×Xx乂]$/;
const NA_SYMBOL_RE   = /^[／/\\]$/;

/* ── 依「管理項目」欄位座標比對範本項目名稱，
   再依同一列的 y 範圍取「實際抽查情形」「抽查結果」欄位內容 ──
   若紙本表單多出範本沒有的項目（例如客製化追加的檢查列），該列直接被忽略，不會污染到相鄰項目。 */
export function extractItemsFromParagraphs(paragraphs, template) {
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
