/* ============================================================
   parseSubmissionMasterPdf.js — 監造計畫「表 5.3-1 材料設備送審管制總表」PDF 辨識
   以 pdfjs 文字層座標解析表格，回傳可預填 PlanItemModal 的資料列
   回傳 { rows, scanned }：scanned=true 表示掃描版（無文字層）
   ============================================================ */
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

/* pdfjs 於辨識時才動態載入，避免送審頁初始載入即拉進整包函式庫 */
async function loadPdfjs() {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  return pdfjsLib;
}

/* ── 欄位標題 → 資料鍵值（依序比對，先精確後模糊） ── */
const HEADER_DEFS = [
  { key: 'ci',      rx: /契約項次/ },
  { key: 'no',      rx: /^項次$/ },
  { key: 'name',    rx: /名稱/ },
  { key: 'qty',     rx: /數量/ },
  { key: 'test',    rx: /取樣/ },
  { key: 'p_date',  rx: /預定送審/ },
  { key: 'factory', rx: /驗廠/ },
  { key: 'vendor',  rx: /廠商/ },
  { key: 'cat',     rx: /型錄/ },
  { key: 'rpt',     rx: /報告/ },
  { key: 'smp',     rx: /樣品/ },
  { key: 'other',   rx: /其他/ },
  { key: 'remark',  rx: /備註/ },
];

/* 頁首/頁尾/表名等非資料列 */
const SKIP_ROW_PATTERNS = [
  /材料設備送審管制總表/,
  /監造計畫/,
  /^表\s*5/,
  /^註[：:]/,
  /^第?\s*\d+\s*頁/,
  /^頁\s*次/,
  /送審資料/, // 群組標題列（廠商資料/型錄/試驗報告/樣品 的上層）
];

/* 遇到下一張表（表 5.3-4 檢試驗）即停止 */
const STOP_PATTERNS = [/檢試驗管制總表/];

/* ── 勾記正規化 ── */
function normMark(s) {
  const t = (s || '').replace(/\s+/g, '');
  if (/^[VvＶｖ✓✔]$/.test(t)) return 'V';
  if (/^[XxＸｘ✗✕×]$/.test(t)) return 'X';
  if (t === '—' || t === '-' || t === '–') return '';
  return t;
}

