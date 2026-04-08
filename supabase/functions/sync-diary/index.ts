// Supabase Edge Function: sync-diary
// 接收 Google Apps Script 的 webhook，下載並解析施工日誌 Excel，
// 同步寫入 daily_logs、progress_records、daily_report_items。

import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

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
  let s = String(raw).trim()
    .replace(/[年/．.]/g, "-").replace(/月/g, "-").replace(/日/g, "").trim();
  const roc = s.match(/^(\d{2,3})-(\d{1,2})-(\d{1,2})$/);
  if (roc && parseInt(roc[1]) < 200) {
    return `${parseInt(roc[1]) + 1911}-${roc[2].padStart(2, "0")}-${roc[3].padStart(2, "0")}`;
  }
  const ce = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ce) return `${ce[1]}-${ce[2].padStart(2, "0")}-${ce[3].padStart(2, "0")}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}

// ── 從檔名解析日期（施工日誌-1150408.xlsx → 2026-04-08）───────
function parseDateFromFileName(name: string): string | null {
  const m = name.match(/施工日誌-(\d{5,7})/);
  if (!m) return null;
  const raw = m[1]; // e.g. "1150408" (yyy mm dd)
  if (raw.length === 7) {
    const y = parseInt(raw.substring(0, 3)) + 1911;
    const mo = raw.substring(3, 5);
    const d = raw.substring(5, 7);
    return `${y}-${mo}-${d}`;
  }
  if (raw.length === 5) {
    // yyy mm dd with 1-digit month: 11548 → 115 4 8
    return null; // 無法安全解析，依賴 Excel 內填表日期
  }
  return null;
}

// ── Google Service Account JWT + OAuth2 token ──────────────────
async function getGoogleAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payload = btoa(JSON.stringify({
    iss: GOOGLE_SA_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const signing = `${header}.${payload}`;
  const keyData = GOOGLE_SA_PRIVATE_KEY
    .replace("-----BEGIN RSA PRIVATE KEY-----", "")
    .replace("-----END RSA PRIVATE KEY-----", "")
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );
  const sigBuf = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", cryptoKey,
    new TextEncoder().encode(signing)
  );
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
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

// ── 下載 Drive 檔案 ────────────────────────────────────────────
async function downloadDriveFile(fileId: string, token: string): Promise<ArrayBuffer> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Drive 下載失敗 (${res.status}): ${await res.text()}`);
  return res.arrayBuffer();
}

