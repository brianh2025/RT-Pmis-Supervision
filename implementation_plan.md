# 公開前第 2 次 Debug Plan — RT-PMIS 監造系統

系統全面除錯與功能驗證報告。針對 `www.xiaoxong.page` 已部署版本進行瀏覽器測試與原始碼靜態分析，涵蓋全部 14 個頁面、28 個元件、及所有 CRUD / 同步 / 匯出功能。

---

## User Review Required

> [!IMPORTANT]
> 以下列出的錯誤依嚴重度分為 **Critical（系統當機/資料遺失）**、**Major（功能異常）** 和 **Minor（UX/視覺瑕疵）**。Critical 和 Major 等級的問題建議在公開發布前全部修正。

> [!WARNING]
> **日誌同步（Drive Sync）發現重大缺漏**：已新增 **Bug #17** 和 **Bug #18**，這兩個問題會導致極其嚴重的效能癱瘓與永久性進度資料覆蓋，公開前「務必」修正！

> [!WARNING]
> **跨專案警示邏輯缺漏**：您在目標中提到需驗證「跨專案警示邏輯（Cross-project alert logic）」，但目前系統專案原始碼中並未發現對應功能的實作，請確認這是否由其他未包含的微服務執行，或有功能遺漏？

---

## 發現的錯誤清單

### 🔴 Critical（系統當機 / 資料遺失風險）

---

#### Bug #17 — `DiaryJournal.jsx` 背景自動同步會下載所有歷史檔案 (效能災難)

