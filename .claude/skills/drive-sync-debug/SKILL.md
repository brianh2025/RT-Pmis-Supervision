---
name: drive-sync-debug
description: RT-PMIS Google Drive 施工日誌同步除錯協議。當使用者回報「同步失敗」、「日誌沒同步進來」、「同步到錯的日期」、「檔案找不到」、「Drive 同步有問題」，或要求修改 sync-diary Edge Function 時觸發。載入同步架構、檔名日期格式、常見故障模式與除錯步驟。
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

# Drive 同步除錯協議

## 架構總覽

```
DriveSyncModal.jsx（前端）
   │  POST {VITE_SUPABASE_URL}/functions/v1/sync-diary
   │  body: { secret, mode, ... }
   ▼
supabase/functions/sync-diary/index.ts（Edge Function）
   │  Google Service Account 取 token
   │  → 依 projects.drive_folder_id 找「施工日誌」子資料夾（getDiaryFolderId → listFolderChildren）
   │  → 列出 / 下載 xlsx → fflate 解壓 + 手寫 XML 解析（readAllDiarySheets）
   ▼
Supabase：daily_logs / daily_report_items / progress_records
```

**版本號在 `supabase/functions/sync-diary/index.ts` 檔頭註解**，每次修改必須遞增版本號並加一行變更說明（延續現有格式）。改完用 Supabase MCP `deploy_edge_function` 部署。

## API 模式（mode 參數）

| mode | 用途 |
|------|------|
| `list` / `dry_run` | 只列檔案清單與解析出的日期，不解析 Excel（快速） |
| `sync_one` | 同步單一檔案，由前端逐一呼叫（正式同步路徑） |
| `batch` | 批次同步（一次最多 5 檔，truncated 表示還有剩） |

所有呼叫都需要 `secret`（環境變數 `SYNC_SECRET`）。

## 檔名日期解析（parseDateFromFileName，4 種格式依序嘗試）

1. `施工日誌-1150514`（7 位民國連續，標準命名）
2. `施工日誌-115-05-14` / `施工日誌-115.05.14`（民國年帶分隔符）
3. `施工日誌-20260514`（8 位西元連續）
4. 檔名任何位置的 7 位民國年（向後相容非標準命名，如 `UUID-____1150503.xlsx`）

連續日期檔名（`施工日誌-1150508-1150511`）由 `parseDateEndFromFileName` 取結束日，篩選時做日期區間重疊判斷。

## 已修過的故障模式（回歸時優先檢查）

| 症狀 | 根因 | 修正版本 |
|------|------|---------|
| 選單日卻同步全量檔案 | 日期過濾條件失效 | v35 |
| 部分廠商 xlsx 讀不到內容 | cell 用 inline string（`<is>`）而非 shared string | v35 |
| 「第N號明細表」被當成日誌內容 | BOILERPLATE 過濾清單缺項 | v35 |
| 工項比例出現總價式數值 | 工項解析未跳過總價列 | v35 |
| 日誌在子資料夾找不到 | 未遞迴列子資料夾 | getDiaryFolderId 改用 listFolderChildren |
| S 曲線摔 0 斷線 | 進度欄位皆空仍寫入 0 值 progress_records | v53 |
| 標單/明細表被誤判成日誌 | 解析日期早於開工日 | v54（早於 projects.start_date 一律跳過） |

## 除錯步驟（依序執行）

1. **先確認版本**：讀 `index.ts` 檔頭，確認部署版本與程式碼一致（Supabase MCP `list_edge_functions` 可查部署狀態）
2. **看 log**：Supabase MCP `get_logs`（service: edge-function）找錯誤訊息
3. **dry run**：以 `mode: "list"` 呼叫，檢查檔案清單與 `parsedDate` 是否正確——先分清是「找檔案」還是「解析內容」的問題
4. **找檔案問題** → 檢查 `getDiaryFolderId` / `listFolderChildren` / 檔名日期解析（新的非標準命名？）
5. **解析內容問題** → 檢查 `readAllDiarySheets`（inline string？多 block 垂直並列？）、BOILERPLATE 過濾、日期欄位格式（民國/西元/Excel serial）
6. **寫入問題** → 檢查 daily_logs upsert 條件與 progress_records 邏輯

## 修改紀律

- 版本號 +1、檔頭加變更說明，缺一不可
- 廠商檔案格式千奇百怪：新增解析規則時**向後相容**，不得破壞已支援的 4 種檔名格式與 inline string 支援
- 修完以 `mode: "list"` dry run 驗證過濾結果，再以 `sync_one` 驗證單檔解析，最後才通知使用者實際同步
- 同步中前端有 beforeunload 防離頁與 overlay 防誤關，改 DriveSyncModal 時不得移除
