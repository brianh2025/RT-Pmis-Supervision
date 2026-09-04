---
name: RT-PMIS 架構索引
description: 專案完整檔案結構、頁面/元件用途、路由表、資料表、CSS 分布、Edge Functions、環境變數一覽，維護時直接查詢，避免重複翻找檔案
updated: 2026-09-04
---

# RT-PMIS 架構索引

## 1. 路由表

路由結構（`src/App.jsx`）分兩層：頂層路由 + 巢狀於 `ProjectLayout` 之下的 `/projects/:id/*` 專案路由。所有 `/projects/:id/*` 與 `/dashboard` 皆包在 `ProtectedRoute` 內；頁面採 `React.lazy` 動態載入。

| URL slug | 元件檔 |
|---|---|
| `/` | Navbar + Hero + Footer（WelcomePage） |
| `/login` | `src/pages/Login.jsx` |
| `/dashboard` | `src/pages/Dashboard.jsx` |
| `/check` | `src/pages/ReportCheck.jsx` |
| `/projects/:id`（導向 dashboard） | `src/components/ProjectLayout.jsx` |
| `/projects/:id/dashboard` | `src/pages/ProjectDashboard.jsx` |
| `/projects/:id/supervision` | `src/pages/DiaryLog.jsx` |
| `/projects/:id/supervision/print/:logDate` | `src/pages/DiaryPrintView.jsx` |
| `/projects/:id/progress` | `src/pages/ProgressManagement.jsx` |
| `/projects/:id/material` | `src/pages/MaterialControl.jsx` |
| `/projects/:id/submission` | `src/pages/Submission.jsx` |
| `/projects/:id/quality` | `src/pages/Quality.jsx` |
| `/projects/:id/archive` | `src/pages/Archive.jsx` |
| `/projects/:id/analytics` | `src/pages/Analytics.jsx` |
| `/projects/:id/photos` | `src/pages/PhotoTable.jsx` |
| `/projects/:id/journal` | `src/pages/DiaryJournal.jsx` |
| `*` | 導回 `/` |

## 2. Pages 一覽

| 路由 slug | 檔名 | 功能說明 |
|---|---|---|
| `/login` | `Login.jsx` | 登入頁 |
| `/dashboard` | `Dashboard.jsx` | 全域工程總覽（工程卡片、拖曳排序、Excel 匯入、今日簡報卡） |
| `/check` | `ReportCheck.jsx` | 跨工程提送管制（施工日誌建檔缺漏檢核、監造月報提送/發文狀態，單月檢核＋年度總表） |
| `dashboard` | `ProjectDashboard.jsx` | 單一專案儀表板（Bento Grid 任務燈號、彙整各表統計） |
| `supervision` | `DiaryLog.jsx` | 監造/施工日誌列表與編輯 |
| `supervision/print/:logDate` | `DiaryPrintView.jsx` | 單日日誌列印檢視 |
| `progress` | `ProgressManagement.jsx` | 進度管理（實際/預定進度、S 曲線、排程項） |
| `material` | `MaterialControl.jsx` | 材料管制（進場、檢試驗 mcs_test） |
| `submission` | `Submission.jsx` | 材料設備送審管制（mcs_submission） |
| `quality` | `Quality.jsx` | 品質管理（施工抽查、缺失追蹤、手機 FAB） |
| `archive` | `Archive.jsx` | 檔案歸檔（archive_docs） |
| `analytics` | `Analytics.jsx` | 統計分析（跨表彙整圖表） |
| `photos` | `PhotoTable.jsx` | 施工照片表（Drive 照片、白板 OCR） |
| `journal` | `DiaryJournal.jsx` | 施工日誌彙編/產生（跨表匯出） |

## 3. Components 一覽

