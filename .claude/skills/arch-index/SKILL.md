---
name: arch-index
description: RT-PMIS 架構索引建立與更新。當使用者輸入 /arch-index、說「建立架構索引」、「更新架構索引」、「重建索引」，或在新增/刪除 pages 或 components 後說「更新索引」時觸發。將專案完整結構掃描後寫入 docs/arch-index.md，供後續對話直接查詢，避免每次修改都翻找檔案耗用 token。
allowed-tools: Glob, Grep, Read, Write, Edit, Agent
---

# RT-PMIS 架構索引建立協議

## 目的
掃描專案當前狀態，產生並覆寫 `docs/arch-index.md`（相對於專案根目錄），讓後續對話可直接查詢，不需重新翻找檔案。索引隨 repo 版本控管，本機與雲端 session 皆可使用。

## 執行步驟

### 1. 用 Explore agent 掃描（節省主 context）

以下列 prompt 啟動 Explore agent，要求 **very thorough** 掃描（路徑一律使用專案根目錄的相對路徑，禁止寫死絕對路徑）：

```
掃描本專案（當前工作目錄），產生架構索引。收集：
1. src/pages/ 所有 .jsx 檔 + 對應路由 slug（從 App.jsx 對照）
2. src/components/ 所有 .jsx 檔 + 一行用途描述
3. src/pages/DailyReport/ 子模組各檔用途
4. src/hooks/、src/context/、src/contexts/、src/lib/、src/config/、src/utils/ 各檔用途
5. src/ 下所有 .css 檔，備注共用範圍（如 Modal.css 全體共用）
6. Supabase 資料表名稱（從各 page 的 supabase.from() 呼叫收集）
7. supabase/functions/ 各 Edge Function 用途與版本號（檔頭註解）
8. package.json dependencies 名稱清單
9. 環境變數（從 import.meta.env. 與 Deno.env.get 出現的變數名收集）
回傳 markdown 格式，分區塊整理。
```

### 2. 覆寫索引檔案

將掃描結果格式化後，**覆寫**（不是追加）`docs/arch-index.md`。

frontmatter 固定為：
```markdown
---
name: RT-PMIS 架構索引
description: 專案完整檔案結構、頁面/元件用途、路由表、資料表、CSS 分布、Edge Functions、環境變數一覽，維護時直接查詢，避免重複翻找檔案
updated: YYYY-MM-DD
---
```

內容包含以下區塊（順序固定）：
1. **路由表** — URL slug → 元件檔對照
2. **Pages 一覽** — 路由 slug、檔名、一行功能說明
3. **Components 一覽** — 元件名、一行用途
4. **DailyReport 子模組**
5. **Hooks / Context / Lib / Config / Utils** — 路徑、用途
6. **CSS 檔案分布** — 標注共用範圍
7. **主要資料表（Supabase）** — 樹狀結構
8. **Edge Functions** — 名稱、版本、用途
9. **環境變數**（.env.local / Edge Function secrets）
10. **建置 / 部署相關**（vite.config.js、vercel.json）
11. **Dependencies**

### 3. 完成回報

回報：
- 掃描到的 pages 數量、components 數量、Edge Functions 版本
- 更新日期
- 一行提示：「下次維護可直接查詢 docs/arch-index.md，無需重新掃描」

## 注意事項

- 若 docs/arch-index.md 已存在，直接覆寫，不詢問確認
- 索引是快照，不需標注「可能過時」等警告文字
- 不在 CLAUDE.md 裡記錄架構細節（那是索引檔的責任）
- 日期用當天實際日期
- 索引檔屬於 repo 內容，修改後隨當次工作一併 commit
