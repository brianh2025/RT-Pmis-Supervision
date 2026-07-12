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

- 九大模組全數上線，完成度 90–100%（模組基準見 `/pmis-maintenance`）
- Drive 同步 Edge Function 目前為 v54（故障模式與除錯見 `/drive-sync-debug`）
- 歷史開發明細一律記錄於 `docs/CHANGELOG.md`，不在本檔累積

### 待辦
- 送審自動歸檔 workflow、歸檔進版按鈕（低優先，每季評估）
- 其餘依使用回饋再安排

## 專案文件（docs/）
- `docs/arch-index.md`：架構索引（路由、頁面、元件、資料表、Edge Functions），由 `/arch-index` 產生
- `docs/design.md`：設計系統規範（token 對照、字階使用場合、雙主題驗證、動效原則）
- `docs/CHANGELOG.md`：開發歷程記錄（依日期批次）