| 元件 | 用途 |
|---|---|
| `AddProjectModal.jsx` | 新增工程專案 Modal（寫入 projects） |
| `EditProjectModal.jsx` | 編輯專案 Modal（含鎖定/連結） |
| `CardContextMenu.jsx` | 工程卡片右鍵選單（加星號、刪除） |
| `DriveSyncModal.jsx` | 觸發 sync-diary Edge Function 從 Google Drive 同步日誌 |
| `DiaryImportModal.jsx` | 施工日誌 PDF 匯入解析（pdfjs，寫入 daily_logs/items/progress） |
| `EmergencyStopModal.jsx` | 緊急停工登錄 Modal（daily_logs/quality_issues） |
| `ExcelImportModal.jsx` | 專案 Excel 批次匯入（ExcelJS，寫入 projects） |
| `ProgressExcelImportModal.jsx` | 進度 Excel 匯入（寫入 progress_records） |
| `ScheduleImportModal.jsx` | 排程 Excel 匯入（寫入 schedule_items） |
| `ProgressFormModal.jsx` | 單筆進度記錄新增/編輯 Modal |
| `InspectionFormModal.jsx` | 施工抽查紀錄表填寫 Modal（含 PDF OCR、Drive 上傳、列印） |
| `InspectionImportModal.jsx` | 施工抽查 Excel 匯入（construction_inspections） |
| `InspectionQuickModal.jsx` | 快速施工抽查登錄 Modal |
| `MaterialInspectionModal.jsx` | 材料進場抽查紀錄表 Modal（material_entries/mcs_test） |
| `PlanItemModal.jsx` | 監造計畫定項 Modal（submission 表5.3-1／test 表5.3-4） |
| `QuickDiaryModal.jsx` | 快速施工日誌登錄 Modal（含天氣） |
| `ReportReminderBanner.jsx` | 監造報表繳交提醒橫幅（supervision_reports） |
| `ProjectLayout.jsx` | 專案內頁版面框架（Sidebar + Topbar + Outlet + HelpModal） |
| `Sidebar.jsx` | 專案側邊導覽選單 |
| `Topbar.jsx` | 頂部列（返回列、漢堡鍵、Excel 匯入、登出、說明） |
| `Navbar.jsx` | 首頁導覽列（含深色模式切換） |
| `Hero.jsx` | 首頁主視覺（含進入按鈕、ParticleCanvas） |
| `Footer.jsx` | 頁尾 |
| `ParticleCanvas.jsx` | 首頁粒子動畫背景（canvas） |
| `InfoTicker.jsx` | 輪播資訊條（可關閉） |
| `TutorialModals.jsx` | 教學/使用說明彈窗（WelcomeModal、HelpModal） |
| `ProtectedRoute.jsx` | 未登入導向 /login 的路由守衛 |
| `ErrorBoundary.jsx` | React 錯誤邊界（class component） |

## 4. DailyReport 子模組（src/pages/DailyReport/）

| 檔案 | 用途 |
|---|---|
| `DailyReportContext.jsx` | 日報資料 Context：從 daily_logs／daily_report_items／progress_records／construction_inspections／material_entries 讀取並用 `buildReport()` 組成 Form 相容物件，含儲存邏輯 |
| `DailyReportForm.jsx` | 日報填寫表單（天氣、進度、工項明細等欄位） |
| `DailyReportView.jsx` | 日報唯讀檢視（Card/Badge/ProgressBar 呈現、備註清理） |
| `utils.jsx` | 共用 UI 元件與常數：品牌色 `C`、圖示 `I`、`Card`/`SH`/`Badge`/`ProgressBar`/`weatherIcon`、`WEATHER_OPTIONS`/`DOC_TYPES`/`today` |

## 5. Hooks / Context / Lib / Config / Utils

### src/hooks/
| 檔案 | 用途 |
|---|---|
| `useProjects.js` | 讀取所有專案 + 各自最新進度記錄，回傳 `{ projects, loading, error, refresh }` |
| `useProject.js` | 讀取單一專案 + 最新進度記錄，回傳 `{ project, loading, error }` |
| `useReportReminder.js` | 依當月日期計算監造報表提醒，查 supervision_reports 回傳 banner |
| `useAutoHideScrollbar.js` | 捲動時加 `.scrolling` class，停止 1500ms 後移除（逾時隱藏卷軸） |

### src/context/ 與 src/contexts/
| 檔案 | 用途 |
|---|---|
| `context/AuthContext.jsx` | 認證 Provider，經 `useAuth()` 提供 user 與登入狀態（Supabase Auth） |
| `contexts/ThemeContext.jsx` | 深色/淺色主題 Provider，經 `useTheme()`；預設深色、存 localStorage `theme` |

註：專案同時存在 `context/`（單數，Auth）與 `contexts/`（複數，Theme）兩個目錄。

### src/lib/
| 檔案 | 用途 |
|---|---|
| `supabaseClient.js` | 建立並匯出 supabase client（persistSession/autoRefresh）；缺環境變數時拋錯 |

