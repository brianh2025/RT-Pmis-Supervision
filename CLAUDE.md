# RT-PMIS — Claude 工作規則

## 專案背景
雲林縣公共工程監造管理系統，React 19 + Vite 8 + Supabase。
GitLab 帳號：BrianH3，repo URL：https://gitlab.com/BrianH3/rt-pmis-supervison
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

## 工作紀律
- 嘗試失敗 3 次後停止，擬定方案再繼續
- 重複作業達 5 次須告知使用者並等待指示

## 維護週期
詳細清單執行 `/pmis-maintenance`。
- 每週一：功能迴歸測試
- 每月：`npm outdated` + `npm audit` + `npm update` + `npm run build`
- 每季：Supabase SQL 健檢 + 程式碼安全稽核
- 發版前：完整清單

## 建置基準（2026-04-25 更新）
- JS 主 chunk: ~224 KB（gzip ~72 KB）— 已啟用 React.lazy code splitting
- ExcelJS chunk: ~933 KB（gzip ~258 KB）— xlsx 替換為 exceljs 後新增
- CSS bundle: ~117 KB（gzip ~20 KB）
- 建置時間: ~3 s
- Lint: 0 嚴重錯誤（剩餘為 react-refresh context 警告與 hooks 警告）

## 已知技術債
（無 xlsx CVE，已於 2026-04-25 完成 exceljs 遷移）

## 目前開發狀態（2026-05-14 更新）

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

### 待辦（優先順序）
1. 廠商查驗申請流程（材料/施工兩類，不合格自動轉缺失管制）
2. 推播式任務驅動（進度預警→自動產生查驗任務+期限+逾期升級）
3. 手機現場一條龍（拍照+勾選→自動生成抽查記錄，目前 Quality 只有行動版列表）
4. 完成度追蹤深化（每工項定義應做查驗次數，目前只做有/無判斷）
5. 試驗報告連動（材料查驗需報告判讀才結案的鎖定邏輯）
