// Supabase Edge Function: sync-diary v15
// fflate + 手寫 XML 解析，支援多工作表、多 block 垂直並列、施工日誌/監造報表兩種格式

import { createClient } from "npm:@supabase/supabase-js@2";
import { unzipSync } from "npm:fflate@0.8.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_SA_CLIENT_EMAIL = Deno.env.get("GOOGLE_SA_CLIENT_EMAIL")!;
const GOOGLE_SA_PRIVATE_KEY = Deno.env.get("GOOGLE_SA_PRIVATE_KEY")!.replace(/\\n/g, "\n");
const SYNC_SECRET = Deno.env.get("SYNC_SECRET")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── 民國/西元年日期解析 ─────────────────────────────────────────
function parseDate(raw: unknown): string | null {
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw.toISOString().split("T")[0];
  // Excel serial number（40000~60000 = 2009~2064）
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!isNaN(n) && n > 40000 && n < 60000) {
    return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().split("T")[0];
  }
  let s = String(raw).trim()
    .replace(/[年/．.]/g, "-").replace(/月/g, "-").replace(/日/g, "").trim();
  const roc = s.match(/^(\d{2,3})-(\d{1,2})-(\d{1,2})$/);
  if (roc && parseInt(roc[1]) < 200)
    return `${parseInt(roc[1]) + 1911}-${roc[2].padStart(2, "0")}-${roc[3].padStart(2, "0")}`;
  const ce = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ce) return `${ce[1]}-${ce[2].padStart(2, "0")}-${ce[3].padStart(2, "0")}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}

// ── 從檔名解析日期 ─────────────────────────────────────────────
function parseDateFromFileName(name: string): string | null {
  const m = name.match(/施工日誌[-_](\d{5,7})/);
  if (!m) return null;
  const raw = m[1];
  if (raw.length === 7) {
    return `${parseInt(raw.substring(0, 3)) + 1911}-${raw.substring(3, 5)}-${raw.substring(5, 7)}`;
  }
  return null;
}

// ── Google Service Account JWT ─────────────────────────────────
async function getGoogleAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (s: string) => btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const header  = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64(JSON.stringify({
    iss: GOOGLE_SA_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  }));
  const signing = `${header}.${payload}`;
  const keyData = GOOGLE_SA_PRIVATE_KEY
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/[^A-Za-z0-9+/=]/g, "");
  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryKey, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(signing));
  const sig = b64(String.fromCharCode(...new Uint8Array(sigBuf)));
  const jwt = `${signing}.${sig}`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenJson = await tokenRes.json();
  if (!tokenJson.access_token) throw new Error("無法取得 Google Access Token: " + JSON.stringify(tokenJson));
  return tokenJson.access_token;
}

// ── Drive API ──────────────────────────────────────────────────
async function downloadDriveFile(fileId: string, token: string): Promise<ArrayBuffer> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Drive 下載失敗 (${res.status}): ${await res.text()}`);
  return res.arrayBuffer();
}

