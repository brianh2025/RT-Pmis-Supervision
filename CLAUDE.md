# RT-PMIS — Claude 工作規則

## 專案背景
雲林縣公共工程監造管理系統，React 19 + Vite 8 + Supabase。
GitHub 帳號：brianh2025，repo 為 public。
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
