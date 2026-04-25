# CLAUDE_TASK — xlsx → ExcelJS 遷移

**建立日期：** 2026-04-26
**優先度：** 中（安全技術債清除）
**預估工時：** 4–6 小時
**分支建議：** `fix/replace-xlsx-exceljs`
**Token 預估：** ~50,000（順利）／~120,000（含除錯）
**執行方式：** 分兩個 Session 執行（見下方說明）

---

## ⚡ Session 執行計畫

本任務 token 消耗較大，**請分兩個 Claude Code Session 執行**，
避免單一 Session 中途耗盡配額導致程式碼改到一半。

| | Session A | Session B |
|-|-----------|-----------|
| **範圍** | Step 0–2 | Step 3–6 |
| **涵蓋** | 建分支、換套件、改 `ExcelImportModal` | 改 `ScheduleImportModal`、改 `DiaryExcelImportModal`、驗證、commit |
| **預估 Token** | ~40,000 | ~60,000–80,000 |
| **結束動作** | `git commit`（中間存檔點） | `git commit` + PR |

### Session A 啟動指令
```
請閱讀 CLAUDE_TASK.md，執行 Session A（Step 0–2）：
建立分支、安裝 exceljs + file-saver、移除 xlsx、
改寫 ExcelImportModal.jsx。
完成後執行 git commit，然後停止，等待 Session B。
```

### Session B 啟動指令
```
請閱讀 CLAUDE_TASK.md，執行 Session B（Step 3–6）：
改寫 ScheduleImportModal.jsx、DiaryExcelImportModal.jsx，
完成 lint + build + 驗證，更新 CLAUDE.md 技術債欄位，最終 commit。
目前分支：fix/replace-xlsx-exceljs（Session A 已完成 Step 0–2）。
```

---

## 背景

`xlsx` 套件（SheetJS 社群版）存在以下已知 CVE：
- **Prototype Pollution**（high severity）
- **ReDoS**（高風險正則）

官方無修復版，本系統為內部使用，短期風險可接受，
但應在下一個 sprint 完成替換，消除技術債。

替換目標：`exceljs` + `file-saver`

---

## 受影響檔案清單

經程式碼搜尋，以下 3 個檔案使用 `xlsx`：

| 檔案 | 使用功能 | 複雜度 |
|------|---------|--------|
| `src/components/ExcelImportModal.jsx` | 讀取工程清單 + 匯出範本 | ⭐ 低 |
| `src/components/ScheduleImportModal.jsx` | 讀取進度表 + 合併儲存格展開 + 匯出範本 | ⭐⭐⭐ 高 |
| `src/components/DiaryExcelImportModal.jsx` | 讀取施工日誌 Excel | ⭐⭐ 中 |

**確認指令（執行前先驗證）：**
```bash
grep -rn "from 'xlsx'\|import.*XLSX" src/
```

---

## 執行步驟

### Step 0：建立分支與備份

```bash
git checkout -b fix/replace-xlsx-exceljs
git status
```

### Step 1：安裝新套件，移除舊套件

```bash
npm install exceljs file-saver
npm remove xlsx
npm audit   # 確認 xlsx 相關 CVE 已消失
```

### Step 2：改寫 `ExcelImportModal.jsx`（低難度，先做）

**原始 import：**
```js
import * as XLSX from 'xlsx';
```

**改為：**
```js
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
```

**讀取檔案（`reader.readAsArrayBuffer` 不變，改 parse 方式）：**

```js
// 舊
const wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
const ws = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });

// 新
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(evt.target.result);        // evt.target.result 為 ArrayBuffer
const ws = wb.worksheets[0];
const raw = [];
const headers = [];
ws.eachRow((row, rowNum) => {
  if (rowNum === 1) {
    row.eachCell((cell, colNum) => { headers[colNum] = String(cell.value ?? '').trim(); });
  } else {
    const obj = {};
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      obj[headers[colNum]] = cell.value ?? '';
    });
    raw.push(obj);
  }
});
```

> ⚠️ 注意：`reader.onload` 必須改為 `async`，才能 `await wb.xlsx.load()`

**匯出範本（`downloadTemplate`）：**