async function listDiaryFiles(
  folderId: string, token: string, startDate?: string, endDate?: string
): Promise<{ id: string; name: string }[]> {
  // 使用 ancestors 遞迴搜尋所有子資料夾（而非只搜直接子層 parents）
  const q = encodeURIComponent(`'${folderId}' in ancestors and name contains '施工日誌' and mimeType != 'application/vnd.google-apps.folder' and trashed=false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`列出 Drive 檔案失敗: ${await res.text()}`);
  const json = await res.json();
  let files: { id: string; name: string }[] = json.files || [];
  if (startDate || endDate) {
    files = files.filter((f) => {
      const d = parseDateFromFileName(f.name);
      if (!d) return true;
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });
  }
  return files;
}

async function getDiaryFolderId(projectFolderId: string, token: string): Promise<string> {
  const q = encodeURIComponent(
    `'${projectFolderId}' in parents and name='施工日誌' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (data.files?.length) return data.files[0].id;
  return projectFolderId;
}

// ══════════════════════════════════════════════════════════════
// 輕量 xlsx/xlsm cell 讀取（fflate + regex XML 解析）
// ══════════════════════════════════════════════════════════════
function colLetterToIdx(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

interface RawCell { row: number; col: number; val: string; }

// 日誌關鍵字（用來識別哪些工作表含施工日誌資料）
const DIARY_MARKERS = /填表日期|填報日期|本日完成|本日天氣|施工日誌|監造報表|本日工作項目/;

// ── 讀取所有含日誌關鍵字的工作表 ─────────────────────────────
// 傳回每個 sheet 的 cells 陣列（支援多工作表、大量列）
function readAllDiarySheets(buf: ArrayBuffer, maxRow = 500): RawCell[][] {
  let zipped: Record<string, Uint8Array>;
  try { zipped = unzipSync(new Uint8Array(buf)); } catch { return []; }
  const dec = new TextDecoder("utf-8");

  // 1. Shared strings
  const ss: string[] = [];
  const ssRaw = zipped["xl/sharedStrings.xml"];
  if (ssRaw) {
    const ssXml = dec.decode(ssRaw);
    const siRx = /<si>([\s\S]*?)<\/si>/g;
    let sm: RegExpExecArray | null;
    while ((sm = siRx.exec(ssXml)) !== null) {
      const texts: string[] = [];
      const tRx = /<t[^>]*>([^<]*)<\/t>/g;
      let tm: RegExpExecArray | null;
      while ((tm = tRx.exec(sm[1])) !== null) {
        texts.push(tm[1]
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">").replace(/&#xA;/g, "\n").replace(/&#x9;/g, " "));
      }
      ss.push(texts.join(""));
    }
  }

  // 2. 所有工作表，依編號排序
  const sheetKeys = Object.keys(zipped)
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => {
      const na = parseInt(a.match(/sheet(\d+)/)?.[1] ?? "0");
      const nb = parseInt(b.match(/sheet(\d+)/)?.[1] ?? "0");
      return na - nb;
    });

  const result: RawCell[][] = [];

  for (const sk of sheetKeys) {
    const xml = dec.decode(zipped[sk]);

    // 檢查此 sheet 是否含日誌關鍵字（透過 shared string 引用）
    let hasDiary = false;
    const vRx = /<v>(\d+)<\/v>/g;
    let vm: RegExpExecArray | null;
    while ((vm = vRx.exec(xml)) !== null) {
      const idx = parseInt(vm[1]);
      if (DIARY_MARKERS.test(ss[idx] ?? "")) { hasDiary = true; break; }
    }
    if (!hasDiary) continue;

    // 逐列解析
    const cells: RawCell[] = [];
    const rowRx = /<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
    let rm: RegExpExecArray | null;
    while ((rm = rowRx.exec(xml)) !== null) {
      const rowNum = parseInt(rm[1]);
      if (rowNum > maxRow) break;
      const r = rowNum - 1; // 0-based
      const cellRx = /<c\b\s+r="([A-Z]+)\d+"([^>\/]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
      let cm: RegExpExecArray | null;
      while ((cm = cellRx.exec(rm[2])) !== null) {
        const col = colLetterToIdx(cm[1]);
        const ctype = cm[2].match(/\bt="([^"]*)"/)?.[1] ?? "";
        const body = cm[3] ?? "";
        let val = "";
        if (ctype === "s") {
          const idx = parseInt(body.match(/<v>([^<]*)<\/v>/)?.[1] ?? "");
          val = ss[idx] ?? "";
        } else if (ctype === "inlineStr") {
          val = body.match(/<t[^>]*>([^<]*)<\/t>/)?.[1] ?? "";
        } else if (ctype === "e") {
          val = "";
        } else {
          val = body.match(/<v>([^<]*)<\/v>/)?.[1] ?? "";
        }
        const trimmed = val.trim();
        if (trimmed) cells.push({ row: r, col, val: trimmed });
      }
    }
    if (cells.length > 0) result.push(cells);
  }
  return result;
}

// ── 在一個 sheet 的 cells 中找出各 block 的起始列（0-based）──
// block 起始 = 含「本日天氣」、「填表日期」或「填報日期」的列
function findBlockStartRows(cells: RawCell[]): number[] {
  const BLOCK_HEADER = /本日天氣|填表日期|填報日期/;
  const headerRows = new Set<number>();
  for (const c of cells) {
    if (BLOCK_HEADER.test(c.val)) headerRows.add(c.row);
  }
  const sorted = [...headerRows].sort((a, b) => a - b);
  // 合併相鄰列（同一邏輯 header 可能跨 2-3 列）
  const blockStarts: number[] = [];
  let prev = -100;
  for (const r of sorted) {
    if (r - prev > 5) blockStarts.push(r);
    prev = r;
  }
  return blockStarts;
}

// ── 解析介面 ───────────────────────────────────────────────────
interface ParsedDiary {
  logDate: string | null;
  weatherAm: string | null;
  weatherPm: string | null;
  plannedProgress: number | null;
  actualProgress: number | null;
  workItemsText: string;
  workItems: { itemName: string; unit: string; todayQty: number; cumulativeQty: number }[];
  notes: string;
}

const BOILERPLATE = [
  /^二、監督依照設計圖說/, /^三、查核材料規格/, /^四、督導工地職業安全/,
  /^監造人員簽章/, /^本表原則應按日填寫/, /■|□/,
  /^[壹貳參肆一二三四五六七八九十]$/,
  /^(工程項目|施工項目|工程施工項目|單位|契約數量|今日完成|本日完成|累計完成|發包工程費|備註)/,
  /總表\[|標單\]|\[標單/, /本日無施工數據/,
  /^工程名稱$/, /^承攬廠商/, /^契約工期$/, /^開工日期$/, /^預定完工日期$/, /^累計工期$/,
];
function isBoilerplate(s: string): boolean {
  return BOILERPLATE.some((rx) => rx.test(s.trim()));
}

const EMPTY_MARKS = new Set(["—", "-", "－", "　", "N/A", "n/a"]);

// ── 解析單一 block 的 cells → ParsedDiary ────────────────────
function parseBlockCells(cells: RawCell[]): ParsedDiary {

  // ── 1. 填表日期 ─────────────────────────────────────────────
  let logDate: string | null = null;

  const dateLabel = cells.find((c) => /填表日期|填報日期/.test(c.val));
  if (dateLabel) {
    const near = cells
      .filter((c) => c.row === dateLabel.row && c.col > dateLabel.col)
      .sort((a, b) => a.col - b.col);
    for (const c of near) {
      const d = parseDate(c.val);
      if (d) { logDate = d; break; }
    }
  }
  // Fallback：從含「本日天氣」的列找日期序列值或日期字串
  if (!logDate) {
    const wxRow = cells.find((c) => /本日天氣/.test(c.val));
    if (wxRow) {
      const rowCells = cells.filter((c) => c.row === wxRow.row).sort((a, b) => a.col - b.col);
      for (const c of rowCells) {
        const d = parseDate(c.val);
        if (d) { logDate = d; break; }
      }
    }
  }
  // Fallback：掃描日期格式字串
  if (!logDate) {
    const dateCells = cells.filter((c) =>
      /^\d{2,3}[-/]\d{1,2}[-/]\d{1,2}$/.test(c.val) ||
      /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(c.val)
    );
    if (dateCells.length) logDate = parseDate(dateCells[0].val);
  }
  // Fallback：Excel 序列值（5位數）
  if (!logDate) {
    const serialCell = cells.find((c) => /^\d{5}$/.test(c.val) && parseInt(c.val) > 40000);
    if (serialCell) logDate = parseDate(serialCell.val);
  }

  // ── 2. 天氣 ────────────────────────────────────────────────
  let weatherAm: string | null = null;
  let weatherPm: string | null = null;

  const amCell = cells.find((c) => /上午/.test(c.val));
  const pmCell = cells.find((c) => /下午/.test(c.val));

  function extractWeather(cell: RawCell | undefined): string | null {
    if (!cell) return null;
    // 同格含值（上午：晴）
    const inline = cell.val.match(/[上下]午[：:\s]+(.+)/)?.[1]?.trim();
    if (inline && !EMPTY_MARKS.has(inline) && inline.length < 10) return inline;
    // 標籤格，值在右側
    const right = cells
      .filter((c) => c.row === cell.row && c.col > cell.col)
      .sort((a, b) => a.col - b.col);
    const rv = right[0]?.val ?? null;
    if (rv && !EMPTY_MARKS.has(rv) && !/[：:]/.test(rv) && rv.length < 10) return rv;
    return null;
  }

  weatherAm = extractWeather(amCell);
  weatherPm = extractWeather(pmCell);
  if (weatherPm === weatherAm && weatherPm !== null && pmCell) {
    const right = cells
      .filter((c) => c.row === pmCell.row && c.col > pmCell.col)
      .sort((a, b) => a.col - b.col);
    const alt = right.find((c) => c.val !== weatherAm && !EMPTY_MARKS.has(c.val) && c.val.length < 10);
    if (alt) weatherPm = alt.val;
  }

  // ── 3. 預定/實際進度 ────────────────────────────────────────
  function findProgress(labelRx: RegExp): number | null {
    const lbl = cells.find((c) => labelRx.test(c.val));
    if (!lbl) return null;
    const right = cells
      .filter((c) => Math.abs(c.row - lbl.row) <= 1 && c.col > lbl.col && c.col <= lbl.col + 5)
      .sort((a, b) => a.col - b.col);
    const below = cells
      .filter((c) => c.col === lbl.col && c.row > lbl.row && c.row <= lbl.row + 3)
      .sort((a, b) => a.row - b.row);
    for (const c of [...right, ...below]) {
      const v = parseFloat(c.val.replace(/[%％]/g, ""));
      if (!isNaN(v) && v > 0) return v;
    }
    return null;
  }

  const plannedProgress = findProgress(/預定進度|^預定$/);
  const actualProgress  = findProgress(/實際進度|^實際$/);

  // ── 4. 工項數量表 ───────────────────────────────────────────
  // 支援「今日完成」「本日完成」「施工項目」「工程項目」等多種欄位名
  const todayHeader = cells.find((c) => /今日完成|本日完成數量/.test(c.val));
  const cumHeader   = cells.find((c) => /累計完成/.test(c.val));
  const unitHeader  = cells.find((c) => /^單位$/.test(c.val));
  const nameHeader  = cells.find((c) => /工程項目|工作項目|施工項目|工程施工項目/.test(c.val));

  const todayCol  = todayHeader?.col;
  const cumCol    = cumHeader?.col;
  const unitCol   = unitHeader?.col;
  const headerRow = todayHeader?.row ?? -1;
  let   nameCol   = nameHeader?.col;

  // 修正 nameCol：若資料列的值多為項次編號（短字串），改用 nameCol+1
  if (nameCol !== undefined && todayCol !== undefined && headerRow >= 0) {
    const sampleRows = cells.filter((c) => c.row > headerRow && c.row <= headerRow + 5 && c.col === nameCol);
    const shortCount = sampleRows.filter((c) =>
      c.val.length <= 3 || /^\d+$|^[一二三四五六七八九十]$/.test(c.val)
    ).length;
    if (shortCount > sampleRows.length / 2 && sampleRows.length > 0) nameCol = nameCol + 1;
  }

  const workItems: ParsedDiary["workItems"] = [];
  const workItemLines: string[] = [];

  if (todayCol !== undefined && nameCol !== undefined && headerRow >= 0) {
    const dataRows = [...new Set(
      cells.filter((c) => c.row > headerRow && c.col === todayCol).map((c) => c.row)
    )];
    for (const row of dataRows) {
      const todayCell = cells.find((c) => c.row === row && c.col === todayCol);
      const qty = parseFloat(todayCell?.val ?? "");
      if (isNaN(qty) || qty <= 0) continue;
      const nameCell = cells.find((c) => c.row === row && c.col === nameCol);
      const itemName = nameCell?.val?.trim() ?? "";
      if (!itemName || isBoilerplate(itemName) || itemName.length <= 2) continue;
      const unit = (unitCol !== undefined
        ? cells.find((c) => c.row === row && c.col === unitCol)?.val
        : undefined) ?? "";
      const cumQty = parseFloat(
        (cumCol !== undefined
          ? cells.find((c) => c.row === row && c.col === cumCol)?.val
          : undefined) ?? "0"
      ) || 0;
      workItems.push({ itemName, unit, todayQty: qty, cumulativeQty: cumQty });
      workItemLines.push(`${itemName}：${qty} ${unit}`.trim());
    }
  }

  // ── 5. 本日工作項目備註 ─────────────────────────────────────
  // 優先抓「本日工作項目」或「本日施作」標籤後的文字
  let notes = "";
  const workNoteLabel = cells.find((c) => /本日工作項目|本日施作/.test(c.val));
  if (workNoteLabel) {
    // 同列右側或下一列
    const inline = workNoteLabel.val.match(/本日[工作項目|施作]+[：:\s]*(.+)/s)?.[1]?.trim();
    if (inline && inline.length > 4) {
      notes = inline.replace(/\r\n/g, "\n").trim();
    } else {
      const nextRow = cells
        .filter((c) => c.row === workNoteLabel.row + 1 && c.col === workNoteLabel.col)
        .sort((a, b) => a.col - b.col);
      if (nextRow.length > 0) {
        notes = nextRow[0].val.replace(/\r\n/g, "\n").trim();
      }
    }
  }
  // Fallback：掃描長文字不像固定格式的儲存格
  if (!notes) {
    const minRow = cells.length > 0 ? Math.min(...cells.map(c => c.row)) : 0;
    notes = cells
      .filter((c) =>
        c.val.length > 6 &&
        !isBoilerplate(c.val) &&
        !/^\d+(\.\d+)?([eE][+-]?\d+)?$/.test(c.val) &&
        !/填表日期|填報日期|工程名稱|承攬廠商|契約工期|開工日期|契約金額/.test(c.val) &&
        !workItemLines.some((l) => l.includes(c.val)) &&
        c.row > minRow + 5  // 跳過表頭區域
      )
      .map((c) => c.val.trim())
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 6)
      .join("\n");
  }

  return {
    logDate, weatherAm, weatherPm, plannedProgress, actualProgress,
    workItemsText: workItemLines.join("\n"), workItems, notes,
  };
}

// ── 從一個 Excel 檔解析所有日誌（多 sheet + 多 block）────────
function parseAllDiaries(buf: ArrayBuffer): ParsedDiary[] {
  const sheets = readAllDiarySheets(buf, 500);
  const allDiaries: ParsedDiary[] = [];

  for (const cells of sheets) {
    const blockStarts = findBlockStartRows(cells);
    if (blockStarts.length === 0) continue;

    for (let i = 0; i < blockStarts.length; i++) {
      const startRow = blockStarts[i];
      const endRow   = i + 1 < blockStarts.length ? blockStarts[i + 1] - 1 : Infinity;
      const blockCells = cells.filter((c) => c.row >= startRow && c.row <= endRow);
      const diary = parseBlockCells(blockCells);
      if (diary.logDate) allDiaries.push(diary);
    }
  }

  // 同日期去重：保留工項最多（資料最豐富）的那筆
  const dateMap = new Map<string, ParsedDiary>();
  for (const d of allDiaries) {
    if (!d.logDate) continue;
    const existing = dateMap.get(d.logDate);
    if (
      !existing ||
      d.workItems.length > existing.workItems.length ||
      (d.workItems.length === existing.workItems.length &&
       d.workItemsText.length > existing.workItemsText.length)
    ) {
      dateMap.set(d.logDate, d);
    }
  }

  return [...dateMap.values()].sort((a, b) =>
    (a.logDate ?? "").localeCompare(b.logDate ?? "")
  );
}

// ── 同步單一檔案（可能含多日資料）────────────────────────────
async function syncFile(
  fileId: string, fileName: string, projectId: string, token: string
): Promise<{ date: string | null; dates: string[]; itemCount: number }> {
  const buf = await downloadDriveFile(fileId, token);
  let diaries = parseAllDiaries(buf);

  // Fallback：無法解析任何日誌時，從檔名取得日期
  if (diaries.length === 0) {
    const fallbackDate = parseDateFromFileName(fileName);
    if (!fallbackDate) throw new Error(`無法解析日期：${fileName}`);
    diaries = [{
      logDate: fallbackDate, weatherAm: null, weatherPm: null,
      plannedProgress: null, actualProgress: null,
      workItemsText: "", workItems: [], notes: "",
    }];
  }

  const now = new Date().toISOString();
  let totalItems = 0;
  const dates: string[] = [];

  for (const parsed of diaries) {
    const logDate = parsed.logDate!;
    dates.push(logDate);
    totalItems += parsed.workItems.length;

    const { error: e1 } = await supabase.from("daily_logs").upsert({
      project_id: projectId, log_date: logDate,
      weather_am: parsed.weatherAm, weather_pm: parsed.weatherPm,
      planned_progress: parsed.plannedProgress, actual_progress: parsed.actualProgress,
      work_items: parsed.workItemsText || null, notes: parsed.notes || null,
      sync_source: "google_drive", synced_at: now,
    }, { onConflict: "project_id,log_date" });
    if (e1) throw new Error(`daily_logs 寫入失敗 (${logDate}): ` + e1.message);

    if (parsed.plannedProgress !== null || parsed.actualProgress !== null) {
      const { error: e2 } = await supabase.from("progress_records").upsert({
        project_id: projectId, report_date: logDate,
        planned_progress: parsed.plannedProgress ?? 0,
        actual_progress: parsed.actualProgress ?? 0,
        notes: parsed.workItemsText ? parsed.workItemsText.split("\n")[0] : null,
      }, { onConflict: "project_id,report_date" });
      if (e2) console.warn("progress_records:", e2.message);
    }

    if (parsed.workItems.length > 0) {
      const { error: e3 } = await supabase.from("daily_report_items").upsert(
        parsed.workItems.map((wi) => ({
          project_id: projectId, log_date: logDate,
          item_name: wi.itemName, unit: wi.unit || null,
          today_qty: wi.todayQty, cumulative_qty: wi.cumulativeQty || null,
        })),
        { onConflict: "project_id,log_date,item_name" }
      );
      if (e3) console.warn("daily_report_items:", e3.message);
    }
  }

  return { date: dates[0] ?? null, dates, itemCount: totalItems };
}

// ── CORS ───────────────────────────────────────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// ── Main Handler ───────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  try {
    const body = await req.json();
    const { secret, mode } = body;
    if (secret !== SYNC_SECRET) return json({ error: "Unauthorized" }, 401);
    const token = await getGoogleAccessToken();

    if (mode === "batch" || mode === "dry_run") {
      const { projectId, startDate, endDate } = body;
      if (!projectId) return json({ error: "缺少 projectId" }, 400);
      const { data: proj, error: projErr } = await supabase
        .from("projects").select("drive_folder_id, start_date").eq("id", projectId).single();
      if (projErr || !proj?.drive_folder_id)
        return json({ error: "找不到工程或未設定 Drive 資料夾" }, 400);
      const diaryFolderId = await getDiaryFolderId(proj.drive_folder_id, token);
      if (mode === "dry_run") {
        const allFiles = await listDiaryFiles(diaryFolderId, token);
        return json({
          mode: "dry_run", drive_folder_id: proj.drive_folder_id,
          diary_folder_id: diaryFolderId, total: allFiles.length,
          files: allFiles.map((f) => ({ name: f.name, id: f.id, parsedDate: parseDateFromFileName(f.name) })),
        });
      }
      const files = await listDiaryFiles(diaryFolderId, token, startDate ?? proj.start_date ?? undefined, endDate);
      const results = [];
      for (const f of files) {
        try {
          const r = await syncFile(f.id, f.name, projectId, token);
          results.push({ file: f.name, date: r.date, dates: r.dates, itemCount: r.itemCount, success: true });
        } catch (err) {
          results.push({ file: f.name, success: false, error: String(err) });
        }
      }
      return json({ mode: "batch", total: files.length, results });
    }

    const { fileId, fileName, projectFolderId } = body;
    if (!fileId || !projectFolderId) return json({ error: "缺少 fileId 或 projectFolderId" }, 400);
    const { data: proj, error: projErr } = await supabase
      .from("projects").select("id").eq("drive_folder_id", projectFolderId).single();
    if (projErr || !proj) return json({ error: "找不到對應工程，請確認 drive_folder_id 設定正確" }, 400);
    const result = await syncFile(fileId, fileName, proj.id, token);
    return json({ success: true, projectId: proj.id, ...result });
  } catch (err) {
    console.error("sync-diary error:", err);
    return json({ error: String(err) }, 500);
  }
});