/* ── 日期解析（民國 / 西元 → ISO），非日期字串回傳 null ── */
function toISODate(raw) {
  if (!raw) return null;
  const s = String(raw).replace(/\s+/g, '')
    .replace(/[年/.]/g, '-').replace(/月/g, '-').replace(/日/g, '');
  const m = s.match(/^(\d{2,4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  let y = parseInt(m[1], 10);
  if (y < 1911) y += 1911;
  return `${y}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

/* ── 擷取單頁文字 item（NFKC 正規化 + 座標） ── */
async function extractPageItems(page) {
  const content = await page.getTextContent();
  return content.items
    .map(item => ({
      str: item.str.normalize('NFKC').trim(),
      x: Math.round(item.transform[4]),
      y: Math.round(item.transform[5]),
      w: Math.round(item.width || 0),
    }))
    .filter(i => i.str !== '');
}

/* ── 依 y 分列（容差 3），列內依 x 排序，並合併相鄰字元 item ── */
function groupRows(rawItems) {
  const lines = new Map();
  for (const item of rawItems) {
    let key = item.y;
    for (const y of lines.keys()) {
      if (Math.abs(y - item.y) <= 3) { key = y; break; }
    }
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push(item);
  }
  const rows = [];
  for (const [y, lineItems] of lines.entries()) {
    lineItems.sort((a, b) => a.x - b.x);
    // 合併相鄰 item（處理每個漢字拆成獨立 item 的 PDF）
    const merged = [];
    let cur = { ...lineItems[0] };
    for (let i = 1; i < lineItems.length; i++) {
      const next = lineItems[i];
      const curEnd = cur.x + (cur.w || cur.str.length * 10);
      if (next.x - curEnd <= 12) {
        cur = { str: cur.str + next.str, x: cur.x, y, w: (next.x + (next.w || 0)) - cur.x };
      } else {
        merged.push(cur);
        cur = { ...next };
      }
    }
    merged.push(cur);
    rows.push({ y, items: merged, text: merged.map(i => i.str).join(' ') });
  }
  rows.sort((a, b) => b.y - a.y); // PDF 座標原點在左下 → 由上往下閱讀
  return rows;
}

/* ── 從標題列（可能跨 2 列：送審資料群組 + 子標題）建立欄位 x 中心對照 ── */
function detectColumns(rows, startIdx) {
  const cols = {};
  // 標題可能分佈於連續 2~3 列（群組標題 + 子欄標題）
  for (let r = startIdx; r < Math.min(startIdx + 3, rows.length); r++) {
    for (const item of rows[r].items) {
      const label = item.str.replace(/\s+/g, '');
      for (const def of HEADER_DEFS) {
        if (cols[def.key] !== undefined) continue;
        if (def.rx.test(label)) {
          cols[def.key] = item.x + (item.w || 0) / 2;
          break;
        }
      }
    }
  }
  return cols;
}

/* ── 將一列的 items 依欄位 x 邊界指派 ── */
function assignRow(row, colDefs) {
  // colDefs: [{key, cx}] 依 cx 排序；邊界取相鄰中點
  const rec = {};
  for (const item of row.items) {
    const cx = item.x + (item.w || 0) / 2;
    let best = null, bestDist = Infinity;
    for (const c of colDefs) {
      const d = Math.abs(cx - c.cx);
      if (d < bestDist) { bestDist = d; best = c.key; }
    }
    if (!best) continue;
    rec[best] = rec[best] ? `${rec[best]}${item.str}` : item.str;
  }
  return rec;
}

/* ── 主函式 ── */
export async function parseSubmissionMasterPdf(file) {
  const pdfjsLib = await loadPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    cMapUrl: '/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/standard_fonts/',
  }).promise;

  let totalItems = 0;
  let colDefs = null;      // [{key, cx}]
  let headerFound = false;
  let stopped = false;
  const records = [];

  for (let p = 1; p <= pdf.numPages && !stopped; p++) {
    const page = await pdf.getPage(p);
    const rawItems = await extractPageItems(page);
    totalItems += rawItems.length;
    const rows = groupRows(rawItems);

    // 每頁重新偵測標題列（續頁通常重印表頭；若無則沿用前頁欄位）
    let dataStart = 0;
    const headerIdx = rows.findIndex(r =>
      /契約項次/.test(r.text.replace(/\s+/g, '')) && /名稱/.test(r.text.replace(/\s+/g, ''))
    );
    if (headerIdx !== -1) {
      const cols = detectColumns(rows, headerIdx);
      if (cols.name !== undefined) {
        colDefs = Object.entries(cols)
          .map(([key, cx]) => ({ key, cx }))
          .sort((a, b) => a.cx - b.cx);
        headerFound = true;
        // 跳過標題所佔的列（含子標題列：其內容全為標題關鍵字）
        dataStart = headerIdx + 1;
        while (dataStart < rows.length) {
          const t = rows[dataStart].text.replace(/\s+/g, '');
          const isSubHeader = rows[dataStart].items.every(i =>
            HEADER_DEFS.some(d => d.rx.test(i.str.replace(/\s+/g, ''))) || /送審資料/.test(i.str)
          );
          if (isSubHeader && t) dataStart++;
          else break;
        }
      }
    }
    if (!colDefs) continue; // 此頁尚未出現表格

    for (let r = dataStart; r < rows.length; r++) {
      const row = rows[r];
      const flat = row.text.replace(/\s+/g, '');
      if (STOP_PATTERNS.some(rx => rx.test(flat))) { stopped = true; break; }
      if (SKIP_ROW_PATTERNS.some(rx => rx.test(flat))) continue;

      const rec = assignRow(row, colDefs);
      const name = (rec.name || '').trim();
      const ci = (rec.ci || '').trim();

      // 續行：只有名稱/其他欄有內容 → 併入上一筆
      const hasKeyField = ci || rec.no || rec.qty || rec.test || rec.factory;
      if (!hasKeyField && records.length && (name || rec.other)) {
        const prev = records[records.length - 1];
        if (name) prev.name = `${prev.name}${name}`;
        if (rec.other) prev.other = `${prev.other || ''}${rec.other}`;
        continue;
      }
      if (!name && !ci) continue;

      const record = {};
      if (rec.no) record.no = rec.no.trim();
      if (ci) record.ci = ci;
      if (name) record.name = name;
      if (rec.qty) record.qty = rec.qty.trim();
      const test = normMark(rec.test);
      if (test) record.test = test;
      const factory = normMark(rec.factory);
      if (factory === 'V' || factory === '是') record.factory = '是';
      else if (factory === 'X' || factory === '否') record.factory = '否';
      ['vendor', 'cat', 'rpt', 'smp'].forEach(k => {
        const v = normMark(rec[k]);
        if (v === 'V') record[k] = 'V';
      });
      if (rec.other) record.other = rec.other.trim();
      if (rec.remark) record.remark = rec.remark.trim();
      if (rec.p_date) {
        const iso = toISODate(rec.p_date);
        if (iso) record.p_date = iso;
        // 非日期文字（如「開工後30日內」）保留到其他欄，避免內容遺失
        else record.other = `${record.other ? record.other + '；' : ''}預定送審：${rec.p_date.trim()}`;
      }
      records.push(record);
    }
  }

  return {
    rows: records,
    scanned: totalItems < 20,        // 幾乎無文字層 → 掃描版 PDF
    headerFound,
  };
}