### src/config/
| 檔案 | 用途 |
|---|---|
| `helpContent.js` | 各頁面「使用說明」彈窗內容（`HELP_CONTENT`） |
| `inspectionFormTemplates.js` | 各工項施工抽查紀錄表模板（表7.3-17~7.3-30，code/label/items） |

### src/utils/
| 檔案 | 用途 |
|---|---|
| `format.js` | `fmtPct()` 百分比格式化（避免非零值四捨五入成 0%） |
| `inspectionOcr.js` | 施工抽查掃描檔辨識管線（PDF→圖→Google Vision OCR→座標式表格解析） |
| `parseSubmissionMasterPdf.js` | 解析監造計畫「表5.3-1 材料設備送審管制總表」PDF（pdfjs 文字層座標） |
| `uploadPdfToDrive.js` | 監造計畫 PDF 上傳 Google Drive（getOrCreateFolder + 上傳） |

其他：`main.jsx` 為進入點（掛載 App、匯入 `index.css`）；`tests/smoke.mjs` 為 `npm run test:smoke` 煙霧測試。

## 6. CSS 檔案分布

### 全域
| 檔案 | 範圍 |
|---|---|
| `src/index.css` | 全域樣式（由 `main.jsx` 匯入，設計系統 token、雙主題、utility；token 說明見 `docs/design.md`） |
| `src/App.css` | App 層級樣式 |

### 共用元件樣式
| 檔案 | 共用範圍 |
|---|---|
| `components/Modal.css` | **全體 Modal 共用**（AddProject/EditProject/DriveSync/DiaryImport/EmergencyStop/InspectionQuick/ProgressForm/ProgressExcelImport/ScheduleImport/QuickDiary 等） |
| `components/ProjectLayout.css` | ProjectLayout（含 Sidebar/Topbar 版面）共用 |
| `components/InspectionFormModal.css` | 施工抽查表 Modal 專用（覆蓋通用 Modal.css） |
| `components/MaterialInspectionModal.css` | 材料進場抽查 Modal 專用 |
| `components/Navbar.css`、`Hero.css`、`Footer.css`、`InfoTicker.css`、`CardContextMenu.css`、`TutorialModals.css`、`ReportReminderBanner.css` | 各自對應同名元件 |

### 頁面專用樣式
`pages/` 下：`Login.css`、`Dashboard.css`、`ReportCheck.css`、`ProjectDashboard.css`、`DiaryLog.css`、`DiaryJournal.css`、`DiaryPrintView.css`、`MaterialControl.css`、`PhotoTable.css` — 各自對應同名頁面。

其餘頁面（Analytics/Archive/Quality/Submission/ProgressManagement）與 DailyReport 子模組主要採 inline styles + `utils.jsx` 的 `C` 色票，無獨立 CSS 檔。

## 7. 主要資料表（Supabase，共 13 張）

```
projects                    專案主檔
├─ progress_records         進度記錄（S 曲線）
├─ schedule_items           排程項（預定進度）
├─ daily_logs               施工/監造日誌
│  └─ daily_report_items    日誌工項明細
├─ supervision_reports      監造報表（月報）
├─ construction_inspections 施工抽查紀錄
├─ quality_issues           品管缺失
├─ material_entries         材料進場
├─ mcs_test                 檢試驗管制（表5.3-4）
├─ mcs_submission           送審管制（表5.3-1）
├─ mcs_plan                 施工計畫管制
└─ archive_docs             歸檔文件
```

