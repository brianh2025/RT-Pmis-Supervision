# 公開前第 2 次 Debug Plan — RT-PMIS（v3 自動化審計版）

## 方法論

> [!IMPORTANT]
> **為何 v1/v2 漏掉了 Bug？** 因為只做了「程式碼邏輯層面」的人工審閱，沒有系統性地將每一個 Supabase 操作（insert/update/upsert/select/eq）與 SQL Schema 的欄位型別和存在性進行交叉比對。
>
> **v3 方法論改進：** 自行開發 Node.js 審計腳本，自動化以下 4 層驗證：
> 1. **表名存在性**：提取所有 `.from('xxx')` 表名 → 比對 3 個 SQL migration 檔案
> 2. **欄位型別匹配**：檢查所有 `columnName: ''` 賦值 → 比對 SQL 的 `DATE`/`NUMERIC`/`INTEGER` 型別
> 3. **SELECT 欄位存在性**：檢查所有 `.select('col1, col2')` → 比對表定義
> 4. **EQ 過濾欄位存在性**：檢查所有 `.eq('col', val)` → 比對表定義

---

## 審計結果總覽

| 層面 | 掃描工具 | 發現 |
|------|----------|------|
| 表名存在性 | 自動化腳本 | 4 個幽靈表（`progress_items`, `submissions`, + 2 個可能已在 Supabase 手動建立） |
| 欄位型別 | 自動化腳本 | 3 個 `''` → `DATE` 型別不匹配（MaterialControl、AddProjectModal×2） |
| 欄位存在性 | 自動化腳本 | 4 個不在 schema 定義中的欄位（`drive_folder_id`, `planned/actual_progress` on daily_logs） |
| 程式邏輯 | 人工審閱 | 19 個邏輯/UX 錯誤 |
| 編譯 | `npm run build` | ✅ 通過，0 錯誤 |
| **合計** | | **30 個 Bug** |

---

## 🔴 Critical — 阻斷操作（5 個）

---

### Bug C1 — `MaterialControl.jsx` 材料進場無法新增 🆕 用戶確認

