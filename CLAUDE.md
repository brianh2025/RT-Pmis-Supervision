# RT-PMIS — Claude 工作規則

## 專案背景
雲林縣公共工程監造管理系統，React 19 + Vite 8 + Supabase。
GitHub（主要 origin）：https://github.com/brianh2025/RT-Pmis-Supervision
GitLab（備援，push 自動同步）：https://gitlab.com/BrianH3/rt-pmis-supervison
主要工作分支：`main`（`預覽版本v1` 已合併）。

## 語言
- 所有對話、commit message、程式碼註解：**繁體中文**

## 程式碼規範
- 框架：React（JSX），不使用 TypeScript
- 樣式：獨立 `.css` 檔，不使用 Tailwind / CSS-in-JS
- 不加不必要的 docstring、console.log、錯誤處理（除非明確要求）
- 不自行加功能、不重構未被要求修改的程式碼

## UI / 版面（每次修改 UI 時強制套用）
- 文字與區塊必須視覺對齊，力求視覺平衡
- 消除無意義空白；可同列的元素不換行
- 版面嚴禁貼著視窗邊線
- **新版本不得省略舊版本任何內容**（最重要規則）

## 部署方式
- **所有修改直接推送 `main` 分支**，不建立 feature branch、不開 PR
- Vercel 自動從 main 部署到 production，無需預覽流程

## 工作紀律
- 嘗試失敗 3 次後停止，擬定方案再繼續
- 重複作業達 5 次須告知使用者並等待指示

## 專案 Skill 一覽（.claude/skills/）
- `/arch-index`：掃描專案產生架構索引至 `docs/arch-index.md`，新增/刪除頁面元件後更新
- `/pmis-maintenance`：週測、月更新、季健檢、發版前檢查清單
- `/pmis-deploy`：部署流程（lint + build 驗證 → push main → Vercel 確認）
- `/drive-sync-debug`：Drive 同步除錯協議（sync-diary 架構、檔名日期格式、故障模式）
- `/ui-rules`：UI 版面規範與設計 token 紀律（修改 UI 時自動套用）
- `/screenshot-interpretation`：截圖標註解讀協議（收到標註截圖時套用）
- `supabase-postgres-best-practices`：Postgres 最佳實務（外部 skill，經 skills-lock.json 管理）

## 維護週期
詳細清單執行 `/pmis-maintenance`。
- 每週一：功能迴歸測試
- 每月：`npm outdated` + `npm audit` + `npm update` + `npm run build`
- 每季：Supabase SQL 健檢 + 程式碼安全稽核
- 發版前：完整清單

## 建置基準（2026-07-12 更新）
- JS 主 chunk: ~344 KB（gzip ~101 KB）— React.lazy code splitting
- recharts chunk: ~341 KB（gzip ~101 KB）
- pdfjs chunk: ~410 KB（gzip ~122 KB）
- ExcelJS chunk: ~933 KB（gzip ~258 KB）
- CSS 總計: ~184 KB
- 建置時間: ~1 s
- Lint: 0 誤報（剩餘 react-refresh only-export-components 與 react-hooks 類提示為已知可接受）
- 煙霧測試: `npm run build && npm run test:smoke`（12 項：11 個受保護頁面渲染 + 未登入防護）

## 已知技術債
（無 xlsx CVE，已於 2026-04-25 完成 exceljs 遷移）

## 目前開發狀態（2026-07-12 更新）

### 近期完成功能
- **施工抽查單**：填寫介面、照片 Drive 資料夾重構、列印格式、儲存至管制表（自動計算整體結果寫入 `construction_inspections`）
- **施工日誌整合**：一鍵建立抽查 + 材料進場 Modal；五組功能整合（subtitle 持久化、抽查導入照片、材料完成狀態、PDF 定項）
- **PDF 匯入**：修正每字獨立問題（compactText）、合併同列相鄰 item、加寬標題識別、支援西元年日期格式、本地化 pdfjs CMap 路徑
- **監造報表**：新增月報稽核 Tab
- **照片記錄**：編輯頁改為雙欄並排，照片預覽放大至中線
- **Topbar**：返回按鈕改為純箭頭、移除重複按鈕（說明、匯入、登出）、移除監造人員顯示
- **Sidebar**：修正天氣圖示重複與未登入顯示錯誤
- **訊息橫幅**：改為天氣 + 施工狀況情境輪播（串接 Open-Meteo API）
- **Drive 同步**：修正施工日誌在子資料夾時無法找到檔案的問題（getDiaryFolderId 改用 listFolderChildren）
- **抽查單 UI**：配色對齊設計系統 token、深色主題表頭可見性修正、標題欄防重疊、手寫字型套用
- **查驗任務看板**：ProjectDashboard Bento Grid 已有完整燈號任務清單（urgent/warning），涵蓋：施工日誌缺填、品管缺失未結案、送審待處理、進度落後、工期倒數、施工檢驗不合格/待複驗、材料未回填、施工項目未查驗；Dashboard 亦有跨工程彙總
- **完成度追蹤（部分）**：ProjectDashboard 已顯示「施工項目未查驗 N 項」（從 daily_report_items 比對 construction_inspections）
- **試驗報告管制（部分）**：Quality.jsx Tab 2 有試驗報告管制表（mcs_test），可編輯欄位