// ── 列出 Drive 資料夾內的施工日誌檔案 ─────────────────────────
async function listDiaryFiles(
  folderId: string, token: string, startDate?: string, endDate?: string
): Promise<{ id: string; name: string }[]> {
  const q = encodeURIComponent(
    `'${folderId}' in parents and name contains '施工日誌-' and mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' and trashed=false`
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=200`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`列出 Drive 檔案失敗: ${await res.text()}`);
  const json = await res.json();
  let files: { id: string; name: string }[] = json.files || [];
  // 依日期過濾
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

// ── 解析監造報表格式 Excel ─────────────────────────────────────
// 與 PDF 格式相同：找標籤位置擷取資料
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
  /^二、監督依照設計圖說/,
  /^三、查核材料規格/,
  /^四、督導工地職業安全/,
  /^監造人員簽章/,
  /^本表原則應按日填寫/,
  /■|□/,
  /^[壹貳參肆一二三四五六七八九十]$/,
  /^(工程項目|單位|契約數量|今日完成|累計完成|發包工程費)/,
];

function isBoilerplate(s: string): boolean {
  return BOILERPLATE.some((rx) => rx.test(s.trim()));
}

function parseMonitoringExcel(buf: ArrayBuffer): ParsedDiary {
  const wb = XLSX.read(new Uint8Array(buf), { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];

  // 轉為原始矩陣（保留儲存格位置資訊）
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:Z100");

  // 建立 {row, col, value} 陣列，類比 PDF 的 {x, y, str}
  const cells: { row: number; col: number; val: string }[] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;
      const raw = cell.v;
      if (raw === undefined || raw === null || raw === "") continue;
      const str = raw instanceof Date
        ? raw.toISOString().split("T")[0]
        : String(raw).trim();
      if (str) cells.push({ row: r, col: c, val: str });
    }
  }

  // ── 1. 填表日期 ─────────────────────────────────────────────
  let logDate: string | null = null;
  const dateLabel = cells.find((c) => c.val === "填表日期");
  if (dateLabel) {
    // 同列，右側最近的日期值
    const near = cells.filter((c) =>
      c.row === dateLabel.row && c.col > dateLabel.col &&
      /\d{2,4}[-/年]\d{1,2}[-/月]\d{1,2}/.test(c.val)
    ).sort((a, b) => a.col - b.col);
    if (near.length) logDate = parseDate(near[0].val);
  }
  // Fallback：掃描所有日期格式值
  if (!logDate) {
    const dateCells = cells.filter((c) =>
      /^\d{2,3}[-/]\d{1,2}[-/]\d{1,2}$/.test(c.val) ||
      /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(c.val)
    );
    if (dateCells.length) logDate = parseDate(dateCells[0].val);
  }

  // ── 2. 天氣 ────────────────────────────────────────────────
  let weatherAm: string | null = null;
  let weatherPm: string | null = null;
  const amLabel = cells.find((c) => c.val === "上午");
  const pmLabel = cells.find((c) => c.val === "下午");
  const WEATHERS = ["晴", "陰", "雨", "雪", "颱風", "停工", "Sunny", "Cloudy", "Rain"];
  if (amLabel) {
    const after = cells.filter((c) => c.row === amLabel.row && c.col > amLabel.col)
      .sort((a, b) => a.col - b.col);
    weatherAm = after[0]?.val ?? null;
  }
  if (pmLabel) {
    const after = cells.filter((c) => c.row === pmLabel.row && c.col > pmLabel.col)
      .sort((a, b) => a.col - b.col);
    weatherPm = after.find((c) => c.val !== weatherAm)?.val ?? after[0]?.val ?? null;
  }
  // 若未找到「上午」標籤，找天氣欄
  if (!weatherAm) {
    const weatherLabel = cells.find((c) => /天氣/.test(c.val));
    if (weatherLabel) {
      const after = cells.filter((c) => c.row === weatherLabel.row && c.col > weatherLabel.col)
        .sort((a, b) => a.col - b.col);
      const wv = after.find((c) => WEATHERS.some((w) => c.val.includes(w)));
      if (wv) weatherAm = weatherPm = wv.val;
    }
  }

  // ── 3. 預定/實際進度 ────────────────────────────────────────
  let plannedProgress: number | null = null;
  let actualProgress: number | null = null;
  const predLabel = cells.find((c) => c.val === "預定");
  const actLabel  = cells.find((c) => c.val === "實際");
  if (predLabel) {
    const after = cells.filter((c) =>
      Math.abs(c.row - predLabel.row) <= 2 && c.col > predLabel.col
    ).sort((a, b) => a.col - b.col);
    const v = parseFloat(after[0]?.val ?? "");
    if (!isNaN(v)) plannedProgress = v;
  }
  if (actLabel) {
    const after = cells.filter((c) =>
      Math.abs(c.row - actLabel.row) <= 2 && c.col > actLabel.col
    ).sort((a, b) => a.col - b.col);
    const v = parseFloat(after[0]?.val ?? "");
    if (!isNaN(v)) actualProgress = v;
  }

  // ── 4. 工項數量表 ───────────────────────────────────────────
  // 找「今日完成數量」標題欄，取其 col 作為 todayQty 欄
  const todayHeader = cells.find((c) => /今日完成/.test(c.val));
  const cumHeader   = cells.find((c) => /累計完成/.test(c.val));
  const unitHeader  = cells.find((c) => c.val === "單位" || /^單位$/.test(c.val));
  const nameHeader  = cells.find((c) => /工程項目|工作項目/.test(c.val));

  const todayCol = todayHeader?.col;
  const cumCol   = cumHeader?.col;
  const unitCol  = unitHeader?.col;
  const nameCol  = nameHeader?.col;
  const headerRow = todayHeader?.row ?? 0;

  const workItems: ParsedDiary["workItems"] = [];
  const workItemLines: string[] = [];

  if (todayCol !== undefined && nameCol !== undefined) {
    // 掃描標題列以下的資料列
    const dataRows = [...new Set(
      cells.filter((c) => c.row > headerRow && c.col === todayCol)
        .map((c) => c.row)
    )];
    for (const row of dataRows) {
      const todayCell = cells.find((c) => c.row === row && c.col === todayCol);
      const qty = parseFloat(todayCell?.val ?? "");
      if (isNaN(qty) || qty <= 0) continue;

      const nameCell = cells.find((c) => c.row === row && c.col === nameCol);
      const itemName = nameCell?.val ?? "";
      if (!itemName || isBoilerplate(itemName)) continue;

      const unitCell = unitCol !== undefined ? cells.find((c) => c.row === row && c.col === unitCol) : null;
      const unit = unitCell?.val ?? "";
      const cumCell = cumCol !== undefined ? cells.find((c) => c.row === row && c.col === cumCol) : null;
      const cumQty = parseFloat(cumCell?.val ?? "0") || 0;

      workItems.push({ itemName, unit, todayQty: qty, cumulativeQty: cumQty });
      workItemLines.push(`${itemName}：${qty} ${unit}`.trim());
    }
  }

  // ── 5. 備註/記事（非樣板文字） ───────────────────────────────
  const notes = cells
    .filter((c) =>
      c.val.length > 4 &&
      !isBoilerplate(c.val) &&
      !/^\d+(\.\d+)?$/.test(c.val) &&
      !workItemLines.some((l) => l.includes(c.val))
    )
    .map((c) => c.val)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 8)
    .join("\n");

  return {
    logDate,
    weatherAm,
    weatherPm,
    plannedProgress,
    actualProgress,
    workItemsText: workItemLines.join("\n"),
    workItems,
    notes,
  };
}

// ── 同步單一檔案 ───────────────────────────────────────────────
async function syncFile(
  fileId: string,
  fileName: string,
  projectId: string,
  token: string
): Promise<{ date: string | null; itemCount: number }> {
  const buf = await downloadDriveFile(fileId, token);
  const parsed = parseMonitoringExcel(buf);

  // 優先用 Excel 內填表日期，fallback 用檔名
  const logDate = parsed.logDate ?? parseDateFromFileName(fileName);
  if (!logDate) throw new Error(`無法解析日期：${fileName}`);

  const now = new Date().toISOString();

  // ① UPSERT daily_logs
  const { error: e1 } = await supabase.from("daily_logs").upsert({
    project_id: projectId,
    log_date: logDate,
    weather_am: parsed.weatherAm,
    weather_pm: parsed.weatherPm,
    planned_progress: parsed.plannedProgress,
    actual_progress: parsed.actualProgress,
    work_items: parsed.workItemsText || null,
    notes: parsed.notes || null,
    sync_source: "google_drive",
    synced_at: now,
  }, { onConflict: "project_id,log_date" });
  if (e1) throw new Error("daily_logs 寫入失敗: " + e1.message);

  // ② UPSERT progress_records（若有進度資料）
  if (parsed.plannedProgress !== null || parsed.actualProgress !== null) {
    const { error: e2 } = await supabase.from("progress_records").upsert({
      project_id: projectId,
      report_date: logDate,
      planned_progress: parsed.plannedProgress ?? 0,
      actual_progress: parsed.actualProgress ?? 0,
      notes: parsed.workItemsText ? parsed.workItemsText.split("\n")[0] : null,
    }, { onConflict: "project_id,report_date" });
    if (e2) console.warn("progress_records 寫入警告:", e2.message);
  }

  // ③ UPSERT daily_report_items（工項明細）
  if (parsed.workItems.length > 0) {
    const itemPayload = parsed.workItems.map((wi) => ({
      project_id: projectId,
      log_date: logDate,
      item_name: wi.itemName,
      unit: wi.unit || null,
      today_qty: wi.todayQty,
      cumulative_qty: wi.cumulativeQty || null,
    }));
    const { error: e3 } = await supabase.from("daily_report_items").upsert(
      itemPayload, { onConflict: "project_id,log_date,item_name" }
    );
    if (e3) console.warn("daily_report_items 寫入警告:", e3.message);
  }

  return { date: logDate, itemCount: parsed.workItems.length };
}

// ── Main Handler ───────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" },
    });
  }

  try {
    const body = await req.json();
    const { secret, mode } = body;

    // 驗證 secret
    if (secret !== SYNC_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const token = await getGoogleAccessToken();

    // ── 批次回朔模式 ──────────────────────────────────────────
    if (mode === "batch") {
      const { projectId, startDate, endDate } = body;
      if (!projectId) return new Response(JSON.stringify({ error: "缺少 projectId" }), { status: 400 });

      // 查詢 project 的 drive_folder_id
      const { data: proj, error: projErr } = await supabase
        .from("projects").select("drive_folder_id, start_date").eq("id", projectId).single();
      if (projErr || !proj?.drive_folder_id) {
        return new Response(JSON.stringify({ error: "找不到工程或未設定 Drive 資料夾" }), { status: 400 });
      }

      const diaryFolderId = await getDiaryFolderId(proj.drive_folder_id, token);
      const files = await listDiaryFiles(
        diaryFolderId,
        token,
        startDate ?? proj.start_date ?? undefined,
        endDate
      );

      const results = [];
      for (const f of files) {
        try {
          const r = await syncFile(f.id, f.name, projectId, token);
          results.push({ file: f.name, ...r, success: true });
        } catch (err) {
          results.push({ file: f.name, success: false, error: String(err) });
        }
      }
      return new Response(JSON.stringify({ mode: "batch", total: files.length, results }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // ── 單次觸發模式（Apps Script webhook）────────────────────
    const { fileId, fileName, projectFolderId } = body;
    if (!fileId || !projectFolderId) {
      return new Response(JSON.stringify({ error: "缺少 fileId 或 projectFolderId" }), { status: 400 });
    }

    // 用 projectFolderId 查出 project_id
    const { data: proj, error: projErr } = await supabase
      .from("projects").select("id").eq("drive_folder_id", projectFolderId).single();
    if (projErr || !proj) {
      return new Response(JSON.stringify({ error: "找不到對應工程，請確認 drive_folder_id 設定正確" }), { status: 400 });
    }

    const result = await syncFile(fileId, fileName, proj.id, token);
    return new Response(JSON.stringify({ success: true, projectId: proj.id, ...result }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (err) {
    console.error("sync-diary error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});

// ── 取得 施工日誌 子資料夾 ID ──────────────────────────────────
async function getDiaryFolderId(projectFolderId: string, token: string): Promise<string> {
  const q = encodeURIComponent(
    `'${projectFolderId}' in parents and name='施工日誌' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const json = await res.json();
  if (json.files?.length) return json.files[0].id;
  // 若找不到子資料夾，直接用工程資料夾（寬容處理）
  return projectFolderId;
}
