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
- **新版本不得省略舊版本任何內容**（最重要規則）
- 其餘版面規範、設計 token 紀律、字級底線的單一事實來源：`/ui-rules` skill 與 `docs/design.md`，修改 UI 前必讀

## 部署方式
- 本機作業：**所有修改直接推送 `main` 分支**，不建立 feature branch、不開 PR
- 例外：雲端 session 被指定專用分支時，依 session 指示開分支與 PR（與 `/pmis-deploy` 一致）
- Vercel 自動從 main 部署到 production，無需預覽流程；完整流程見 `/pmis-deploy`

## 工作紀律
- 嘗試失敗 3 次後停止，擬定方案再繼續
- 重複作業達 5 次須告知使用者並等待指示

### 決斷與自主行動
- 資訊足夠即行動：不重推對話中已確認的事實、不重議使用者已定案的決策、不在回覆中陳述不會執行的選項
- 面臨抉擇時給出建議，而非窮舉式比較（思考過程不受此限）
- 自主運作時使用者不會即時回應：可逆且符合原始要求的行動直接執行，不問「要不要我…」
- 僅在以下情況停下詢問並結束回合：破壞性或不可逆動作、真正的範疇變更、只有使用者能提供的資訊
- 結束回合前檢查最後一段：若是計畫、分析、問題、待辦清單、或對未完成工作的承諾（「我會…」），立即用工具把它做完；僅在任務完成或被使用者輸入阻塞時才結束
- 不因 context 長度而中止、摘要、或建議開新 session

### 範圍紀律（不過度工程）
- 不加超出任務所需的功能、重構或抽象；修 bug 不順手清理周邊、一次性操作不寫 helper
- 不為假想的未來需求設計：做能良好運作的最簡方案，避免過早抽象與半成品實作
- 不為不可能發生的情境加錯誤處理、fallback 或驗證；信任內部程式碼與框架保證，只在系統邊界（使用者輸入、外部 API）驗證
- 能直接改程式碼就不用 feature flag 或向後相容墊片

### 回報與溝通
- 結論先行：完成後第一句話回答「發生了什麼／發現了什麼」，支撐細節與理由放在後面
- 可讀性優先於簡潔：縮短輸出靠取捨內容（捨去不影響讀者下一步行動的細節），不靠碎句、縮寫、箭頭鏈（A → B → 失敗）或行話
- 回報進度前，逐項核對本次 session 的工具結果：只回報有證據的工作；尚未驗證的明確說明；測試失敗要附輸出、跳過的步驟要說出來；完成且已驗證的直述不含糊
- 長時間自主工作後的總結，是使用者對這些工作的「第一眼」：以重新鋪陳脈絡的方式書寫，完整句子、攤開術語，不沿用工作過程中自創的簡稱與標號；提到檔案、commit、旗標時各自用白話交代
- 工具呼叫之間的簡短速記無妨，但最終總結要為沒看過過程的讀者而寫

### 判斷情境
- 使用者在描述問題、提問、或自言自語思考時，交付物是「評估分析」：回報發現後即停，未被要求前不動手修
- 執行會改變系統狀態的指令（重啟、刪除、改設定）前，確認證據確實支持該特定動作；貌似已知故障模式的訊號可能另有原因

### 委派與經驗紀錄
- 獨立子任務委派給 subagent 並行處理，同時繼續自己的工作；subagent 偏離方向或缺少關鍵脈絡時介入
- 經驗教訓存於 `.claude/lessons/`：一課一檔、檔首一行摘要；修正教訓與已確認可行的做法都記錄（含為何重要）；repo 或對話紀錄已有的不重複存；更新既有筆記而非另建重複；發現錯誤的筆記直接刪除

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
- 煙霧測試: `npm run build && npm run test:smoke`（13 項：12 個受保護頁面渲染 + 未登入防護）

## 已知技術債
（無 xlsx CVE，已於 2026-04-25 完成 exceljs 遷移）

## 目前開發狀態（2026-09-04 更新）

- 九大模組全數上線，完成度 90–100%（模組基準見 `/pmis-maintenance`）
- Drive 同步 Edge Function 目前為 v54（故障模式與除錯見 `/drive-sync-debug`）
- 2026-09-04 新增 `/check` 提送管制頁：跨工程檢核施工日誌建檔缺漏與監造月報提送／發文狀態（單月檢核＋年度總表），入口在總覽側邊欄
- 2026-07-13 完成五頁 UI 調整批次（總覽/儀表板/照片/進度/品質）；品質頁查驗改為依日誌自動建檔（刪除以 localStorage tombstone 防重建）；版面慣例見 `docs/design.md` 第 7 節
- 歷史開發明細一律記錄於 `docs/CHANGELOG.md`，不在本檔累積

### 待辦
- 送審自動歸檔 workflow、歸檔進版按鈕（低優先，每季評估）
- 其餘依使用回饋再安排

## 專案文件（docs/）
- `docs/arch-index.md`：架構索引（路由、頁面、元件、資料表、Edge Functions），由 `/arch-index` 產生
- `docs/design.md`：設計系統規範（token 對照、字階使用場合、雙主題驗證、動效原則）
- `docs/CHANGELOG.md`：開發歷程記錄（依日期批次）