**位置**: [DiaryJournal.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/DiaryJournal.jsx#L47-L79)

**問題描述**: `runBackgroundSync` 在元件載入時會自動取得所有大於 `start_date` 的 Google Drive 檔案，並對**所有**檔案發出 `sync_one` 請求，沒有濾除「已同步過的」檔案。專案若有數百份歷史日誌，每次進入日誌頁面都會觸發對 Edge Function 的數百次連發呼叫，導致所有歷史檔案被重新下載與解析。

**影響**: 極其耗費系統與資料庫資源，必定導致 API 速率限制 (Rate Limit) 觸發、甚至癱瘓 Supabase 後端效能。

**修正方案**:
1. 將自動背景同步改為僅針對「近 3 日」的檔案，或不再於前端背景自動觸發，僅使用 `DriveSyncModal` 讓用戶手動點擊同步。
2. 若堅持背景自動同步，需實作清單過濾（篩減掉在 `last_synced_time` 時已載過的歷史檔案）。

---

#### Bug #18 — `sync-diary` 重複同步會覆蓋對進度的手動修改 (資料遺失)

**位置**: [sync-diary/index.ts](file:///e:/RT-Pmis-Supervision-1/supabase/functions/sync-diary/index.ts#L571-L578)

**問題描述**: Google Drive 的 Edge Function （`sync-diary`）在同步寫入 `progress_records` 時使用了無條件的 `upsert`。配合 Bug #17 的歷史檔案頻繁同步，如果使用者曾在「進度管理」介面手動修正了前幾天的進度數據，一進日誌頁面，手動修正的心血就會立刻被 Google Drive 內原本的 Excel 資料蓋掉。

**影響**: 在正式營運環境下會造成無警示的用戶修正資料永遠遺失。

**修正方案**:
- 在 Edge Function 更新 `progress_records` 之前加入判斷：如果是已經有 `actual_progress` 值，且這筆資不是來自 Google Drive 的新增記錄，就跳過不覆蓋。

---

#### Bug #1 — Analytics 查詢不存在的資料表 `progress_items`

**位置**: [Analytics.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/Analytics.jsx#L52)

**問題描述**: `Analytics.jsx` 第 52 行查詢 `progress_items` 資料表，但系統中所有其他頁面（ProgressManagement、ProjectDashboard、DailyReportContext）均使用 `progress_records` 資料表。`progress_items` 資料表很可能不存在於 Supabase Schema 中。

**影響**: 統計分析頁面「施工進度」 tab 無法顯示任何圖表資料，控制台可能報 `relation "progress_items" does not exist` 錯誤。因為使用 `Promise.all`，此錯誤也可能導致其他查詢結果一併丟失。

**修正方案**:
```diff
- supabase.from('progress_items').select('*').eq('project_id', projectId).order('created_at'),
+ supabase.from('progress_records').select('*').eq('project_id', projectId).order('report_date'),
```
同時修正對應的 `progressData` 資料映射邏輯：
```diff
- if (progRows && progRows.length > 0) {
-   const sorted = [...progRows].sort((a, b) => ...);
-   setProgressData(sorted.map((r, i) => ({
-     name: r.name?.substring(0, 10) || `項目${i + 1}`,
-     planned: r.planned_qty || 0,
-     actual: r.actual_qty || 0,
-   })));
- }
+ if (progRows && progRows.length > 0) {
+   setProgressData(progRows.map(r => ({
+     name: r.report_date?.substring(5) || '—',
+     planned: r.planned_progress || 0,
+     actual: r.actual_progress || 0,
+   })));
+ }
```

---

#### Bug #2 — Analytics 查詢 `submissions` 資料表可能不存在

**位置**: [Analytics.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/Analytics.jsx#L53)

**問題描述**: `Analytics.jsx` 查詢 `submissions` 資料表，但系統的送審管理實際使用 `mcs_submission` 和 `mcs_plan` 資料表（見 Submission.jsx L35 `DB_TABLES = ['mcs_submission', 'mcs_plan']`）。`submissions` 資料表可能不存在或已不使用。

**影響**: 統計分析頁面「送審狀態」 tab 可能為空或報錯。`Dashboard.jsx` 和 `ProjectDashboard.jsx` 也出現相同問題。

**修正方案**:
#### [MODIFY] [Analytics.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/Analytics.jsx)
- 將 `submissions` 查詢改為 `mcs_submission`
- 需根據 `mcs_submission` 實際欄位調整 status 映射（`result` 欄位取代 `status`）

#### [MODIFY] [Dashboard.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/Dashboard.jsx)
- 第 258 行的 `submissions` 查詢同步修正

#### [MODIFY] [ProjectDashboard.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/ProjectDashboard.jsx)
- 第 90-91 行的 `submissions` 查詢同步修正

---

#### Bug #3 — `PhotoTable.jsx` 和 `Archive.jsx` 的 category 值不一致

**位置**: 
- [PhotoTable.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/PhotoTable.jsx#L458): `.eq('category', '施工照片')`
- [Archive.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/Archive.jsx#L114): `CATEGORY_TREE` 使用 `key: 'photo'`

**問題描述**: `PhotoTable.jsx` 在查詢和寫入 `archive_docs` 時使用 `category = '施工照片'`（中文字串），但 `Archive.jsx` 的 `CATEGORY_TREE` 定義 category key 為 `'photo'`（英文），且新增文件的 form 提交也使用英文 key。這導致：
1. PhotoTable 建立的照片歸檔記錄在 Archive 頁面無法被分類到「施工照片」分類下
2. Archive 的「施工照片」分類始終顯示 0 筆
3. Archive 第 370 行的「預覽 PDF」按鈕條件 `doc.category === '施工照片'` 永遠為 false

**修正方案**: 統一使用英文 key `'photo'`
#### [MODIFY] [PhotoTable.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/PhotoTable.jsx)
- 將所有 `'施工照片'` 改為 `'photo'`

---

### 🟡 Major（功能異常）

---

#### Bug #4 — `ProgressManagement.jsx` 表格差異値使用錯誤欄位

**位置**: [ProgressManagement.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/ProgressManagement.jsx#L234)

**問題描述**: 表格渲染中第 234 行使用 `Number(r.planned_progress)` 計算差異值，但 `planned_progress` 欄位是在 S-Curve 計算中由 `calcPlanned()` 動態計算的，並非儲存在 `progress_records` 資料庫記錄中。此欄位可能為 `undefined` 或舊值。

**影響**: 歷史進度紀錄表中的「差異(%)」欄位顯示值可能與 S-Curve 圖表上的差異不一致。

**修正方案**: 使用 `calcPlanned(r.report_date)` 替代 `r.planned_progress`：
```diff
- const diff = (Number(r.actual_progress) - Number(r.planned_progress)).toFixed(3);
+ const planned = calcPlanned(r.report_date);
+ const diff = planned !== null 
+   ? (Number(r.actual_progress) - planned).toFixed(3)
+   : '—';
```

---

#### Bug #5 — `Submission.jsx` 中的歸檔操作不驗證 `archive_docs` 表結構

**位置**: [Submission.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/Submission.jsx#L222-L233)

**問題描述**: `archiveRow()` 函數插入至 `archive_docs` 時使用了 `submission_id` 和 `source_table` 欄位。如果 `archive_docs` 資料表的 schema 沒有這兩個欄位，整個歸檔操作會靜默失敗。

**影響**: 「→歸檔」按鈕可能顯示失敗提示「歸檔失敗，請確認 archive_docs 資料表欄位」。

**修正方案**: 需確認 Supabase `archive_docs` 資料表是否已有 `submission_id` 和 `source_table` 欄位；若無則需執行 migration：
```sql
ALTER TABLE archive_docs ADD COLUMN IF NOT EXISTS submission_id uuid;
ALTER TABLE archive_docs ADD COLUMN IF NOT EXISTS source_table text;
```

---

#### Bug #6 — `DailyReportForm.jsx` 底部固定導覽列使用不存在的 CSS 變數

**位置**: [DailyReportForm.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/DailyReport/DailyReportForm.jsx#L293)

**問題描述**: 第 293 行使用 `background: "var(--color-background-base)"`，但全域 CSS 中沒有定義 `--color-background-base` 變數（系統使用 `--color-bg1`）。

**影響**: 底部導覽列背景透明，在捲動內容時文字會與頁面內容重疊，難以閱讀。

**修正方案**:
```diff
- background: "var(--color-background-base)",
+ background: "var(--color-bg1)",
```

---

#### Bug #7 — `MaterialControl.jsx` 的 `scheduleDbUpdate` 使用閉包陷阱

**位置**: [MaterialControl.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/MaterialControl.jsx#L221-L231)

**問題描述**: `scheduleDbUpdate` 在 timeout callback 中使用 `dbTable` 變數，但 `dbTable` 是從 `tab` state 計算的外部值。如果用戶在 800ms 延遲期間切換了 tab，`dbTable` 值會指向錯誤的資料表，可能導致資料寫入到錯誤的表。

**影響**: 快速切換 tab 並編輯儲存格時，資料可能被寫入錯誤的資料表（例如本應寫入 `material_entries` 的資料被寫入 `mcs_test`）。

**修正方案**: 在 `scheduleDbUpdate` 中捕獲當前 `dbTable` 值：
```diff
- function scheduleDbUpdate(rowId, patch) {
+ function scheduleDbUpdate(rowId, patch, targetTable = dbTable) {
    if (!supabase) return;
    if (saveQueueRef.current[rowId]) clearTimeout(saveQueueRef.current[rowId]);
    saveQueueRef.current[rowId] = setTimeout(async () => {
      setSaving(true);
-     const { error } = await supabase.from(dbTable).update(patch).eq('id', rowId);
+     const { error } = await supabase.from(targetTable).update(patch).eq('id', rowId);
      if (error) console.error('update error:', error);
      setSaving(false);
      setLastSaved(new Date());
    }, 800);
  }
```

---

#### Bug #8 — `Quality.jsx` Tab 2（試驗報告）的刪除操作使用錯誤的 table

**位置**: [Quality.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/Quality.jsx#L233-L244)

**問題描述**: `deleteSelected()` 函數只處理 `tab === 0` (construction_inspections) 和 `else`（quality_issues），完全沒有處理 `tab === 2`（mcs_test）的情況。當在「試驗報告管制」tab 選取記錄並點擊刪除時，將錯誤地從 `quality_issues` 資料表中執行刪除。

**影響**: 在試驗報告 tab 刪除記錄時，輕則刪除失敗（ID 不匹配），重則誤刪 quality_issues 中的記錄。

**修正方案**:
```diff
  if (tab === 0) {
    await supabase.from('construction_inspections').delete().in('id', ids);
    setInspections(prev => prev.filter(r => !selected.has(r.id)));
- } else {
+ } else if (tab === 1) {
    await supabase.from('quality_issues').delete().in('id', ids);
    setIssues(prev => prev.filter(r => !selected.has(r.id)));
+ } else if (tab === 2) {
+   await supabase.from('mcs_test').delete().in('id', ids);
+   setTests(prev => prev.filter(r => !selected.has(r.id)));
  }
```

---

#### Bug #9 — `Quality.jsx` Tab 2 的 `commitEdit` 不支援 `mcs_test`

**位置**: [Quality.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/Quality.jsx#L217-L228)

**問題描述**: `commitEdit()` 函數在更新本地 state 時只判斷 `table === 'construction_inspections'`，否則更新 `issues`。若 table 為 `mcs_test`，則 Supabase 會正確更新（因為直接用 `table` 變數），但本地 state 不會反映變更。

**修正方案**: 
```diff
  if (table === 'construction_inspections') {
    setInspections(prev => prev.map(r => r.id === id ? { ...r, [field]: editVal } : r));
- } else {
+ } else if (table === 'quality_issues') {
    setIssues(prev => prev.map(r => r.id === id ? { ...r, [field]: editVal } : r));
+ } else if (table === 'mcs_test') {
+   setTests(prev => prev.map(r => r.id === id ? { ...r, [field]: editVal } : r));
  }
```

---

#### Bug #10 — `ScheduleImportModal.jsx` 步驟指示器的分隔符數量有誤

**位置**: [ScheduleImportModal.jsx](file:///e:/RT-Pmis-Supervision-1/src/components/ScheduleImportModal.jsx#L241)

**問題描述**: 步驟指示器中使用 `{idx < 2 && ...}` 來決定是否顯示 `›` 分隔符。但 `stepLabels` 可能有 3 或 4 個項目，應使用 `idx < stepLabels.length - 1`。

**影響**: 當有 4 個步驟時，第 3 步和第 4 步之間缺少分隔符 `›`。

**修正方案**:
```diff
- {idx < 2 && <span ...>›</span>}
+ {idx < stepLabels.length - 1 && <span ...>›</span>}
```

---

#### Bug #11 — `AddProjectModal.jsx` 預算欄位的顯示/輸入邏輯衝突

**位置**: [AddProjectModal.jsx](file:///e:/RT-Pmis-Supervision-1/src/components/AddProjectModal.jsx#L129)

**問題描述**: 預算 input 的 `value` 使用 `Number(form.budget).toLocaleString('zh-TW')` 格式化顯示（加入千分位逗號如 `52,000,000`），但 `onChange` 使用 `value.replace(/[^0-9]/g, '')` 去除非數字字元。這導致：
1. `toLocaleString` 輸出包含逗號
2. 用戶在中間插入游標時，每次按鍵都會導致游標跳到最後（因為 React 重新渲染格式化後的值）
3. 刪除操作在逗號旁邊表現異常

**影響**: 預算欄位編輯體驗不佳，游標會在每次輸入後跳到最右邊。

**修正方案**: 移除 value 端的即時格式化，僅在 blur 時或 label 上顯示格式化值：
```diff
- value={form.budget ? Number(form.budget).toLocaleString('zh-TW') : ''}
+ value={form.budget}
```

---

### 🟢 Minor（UX / 視覺瑕疵）

---

#### Bug #12 — `DiaryPrintView.jsx` 列印報表可能缺少進度欄位

**位置**: [DiaryPrintView.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/DiaryPrintView.jsx)

**問題描述**: 根據此前的分析，列印報表可能未正確呈現 `planned_progress` 和 `actual_progress` 欄位，因為這些欄位是後來加入 `daily_logs` 表的新欄位。

**修正方案**: 確認 DiaryPrintView 的 reportData 結構是否包含 progress 欄位，若缺少需補充。

---

#### Bug #13 — `DiaryJournal.jsx` 的 `weather_pm` fallback 邏輯混淆

**位置**: [DiaryJournal.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/DiaryJournal.jsx)

**問題描述**: `weather_pm` 在 PDF 解析時可能出現與 `weather_am` 相同值被排除的情況（DiaryImportModal.jsx L139: `i.str !== weatherAm`），但實際上上下午天氣相同是正常情況。

**修正方案**: 移除 `DiaryImportModal.jsx` 第 139 行的 `i.str !== weatherAm` 過濾：
```diff
- weatherPm = afterPm.find(i => VALID_WEATHER.includes(i.str) && i.str !== weatherAm)?.str ?? null;
+ weatherPm = afterPm.find(i => VALID_WEATHER.includes(i.str))?.str ?? null;
```

---

#### Bug #14 — `Submission.jsx` 的 `scheduleDbUpdate` 閉包問題（同 Bug #7）

**位置**: [Submission.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/Submission.jsx#L199-L209)

**問題描述**: 與 `MaterialControl.jsx` 相同的 `dbTable` 閉包陷阱。

**修正方案**: 同 Bug #7，在函數簽名中捕獲目標 table。

---

#### Bug #15 — 整體缺少 Error Boundary

**問題描述**: 整個應用沒有 React Error Boundary，任何未捕獲的頁面渲染錯誤會導致白屏。

**修正方案**: 
#### [NEW] [ErrorBoundary.jsx](file:///e:/RT-Pmis-Supervision-1/src/components/ErrorBoundary.jsx)
- 建立全域 Error Boundary 元件，在 App.jsx 的 `<Routes>` 外層包裝

---

#### Bug #16 — `xlsx` 套件安全漏洞

**問題描述**: `xlsx` 套件（SheetJS）存在 High severity 的 Prototype Pollution 漏洞（CVE-2023-30533）。

**修正方案**: 未來版本遷移至 `xlsx-js-style` 或 `exceljs`。目前不影響功能。

---

## Proposed Changes

### Component 1: Analytics（最高優先順序）

#### [MODIFY] [Analytics.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/Analytics.jsx)
- 修正 `progress_items` → `progress_records`（Bug #1）
- 修正 `submissions` 查詢（Bug #2）
- 修正 progressData 映射邏輯

---

### Component 2: Quality（高優先順序）

#### [MODIFY] [Quality.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/Quality.jsx)
- 修正 `deleteSelected()` 支援 Tab 2 mcs_test（Bug #8）
- 修正 `commitEdit()` 支援 mcs_test state 更新（Bug #9）

---

### Component 3: PhotoTable ↔ Archive 一致性

#### [MODIFY] [PhotoTable.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/PhotoTable.jsx)
- 統一 category 值為英文 key `'photo'`（Bug #3）

---

### Component 4: ProgressManagement

#### [MODIFY] [ProgressManagement.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/ProgressManagement.jsx)
- 修正表格差異值使用 `calcPlanned()`（Bug #4）

---

### Component 5: MaterialControl & Submission 閉包修正

#### [MODIFY] [MaterialControl.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/MaterialControl.jsx)
- 修正 `scheduleDbUpdate` 閉包（Bug #7）

#### [MODIFY] [Submission.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/Submission.jsx)
- 修正 `scheduleDbUpdate` 閉包（Bug #14）

---

### Component 6: DailyReportForm

#### [MODIFY] [DailyReportForm.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/DailyReport/DailyReportForm.jsx)
- 修正 CSS 變數 `--color-background-base` → `--color-bg1`（Bug #6）

---

### Component 7: ScheduleImportModal

#### [MODIFY] [ScheduleImportModal.jsx](file:///e:/RT-Pmis-Supervision-1/src/components/ScheduleImportModal.jsx)
- 修正步驟指示器分隔符數量（Bug #10）

---

### Component 8: AddProjectModal

#### [MODIFY] [AddProjectModal.jsx](file:///e:/RT-Pmis-Supervision-1/src/components/AddProjectModal.jsx)
- 修正預算 input 格式化/輸入衝突（Bug #11）

---

### Component 9: DiaryImportModal

#### [MODIFY] [DiaryImportModal.jsx](file:///e:/RT-Pmis-Supervision-1/src/components/DiaryImportModal.jsx)
- 修正下午天氣過濾邏輯（Bug #13）

---

### Component 10: Dashboard & ProjectDashboard

#### [MODIFY] [Dashboard.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/Dashboard.jsx)
- 修正 `submissions` 查詢（Bug #2）

#### [MODIFY] [ProjectDashboard.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/ProjectDashboard.jsx)
- 修正 `submissions` 查詢（Bug #2）

---

### Component 11: DiaryJournal & Sync-Diary (日誌同步重大修正)

#### [MODIFY] [DiaryJournal.jsx](file:///e:/RT-Pmis-Supervision-1/src/pages/DiaryJournal.jsx)
- 取消或限制 `runBackgroundSync` 會不加篩選載入所有歷史檔案的邏輯 (Bug #17)

#### [MODIFY] [sync-diary/index.ts](file:///e:/RT-Pmis-Supervision-1/supabase/functions/sync-diary/index.ts)
- 調整 `progress_records` 寫入邏輯，加入對現有手動資料的不覆蓋判斷來防護資料遺失 (Bug #18)

---

## 錯誤優先等級摘要

| # | 嚴重度 | 頁面 | 說明 | 影響範圍 |
|---|--------|------|------|----------|
| 17 | 🔴 Critical | DiaryJournal | 背景無差別同步所有歷史檔案 | 系統效能嚴重癱瘓/Rate Limit |
| 18 | 🔴 Critical | sync-diary | 同步覆蓋無保護機制 | 永久性覆蓋手動修正的進度 |
| 1 | 🔴 Critical | Analytics | 查詢不存在的 `progress_items` 表 | 圖表空白/報錯 |
| 2 | 🔴 Critical | Analytics/Dashboard | 查詢可能不存在的 `submissions` 表 | 送審統計失效 |
| 3 | 🔴 Critical | PhotoTable↔Archive | category 值中英不一致 | 照片記錄無法正確歸類 |
| 8 | 🟡 Major | Quality | Tab 2 刪除操作指向錯誤的表 | 可能誤刪品管記錄 |
| 9 | 🟡 Major | Quality | Tab 2 編輯後 state 不同步 | 需重新整理才看到結果 |
| 7 | 🟡 Major | MaterialControl | scheduleDbUpdate 閉包陷阱 | 跨 tab 資料寫入錯誤 |
| 4 | 🟡 Major | ProgressManagement | 表格差異值計算錯誤 | 數值與圖表不一致 |
| 6 | 🟡 Major | DailyReportForm | CSS 變數不存在導致透明背景 | 底部導覽列不可讀 |
| 5 | 🟡 Major | Submission | 歸檔可能因缺少欄位失敗 | 歸檔功能無法使用 |
| 10 | 🟢 Minor | ScheduleImportModal | 步驟指示器分隔符不完整 | 視覺瑕疵 |
| 11 | 🟢 Minor | AddProjectModal | 預算輸入游標跳動 | UX 不佳 |
| 13 | 🟢 Minor | DiaryImportModal | 下午天氣解析遺漏同值情況 | 天氣資料不完整 |
| 14 | 🟢 Minor | Submission | scheduleDbUpdate 閉包（同 #7） | 跨 tab 資料寫入錯誤 |
| 12 | 🟢 Minor | DiaryPrintView | 列印報表可能缺少進度欄位 | 需確認 |
| 15 | 🟢 Minor | 全域 | 缺少 Error Boundary | 未捕獲錯誤白屏 |
| 16 | 🟢 Minor | 依賴 | xlsx 安全漏洞 | 安全警告 |

---

## Verification Plan

### Automated Tests
1. `npm run build` 確認無編譯錯誤
2. 瀏覽器開發者工具檢查控制台無 Supabase 查詢錯誤
3. 逐頁瀏覽確認所有頁面可正常載入

### Manual Verification
1. 進入統計分析頁面，確認所有 6 個 tab 均有資料或正確顯示「尚無資料」
2. 在品管管理 Tab 2（試驗報告）新增、編輯、刪除記錄
3. 在照片記錄系統建立記錄，並確認可在歸檔管理的「施工照片」分類中看到
4. 在進度管理頁面確認表格差異值與 S-Curve 圖表一致
5. 在材料管制頁面切換 tab 並快速編輯，確認資料寫入正確的表