### 基礎建設
- Git remote 從 GitHub 遷移至 GitLab
- 移除 `.agents`、`.continue`、`.trae` 等其他 AI 工具暫存目錄
- Open-Meteo API 網域加入允許清單

### 近期完成（2026-05-14 補充）
- **試驗報告連動**：material_entries 判定合格前檢查 mcs_test 判讀結果，不合格阻擋、未填寫警告
- **廠商查驗申請**：material_entries.result 新增「待查驗」狀態，Dashboard 顯示待查驗件數燈號
- **完成度追蹤深化**：施工項目改為查驗次數 vs 施工天數比例（每3天至少1次），chip 顯示明細
- **手機現場一條龍**：Quality 手機版 FAB → 快速填工項+部位+結果 → 不合格自動建缺失單 → 直達拍照
- **推播式任務驅動**：所有儀表板任務附期限日期，逾期自動從 warning 升級為 urgent

### 近期完成（2026-05-19 補充）
- **Drive 同步 v35**：修正單日選擇卻跑全量檔案（109 個）的過濾 bug；支援連續日期檔名（施工日誌-1150508-1150511）日期重疊篩選；parseDateFromFileName 加入格式 4 向後相容非標準命名；readAllDiarySheets 加入 inline string 偵測（相容部分廠商 xlsx）；BOILERPLATE 加入第N號明細表過濾；工項解析跳過總價式比例值
- **DriveSyncModal UX**：同步中監聽 beforeunload 防意外離頁；overlay 點擊若正在同步則不關閉 Modal

### 近期完成（2026-07-12 補充，涵蓋 5/20–7/10 共 49 個 commit）
- **Drive 同步 v36→v54**：v44 修跨表欄位錯位解析出非施工項；v47 修 notes 誤帶工項名稱；v49 監造報表顯示一致、清除殘留工項、天氣偵測修正；v50 同底稿名 xlsm 優先於 xlsx；v51+v52 結構性修正工項表抓取範圍防財務欄誤判；v53 進度欄位皆空不寫 0 值 progress_records；v54 開工日下限防護（早於 start_date 一律跳過，防標單/明細表誤判成日誌）
- **品質/檢驗管制**：依施工日誌自動羅列待建立查驗項（排除非查驗性記事）；檢驗記錄強化（類型二選一、不合格處置、PDF 辨識匯入）；敘述式工項拆解（位置/部位自動分離、每項活動獨立一列）；管制表雙擊編輯失焦修正、單筆刪除鈕、欄寬多輪調整
- **施工抽查單**：支援匯入掃描版 PDF 辨識自動填入、Excel 匯入；「前往抽查」帶入機制（自動開啟抽查單並預填待查驗工項）；列印格式多輪調整（標楷體/Noto Serif TC、欄寬百分比、表頭斷字修正）；修正無法編輯與刪除
- **照片記錄**：新增 Google Drive 匯入（資料夾瀏覽器、自動帶入日期與工項、E0-1/E0-2 類別判斷）；雲端相簿唯讀瀏覽 + 日期條列模式 + 大按鈕介面；Drive 上傳改用工程專屬資料夾；瀏覽記憶每工程資料夾位置、支援民國日期資料夾
- **日誌 PDF 匯入**：重構支援跨頁監造報表並修正欄位錯位；NFKC 正規化修復相容區「年」字；敘述式工項拆解至 daily_report_items；偵測掃描版（純圖片）PDF 並提供 OCR 建議；匯入成功後自動跳至該月份
- **進度/分析**：修正 S 曲線斷線與摔 0、日誌進度曲線尖刺，全站進度 null 處理清查；預定進度改為儲存值優先、計算值備援；進度頁垂直間距收緊與標題對齊修正
- **送審管制**：新增匯入管制總表 PDF 辨識填入
- **Dashboard/UI**：全系統設計語言升級（色彩、導航、按鈕、任務看板）；天氣輪播與待辦彙總整合為今日簡報卡；修正施工項目查驗不足提醒與工項不符
- **維護**：2026-06-06 月度套件安全更新；uuid overrides 消除 exceljs 間接漏洞；清除機械性 lint 錯誤並修復 DiaryLog project 未定義 bug

### 待辦
（目前無明確待辦，依使用回饋再安排）