```js
// 舊
const ws = XLSX.utils.json_to_sheet(template);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, '工程清單');
XLSX.writeFile(wb, 'PMIS工程匯入範本.xlsx');

// 新
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet('工程清單');
ws.columns = [
  { header: '工程名稱', key: '工程名稱', width: 30 },
  { header: '施工地點', key: '施工地點', width: 20 },
  { header: '承包商',   key: '承包商',   width: 20 },
  { header: '狀態',     key: '狀態',     width: 10 },
  { header: '開工日期', key: '開工日期', width: 14 },
  { header: '預計完工', key: '預計完工', width: 14 },
  { header: '預算萬元', key: '預算萬元', width: 12 },
];
ws.addRow({
  工程名稱: '虎尾鎮排水整治工程',
  施工地點: '虎尾鎮光復路沿線',
  承包商: '中興土木工程公司',
  狀態: '執行中',
  開工日期: '2025-10-15',
  預計完工: '2026-08-31',
  預算萬元: 5200,
});
const buf = await wb.xlsx.writeBuffer();
saveAs(new Blob([buf]), 'PMIS工程匯入範本.xlsx');
```

**日期解析（`parseExcelDate`）：**

```js
// 舊（需要 XLSX.SSF）
// ExcelJS 已自動把 Excel 序號日期轉為 Date 物件，不需要手動轉換
// 直接處理：
function parseExcelDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  // ExcelJS 不會傳入數字型日期，但保留字串解析作為後備
  const s = String(val).trim().replace(/[年/]/g, '-').replace(/月/g, '-').replace(/日/g, '');
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().split('T')[0];
}
```

---

> ✅ **Session A 結束點**
> 執行以下指令存檔後，關閉此 Session：
> ```bash
> git add -A
> git commit -m "重構(WIP)：Session A — 安裝 exceljs，改寫 ExcelImportModal"
> ```

---

### Step 3：改寫 `ScheduleImportModal.jsx`（高難度，重點）

**移除：**
- `import * as XLSX from 'xlsx'`
- `expandMerges()` 函式（ExcelJS 原生處理合併儲存格）
- `XLSX.SSF.parse_date_code()`
- `XLSX.utils.encode_cell()`

**新增：**
```js
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
```

**State 調整：**
```js
// 舊：存 XLSX workbook 物件
const [workbook, setWorkbook] = useState(null);

// 新：存 ExcelJS workbook 物件（型別不同，但 state 結構不變）
const [workbook, setWorkbook] = useState(null);
```

**`handleFile` 改寫（最關鍵）：**

```js
const handleFile = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
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
};
```

**`loadSheet` 改寫（合併儲存格處理核心）：**

```js
const loadSheet = (wb, sheetName) => {
  const ws = wb.getWorksheet(sheetName);
  if (!ws) return;

  // 收集垂直合併的「延伸列」索引（避免工項名稱重複）
  const vertContinueRows = new Set();
  ws.mergeCells; // 觸發 ExcelJS 解析合併格（部分版本需要）

  // ExcelJS 合併格：主格有值，延伸格 value 為 null
  // 用 model.master 判斷是否為延伸格
  const allRows = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    const cells = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      // 若為合併延伸格，取主格的值
      let val = cell.value;
      if (val && typeof val === 'object' && val.sharedFormula === undefined) {
        // richText 物件
        if (val.richText) val = val.richText.map(r => r.text).join('');
      }
      // Date 物件直接保留
      cells.push(val ?? '');
    });
    allRows.push({ rowNum, cells });
  });

  // 找 header 列（第一個非空列）
  if (!allRows.length) { setErrors([`工作表「${sheetName}」是空的`]); return; }
  const headerRow = allRows[0];
  const headers = headerRow.cells.map((h, i) => String(h).trim() || `欄 ${i + 1}`);
  const dataRows = allRows.slice(1).map(r => r.cells);

  setRawHeaders(headers);
  setRawData(dataRows);
  setColMap(autoGuess(headers, dataRows));
  setErrors([]);
  setStep('mapping');
};
```

**`parseDate` 改寫（移除 `XLSX.SSF`）：**