| 資料表 | 主要使用位置 |
|---|---|
| `projects` | useProjects、useProject、Dashboard、Add/EditProjectModal、ExcelImportModal、ProjectDashboard、DiaryPrintView |
| `daily_logs` | ReportCheck、DiaryLog、DiaryJournal、ProjectDashboard、Analytics、DailyReportContext、QuickDiaryModal、EmergencyStopModal、DiaryImportModal、DiaryPrintView |
| `daily_report_items` | DiaryLog、DiaryJournal、DailyReportContext、Dashboard、Quality、DiaryImportModal |
| `progress_records` | ProgressManagement、Analytics、DailyReportContext、DiaryJournal、ProjectDashboard、ProgressFormModal、ProgressExcelImportModal、DiaryImportModal |
| `schedule_items` | ProgressManagement、DiaryJournal、ScheduleImportModal |
| `supervision_reports` | DiaryLog、Dashboard、ReportCheck、useReportReminder、ReportReminderBanner |
| `construction_inspections` | Quality、MaterialControl、Analytics、DiaryJournal、ProjectDashboard、DailyReportContext、InspectionFormModal、InspectionImportModal、InspectionQuickModal |
| `quality_issues` | Quality、MaterialControl、Analytics、ProjectDashboard、Dashboard、EmergencyStopModal、InspectionQuickModal |
| `material_entries` | MaterialControl、DailyReportContext、DiaryJournal、ProjectDashboard、Dashboard、Quality、MaterialInspectionModal |
| `mcs_test` | MaterialControl、Quality、DiaryJournal、ProjectDashboard、MaterialInspectionModal |
| `mcs_submission` | Submission、Analytics、ProjectDashboard、Dashboard |
| `mcs_plan` | ProjectDashboard |
| `archive_docs` | Archive、PhotoTable、MaterialControl、Submission、Quality、DiaryJournal、ProjectDashboard、InspectionFormModal |

## 8. Edge Functions（supabase/functions/）

| 函式 | 版本 | 用途 |
|---|---|---|
| `sync-diary/index.ts` | v54 | 從 Google Drive 同步施工日誌/監造報表 Excel（fflate + 手寫 XML 解析，支援多工作表、多 block 垂直並列、民國/西元日期解析、檔名日期解析）。v54：解析日期早於 `projects.start_date` 一律跳過；v53：進度全空的日誌不寫 0 值 progress_records |
| `whiteboard-ocr/index.ts` | 無版本號 | 呼叫 Claude Vision API（claude-haiku-4-5-20251001）辨識施工現場白板文字，回傳 work_item/location/date/description/category JSON |

## 9. 環境變數

### 前端（`import.meta.env.*`，.env.local）
| 變數 | 使用位置 |
|---|---|
| `VITE_SUPABASE_URL` | supabaseClient、DiaryJournal、DriveSyncModal |
| `VITE_SUPABASE_ANON_KEY` | supabaseClient、DiaryJournal、DriveSyncModal |
| `VITE_SYNC_SECRET` | DiaryJournal、DriveSyncModal |
| `VITE_GOOGLE_CLIENT_ID` | MaterialControl、Submission、PhotoTable、InspectionFormModal、MaterialInspectionModal |
| `VITE_GOOGLE_API_KEY` | Quality、PhotoTable、inspectionOcr、InspectionFormModal |
| `VITE_GOOGLE_DRIVE_FOLDER_ID` | PhotoTable、uploadPdfToDrive |
| `VITE_GOOGLE_DRIVE_INSPECTION_FOLDER_ID` | InspectionFormModal、MaterialInspectionModal |

### Edge Function secrets（`Deno.env.get()`）
| 變數 | 使用函式 |
|---|---|
| `SUPABASE_URL` | sync-diary |
| `SUPABASE_SERVICE_ROLE_KEY` | sync-diary |
| `SUPABASE_ANON_KEY` | sync-diary |
| `GOOGLE_SA_CLIENT_EMAIL` | sync-diary |
| `GOOGLE_SA_PRIVATE_KEY` | sync-diary |
| `SYNC_SECRET` | sync-diary |
| `ANTHROPIC_API_KEY` | whiteboard-ocr |

## 10. 建置 / 部署相關

| 檔案 | 說明 |
|---|---|
| `vite.config.js` | react plugin + `copy-pdfjs-assets` 自訂 plugin（建置時複製 pdfjs-dist 的 cmaps 與 standard_fonts 到 public/，供本地 CID 字型解碼）；optimizeDeps 排除 pdfjs-dist |
| `vercel.json` | SPA rewrite：所有路徑導向 `/index.html` |
| `package.json` scripts | `dev`、`build`、`lint`、`preview`、`test:smoke`（tests/smoke.mjs） |

## 11. Dependencies

### dependencies
`@supabase/supabase-js`、`exceljs`、`exifr`、`file-saver`、`lucide-react`、`pdfjs-dist`、`react`、`react-dom`、`react-router-dom`、`recharts`

### devDependencies
`@eslint/js`、`@types/react`、`@types/react-dom`、`@vitejs/plugin-react`、`eslint`、`eslint-plugin-react-hooks`、`eslint-plugin-react-refresh`、`globals`、`playwright`、`vite`

### overrides
`uuid`（^11.1.1，消除 exceljs 間接漏洞）