| 欄位 | 內容 |
|------|------|
| **位置** | [MaterialControl.jsx:164](file:///e:/RT-Pmis-Supervision-1/src/pages/MaterialControl.jsx#L164) |
| **發現方式** | 自動化審計（DATE 型別 vs 空字串） + 用戶回報 |
| **問題** | `addRow()` 寫入 `entry_date: ''`。DB Schema: `entry_date DATE`。PostgreSQL 拒絕空字串寫入 DATE → insert 100% 失敗。 |
| **影響** | **材料進場紀錄完全無法新增** |

```diff
- newRow = { project_id: projectId, created_by: user?.id, entry_date: '', name: '', spec: '', qty: '', vendor: '', inspector: '', remark: '' };
+ newRow = { project_id: projectId, created_by: user?.id, entry_date: new Date().toISOString().split('T')[0], name: '', spec: '', qty: '', vendor: '', inspector: '', remark: '' };
```

---

### Bug C2 — `Analytics.jsx` 查詢不存在的 `progress_items` 表

| 欄位 | 內容 |
|------|------|
| **位置** | [Analytics.jsx:52](file:///e:/RT-Pmis-Supervision-1/src/pages/Analytics.jsx#L52) |
| **發現方式** | 自動化審計（表名不存在） |
| **問題** | 查詢 `progress_items`，所有 3 個 SQL 檔案中均無此表。應為 `progress_records`。 |
| **影響** | **統計分析頁面資料載入失敗** |

```diff
- supabase.from('progress_items').select('*').eq('project_id', projectId).order('created_at'),
+ supabase.from('progress_records').select('*').eq('project_id', projectId).order('report_date'),
```
並修正 L60-66 的映射欄位（`name/planned_qty/actual_qty` → `report_date/planned_progress/actual_progress`）。

---

### Bug C3 — `Analytics / Dashboard / ProjectDashboard` 查詢不存在的 `submissions` 表

| 欄位 | 內容 |
|------|------|
| **位置** | [Analytics.jsx:53](file:///e:/RT-Pmis-Supervision-1/src/pages/Analytics.jsx#L53), [Dashboard.jsx:258](file:///e:/RT-Pmis-Supervision-1/src/pages/Dashboard.jsx#L258), [ProjectDashboard.jsx:90-91](file:///e:/RT-Pmis-Supervision-1/src/pages/ProjectDashboard.jsx#L90-L91) |
| **發現方式** | 自動化審計（表名不存在） |
| **問題** | 3 個 SQL 檔案中均無 `submissions` 表。送審管理使用 `mcs_submission` + `mcs_plan`。 |
| **影響** | **儀表板送審統計/警示永遠為 0** |

---

### Bug C4 — `PhotoTable ↔ Archive` category 中英不一致

| 欄位 | 內容 |
|------|------|
| **位置** | [PhotoTable.jsx:834](file:///e:/RT-Pmis-Supervision-1/src/pages/PhotoTable.jsx#L834), [Archive.jsx:114-125](file:///e:/RT-Pmis-Supervision-1/src/pages/Archive.jsx#L114-L125), [Archive.jsx:370](file:///e:/RT-Pmis-Supervision-1/src/pages/Archive.jsx#L370) |
| **發現方式** | 人工審閱 |
| **問題** | PhotoTable 寫入 `category: '施工照片'`，Archive 用 `key: 'photo'`。 |
| **影響** | **照片歸檔跨頁面完全斷裂** |

```diff
# PhotoTable.jsx L834, L458, L938
- category: '施工照片'
+ category: 'photo'

# Archive.jsx L370
- {doc.category === '施工照片' && doc.remark && (
+ {doc.category === 'photo' && doc.remark && (
```

---

### Bug C5 — `AddProjectModal` 寫入不存在的 `drive_folder_id` 欄 + status CHECK 違反 🆕

| 欄位 | 內容 |
|------|------|
| **位置** | [AddProjectModal.jsx:63](file:///e:/RT-Pmis-Supervision-1/src/components/AddProjectModal.jsx#L63), [EditProjectModal.jsx:54](file:///e:/RT-Pmis-Supervision-1/src/components/EditProjectModal.jsx#L54) |
| **發現方式** | 自動化審計（欄位不存在） + Schema CHECK 約束分析 |
| **問題** | ① `projects` 表 Schema 定義（[supabase_schema.sql:7-18](file:///e:/RT-Pmis-Supervision-1/supabase_schema.sql#L7-L18)）中沒有 `drive_folder_id` 欄位。② `status` CHECK 約束只允許 `'active','completed','suspended'`，但 UI 提供 `'pending'` 和 `'accepted'` 選項（[EditProjectModal.jsx:127-131](file:///e:/RT-Pmis-Supervision-1/src/components/EditProjectModal.jsx#L127-L131)）。 |
| **影響** | ① 新增/編輯工程時若填寫 Drive ID → insert/update 失敗。② 選擇「未發包」或「已竣工」狀態 → update 被 CHECK 約束拒絕。 |

**修正方案** — 需執行 SQL migration：
```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('pending', 'active', 'completed', 'accepted', 'suspended'));
```

---

## 🟡 Major — 功能異常（11 個）

---

### Bug M1 — `daily_logs` 缺少 `planned_progress` / `actual_progress` 欄位 🆕

| 欄位 | 內容 |
|------|------|
| **位置** | [DailyReportContext.jsx:44](file:///e:/RT-Pmis-Supervision-1/src/pages/DailyReport/DailyReportContext.jsx#L44), [Analytics.jsx:55](file:///e:/RT-Pmis-Supervision-1/src/pages/Analytics.jsx#L55), [DiaryJournal.jsx:222](file:///e:/RT-Pmis-Supervision-1/src/pages/DiaryJournal.jsx#L222) |
| **發現方式** | 自動化審計（SELECT 欄位不存在） |
| **問題** | `daily_logs` Schema（[supabase_schema_phase4.sql:7-18](file:///e:/RT-Pmis-Supervision-1/supabase_schema_phase4.sql#L7-L18)）只有 `weather_am, weather_pm, work_items, notes`。但 DailyReportContext、Analytics、DiaryJournal 均 SELECT `planned_progress, actual_progress`。 |
| **影響** | 進度資料始終為 null（Supabase 靜默返回 null 而非報錯）。列印報表進度欄顯示 0%。 |

**修正方案**：
```sql
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS planned_progress NUMERIC;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS actual_progress NUMERIC;
```

---

### Bug M2 — `Quality.jsx` Tab 2 刪除操作指向錯誤的 table

| 位置 | [Quality.jsx:232-244](file:///e:/RT-Pmis-Supervision-1/src/pages/Quality.jsx#L232-L244) |
|------|------|
| **問題** | `deleteSelected()` 只判斷 tab 0 和 else。Tab 2 的 mcs_test 刪除會錯誤地從 quality_issues 刪除。 |

---

### Bug M3 — `Quality.jsx` Tab 2 `commitEdit` 不更新 tests state

| 位置 | [Quality.jsx:217-228](file:///e:/RT-Pmis-Supervision-1/src/pages/Quality.jsx#L217-L228) |
|------|------|
| **問題** | DB 更新成功但 UI state 不反映。 |

---

### Bug M4 — `MaterialControl.jsx` `scheduleDbUpdate` 閉包陷阱

| 位置 | [MaterialControl.jsx:221-231](file:///e:/RT-Pmis-Supervision-1/src/pages/MaterialControl.jsx#L221-L231) |
|------|------|
| **問題** | setTimeout 中的 `dbTable` 會在 tab 切換後捕獲錯誤值。 |

---

### Bug M5 — `Submission.jsx` 相同閉包陷阱

| 位置 | [Submission.jsx:199-209](file:///e:/RT-Pmis-Supervision-1/src/pages/Submission.jsx#L199-L209) |

---

### Bug M6 — `ProgressManagement.jsx` 差異值不一致

| 位置 | [ProgressManagement.jsx:234](file:///e:/RT-Pmis-Supervision-1/src/pages/ProgressManagement.jsx#L234) |
|------|------|
| **問題** | 表格用 DB 的 `planned_progress`，S-Curve 用 `calcPlanned()`，兩者數字不同。 |

---

### Bug M7 — `ReportReminderBanner` 讀取 `supervision_reports` 永遠回空

| 位置 | [ReportReminderBanner.jsx:29](file:///e:/RT-Pmis-Supervision-1/src/components/ReportReminderBanner.jsx#L29) |
|------|------|
| **問題** | 表存在但系統中無任何頁面寫入此表。Banner 永遠視為「已提送」→ 緊急提醒永不觸發。 |

---

### Bug M8 — `DailyReportList.jsx` 缺報天數硬編碼為 0

| 位置 | [DailyReportList.jsx:22](file:///e:/RT-Pmis-Supervision-1/src/pages/DailyReport/DailyReportList.jsx#L22) |

---

### Bug M9 — `DiaryPrintView.jsx` 工程編號硬編碼 + loading 未重設

| 位置 | [DiaryPrintView.jsx:89](file:///e:/RT-Pmis-Supervision-1/src/pages/DiaryPrintView.jsx#L89), [DiaryPrintView.jsx:25-35](file:///e:/RT-Pmis-Supervision-1/src/pages/DiaryPrintView.jsx#L25-L35) |
|------|------|
| **問題** | ① 工程編號硬編碼「(尚未編號)」。② 查詢錯誤時只 setError 但不 setLoading(false) → 永遠 loading。 |

---

### Bug M10 — `DiaryPrintView.jsx` work_items 分割邏輯

| 位置 | [DiaryPrintView.jsx:148](file:///e:/RT-Pmis-Supervision-1/src/pages/DiaryPrintView.jsx#L148) |
|------|------|
| **問題** | `line.split(/[： ]/)` 會在空格處過度分割多字工項名稱。 |

---

### Bug M11 — `DiaryImportModal` 不寫入 `planned/actual_progress` 至 `daily_logs`

| 位置 | [DiaryImportModal.jsx:308-318](file:///e:/RT-Pmis-Supervision-1/src/components/DiaryImportModal.jsx#L308-L318) |
|------|------|
| **問題** | PDF 解析成功取得 `planned_progress` 和 `actual_progress`，但 insert payload（L310-316）有寫入這兩個欄位。然而若 Bug M1 未修正（daily_logs 缺這兩列），寫入會靜默被忽略。此 Bug 與 M1 聯動。 |

---

## 🟢 Minor — UX / 安全（14 個）

---

### Bug m1 — `Quality.jsx` Tab 切換不重設 testFilter
[Quality.jsx:323](file:///e:/RT-Pmis-Supervision-1/src/pages/Quality.jsx#L323)

### Bug m2 — `ScheduleImportModal` 步驟分隔符硬編碼 `idx < 2`
[ScheduleImportModal.jsx:241](file:///e:/RT-Pmis-Supervision-1/src/components/ScheduleImportModal.jsx#L241)

### Bug m3 — `AddProjectModal` + `EditProjectModal` 預算 input 格式化/輸入衝突
[AddProjectModal.jsx:129](file:///e:/RT-Pmis-Supervision-1/src/components/AddProjectModal.jsx#L129)

### Bug m4 — `DiaryImportModal` 下午天氣排除同值
[DiaryImportModal.jsx:139](file:///e:/RT-Pmis-Supervision-1/src/components/DiaryImportModal.jsx#L139)

### Bug m5 — `DailyReportContext` toFixed null guard
[DailyReportContext.jsx:17-18](file:///e:/RT-Pmis-Supervision-1/src/pages/DailyReport/DailyReportContext.jsx#L17-L18)

### Bug m6 — `useProjects.js` toFixed null guard
[useProjects.js:43-44](file:///e:/RT-Pmis-Supervision-1/src/hooks/useProjects.js#L43-L44)

### Bug m7 — `DailyReportView.jsx` NaN guard
[DailyReportView.jsx:23](file:///e:/RT-Pmis-Supervision-1/src/pages/DailyReport/DailyReportView.jsx#L23)

### Bug m8 — `utils.jsx` C.sidebar 未使用
[utils.jsx:12](file:///e:/RT-Pmis-Supervision-1/src/pages/DailyReport/utils.jsx#L12)

### Bug m9 — `body` CSS 重複定義
[index.css:94-122](file:///e:/RT-Pmis-Supervision-1/src/index.css#L94-L122)

### Bug m10 — 缺少全域 Error Boundary
App.jsx

### Bug m11 — `xlsx` 套件安全漏洞 (CVE-2023-30533)

### Bug m12 — `Submission.jsx` 歸檔 `sort_order` 小數可能破壞排序
[Submission.jsx:140](file:///e:/RT-Pmis-Supervision-1/src/pages/Submission.jsx#L140) — `sort_order: rows.length` 但 Archive 進版時用 `sort_order + 0.5`

### Bug m13 — `DiaryPrintView.jsx` ROC 年份轉換未處理無效日期
[DiaryPrintView.jsx:52](file:///e:/RT-Pmis-Supervision-1/src/pages/DiaryPrintView.jsx#L52) — 若 `log.log_date` 為 null，`new Date(null)` 會是 epoch

### Bug m14 — `ProjectDashboard.jsx` status badge 未覆蓋新狀態
[ProjectDashboard.jsx:478](file:///e:/RT-Pmis-Supervision-1/src/pages/ProjectDashboard.jsx#L478) — 允許設定 `pending/accepted` 但未在 badge 邏輯對應顯示

---

## Schema Migration 需求（修正前必須先執行）

```sql
-- 1. projects 表補齊欄位和約束
ALTER TABLE projects ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('pending', 'active', 'completed', 'accepted', 'suspended'));

-- 2. daily_logs 表補齊進度欄位
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS planned_progress NUMERIC;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS actual_progress NUMERIC;

-- 3. 確認以下表已存在（可能已在 Supabase Dashboard 建立，不在 SQL 檔案中）
-- daily_report_items: 用於 7 個頁面/元件
-- schedule_items: 用於 ProgressManagement + ScheduleImportModal
```

---

## 完整修正檔案清單

| 檔案 | Bug | 優先 |
|------|-----|------|
| **SQL Migration** | C5, M1 | 🔴 先執行 |
| MaterialControl.jsx | C1 | 🔴 |
| Analytics.jsx | C2, C3 | 🔴 |
| Dashboard.jsx | C3 | 🔴 |
| ProjectDashboard.jsx | C3 | 🔴 |
| PhotoTable.jsx | C4 | 🔴 |
| Archive.jsx | C4 | 🔴 |
| AddProjectModal.jsx | m3 | 🟡 |
| EditProjectModal.jsx | m3 | 🟡 |
| Quality.jsx | M2, M3, m1 | 🟡 |
| Submission.jsx | M5 | 🟡 |
| ProgressManagement.jsx | M6 | 🟡 |
| ReportReminderBanner.jsx | M7 | 🟡 |
| DailyReportList.jsx | M8 | 🟡 |
| DiaryPrintView.jsx | M9, M10, m13 | 🟡 |
| DiaryImportModal.jsx | m4 | 🟢 |
| DailyReportContext.jsx | m5 | 🟢 |
| useProjects.js | m6 | 🟢 |
| DailyReportView.jsx | m7 | 🟢 |
| index.css | m9 | 🟢 |
| App.jsx + ErrorBoundary.jsx | m10 | 🟢 |

---

## 自動化審計結果（原始輸出）

### 表名比對結果
| 表名 | 是否存在於 SQL | 狀態 |
|------|----------------|------|
| archive_docs | ✅ | OK |
| construction_inspections | ✅ | OK |
| daily_logs | ✅ | OK（但缺欄位） |
| **daily_report_items** | ❌ 不在 SQL 中 | 可能已在 Dashboard 建立 |
| material_entries | ✅ | OK |
| mcs_plan | ✅ | OK |
| mcs_submission | ✅ | OK |
| mcs_test | ✅ | OK |
| **progress_items** | ❌ 不在 SQL 中 | **確認為 Bug (C2)** |
| progress_records | ✅ | OK |
| projects | ✅ | OK（但缺欄位） |
| quality_issues | ✅ | OK |
| **schedule_items** | ❌ 不在 SQL 中 | 可能已在 Dashboard 建立 |
| **submissions** | ❌ 不在 SQL 中 | **確認為 Bug (C3)** |
| supervision_reports | ✅ | OK（但無寫入端） |

### 欄位型別掃描（DATE 型別 vs 空字串賦值）
| 檔案 | 行號 | 欄位 | 嚴重度 |
|------|------|------|--------|
| MaterialControl.jsx | 164 | `entry_date: ''` → DATE | 🔴 **阻斷** |
| AddProjectModal.jsx | 12 | `start_date: ''` (form default) | ✅ submit 時已轉 null |
| AddProjectModal.jsx | 13 | `end_date: ''` (form default) | ✅ submit 時已轉 null |
| Quality.jsx | 46 | `deadline: ''` (form default) | ✅ submit 時已轉 null |

---

## Verification Plan

### 修正前必須執行
1. 執行 Schema Migration SQL
2. 確認 `daily_report_items` 和 `schedule_items` 表在 Supabase 中存在

### 修正後驗證
1. `npm run build` — 確認無編譯錯誤
2. 逐頁功能測試：
   - 新增工程（含 Drive ID、各種 status）
   - 材料管制 → 新增記錄（Tab 0 + Tab 1）
   - 統計分析 → 6 個 tab 有資料
   - 品管管理 → Tab 2 增刪改
   - 照片 → 歸檔 → Archive 分類可見
   - 進度管理 → 差異值一致
   - 列印報表 → 工項名稱完整、進度非 0
   - 首頁 Dashboard → 警示正確