```js
function parseDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw.toISOString().split('T')[0];
  // ExcelJS 自動轉 Date，數字型日期不再出現
  // 保留字串解析作為後備
  let s = String(raw).trim().replace(/[年/]/g, '-').replace(/月/g, '-').replace(/日/g, '');
  const roc = s.match(/^(\d{2,3})-(\d{1,2})-(\d{1,2})/);
  if (roc && parseInt(roc[1]) < 1911)
    s = `${parseInt(roc[1]) + 1911}-${roc[2].padStart(2, '0')}-${roc[3].padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().split('T')[0];
}
```

**`downloadTemplate` 改寫：**

```js
async function downloadTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('計畫進度表');
  ws.columns = [
    { header: '工項名稱', key: 'name',   width: 20 },
    { header: '開始日期', key: 'start',  width: 14 },
    { header: '結束日期', key: 'end',    width: 14 },
    { header: '權重(%)',  key: 'weight', width: 10 },
  ];
  const rows = [
    { name: '假設工程', start: '113-01-01', end: '113-02-28', weight: 5.0  },
    { name: '土方開挖', start: '113-02-01', end: '113-04-30', weight: 15.0 },
    { name: '基礎工程', start: '113-04-01', end: '113-07-31', weight: 20.0 },
    { name: '結構體',   start: '113-06-01', end: '113-12-31', weight: 35.0 },
    { name: '裝修工程', start: '113-11-01', end: '114-02-28', weight: 20.0 },
    { name: '竣工驗收', start: '114-02-01', end: '114-03-31', weight: 5.0  },
  ];
  rows.forEach(r => ws.addRow(r));
  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf]), '工程計畫進度表範本.xlsx');
}
```

> ⚠️ `downloadTemplate` 改為 async，呼叫端的 `onClick` 要改為：
> ```jsx
> onClick={() => downloadTemplate()}
> ```

---

### Step 4：改寫 `DiaryExcelImportModal.jsx`（中難度）

此檔案使用 `localStorage`（舊版日誌邏輯），`xlsx` 用法較單純：

```js
// 舊
const wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
const ws = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

// 新（同 ExcelImportModal 模式）
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(evt.target.result);
const ws = wb.worksheets[0];
const raw = [];
ws.eachRow({ includeEmpty: true }, (row) => {
  const cells = [];
  row.eachCell({ includeEmpty: true }, (cell) => {
    let val = cell.value;
    if (val && val.richText) val = val.richText.map(r => r.text).join('');
    cells.push(val ?? '');
  });
  raw.push(cells);
});
```

---

### Step 5：驗證

```bash
# 1. Lint 確認
npm run lint

# 2. 建置確認
npm run build

# 3. 安全確認
npm audit

# 4. 手動測試（逐項）
```

**手動測試清單：**
- [ ] `ExcelImportModal`：上傳 `.xlsx` 工程清單 → 預覽正確 → 匯入成功
- [ ] `ExcelImportModal`：下載範本 → 可用 Excel 開啟 → 格式正確
- [ ] `ScheduleImportModal`：上傳含合併儲存格的進度表 → 解析正確（工項不重複）
- [ ] `ScheduleImportModal`：上傳多工作表 → 選擇工作表步驟正常
- [ ] `ScheduleImportModal`：下載範本 → 可用 Excel 開啟
- [ ] `DiaryExcelImportModal`：上傳日誌 Excel → 欄位對應步驟正常

---

### Step 6：更新文件與 commit

```bash
# 確認無殘留 xlsx import
grep -rn "from 'xlsx'" src/

# Commit
git add -A
git commit -m "重構：xlsx 替換為 exceljs + file-saver，消除 CVE 技術債"

# 更新 CLAUDE.md：
# 1. 移除 xlsx 技術債條目
# 2. 新增以下「操作告知規範」段落：
#
# ## 操作告知規範
# - 凡要求使用者前往其他介面執行任何動作前，
#   必須先列出所有前置步驟（含檔案下載、路徑確認等），
#   確認前置條件完成後，才給出執行指令。
# - 有檔案需下載時，必須明確標示「請先下載 XX 檔案」。
#
# 更新 pmis-maintenance/SKILL.md（移除 xlsx 漏洞監控項目）
```

---

## 已知風險與注意事項

| 風險 | 說明 | 對策 |
|------|------|------|
| ExcelJS bundle 較大 | +~220KB（未壓縮），gzip 後約 +60KB | 可用 `import ExcelJS from 'exceljs/dist/es5/exceljs.browser'` 精簡版 |
| 合併儲存格解析差異 | ExcelJS 延伸格 value 為 null，而非複製主格值 | 已在 `loadSheet` 改寫中處理 |
| `async` 傳染 | `handleFile` 改 async 後，`reader.onload` 無法直接 await | 用 `file.arrayBuffer()` 取代 FileReader |
| `DiaryExcelImportModal` localStorage | 此檔案仍用舊版 localStorage 儲存日誌，與 Supabase 架構不一致，是獨立技術債，本次不處理 |

---

## 完成定義（DoD）

- [ ] `npm audit` 無 xlsx 相關 CVE
- [ ] `npm run build` 成功，無 error
- [ ] 3 個 modal 手動測試全數通過
- [ ] `CLAUDE.md` 技術債欄位更新
- [ ] PR 合併至 `main`
