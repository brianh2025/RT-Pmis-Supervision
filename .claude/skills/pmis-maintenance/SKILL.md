---
name: pmis-maintenance
description: RT-PMIS 系統定期驗證除錯計畫。執行週測、月更新、季健檢、或發版前檢查清單。
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

# RT-PMIS 定期驗證除錯計畫

## 系統完整度基準（2026-05 更新）

| 模組 | 完成度 | 備註 |
|------|--------|------|
| 認證 / 登入 | 100% | |
| 專案管理 | 100% | |
| 日誌 / 監工日報 | 100% | 含 PDF 匯入、Drive 同步、快速建立 Modal |
| 進度管理 (S-Curve) | 95% | |
| 材料管控 (3 表) | 100% | 材料進場 Modal、待查驗狀態、試驗報告連動已完成 |
| 送審管理 | 95% | 自動歸檔邏輯未實作 |
| 品質管理 | 100% | 施工抽查單、手機 FAB 一條龍、試驗報告管制表已完成 |
| 照片記錄 | 95% | 雙欄編輯、資料夾位置記憶 |
| 文件歸檔 | 90% | 進版按鈕未實作 |
| 分析儀表板 | 95% | Bento Grid 任務燈號、期限驅動 urgent/warning |
| Drive 同步 | 95% | Edge Function sync-diary（版本號見檔頭註解）|

---

## 計畫架構

```
每週  →  功能迴歸測試        (~20 min)
每月  →  套件安全更新 + 建置驗證  (~10 min)
每季  →  資料庫健檢 + 程式碼品質稽核  (~30 min)
每版  →  發版前完整清單
```

---

## 每週（每 Monday）— 功能迴歸測試

**Auth**
- [ ] 登入 / 登出正常
- [ ] 未登入直接進 `/dashboard` 被導回登入頁

**Dashboard**
- [ ] 專案列表載入
- [ ] 新增專案 modal 開關正常
- [ ] Excel 匯入 modal（.xlsx / .xlsm）可解析預覽
- [ ] 今日簡報卡（天氣輪播 + 待辦彙總）正常顯示
- [ ] 跨工程任務彙總燈號正確

**ProjectDashboard**
- [ ] KPI 數字正確顯示
- [ ] Bento Grid 任務清單燈號（urgent/warning）正確，逾期升級邏輯正常
- [ ] 施工項目查驗比例 chip 明細正確
- [ ] 快速連結導航正常

**各子模組（選一個測試專案走過）**
- [ ] 日誌：月曆顯示、新增日誌、PDF 匯入、一鍵建立抽查 + 材料進場 Modal
- [ ] Drive 同步：單日 / 日期區間篩選正確（不得跑全量）、同步中防離頁提示
- [ ] 進度：S-Curve 圖表渲染、新增 / 刪除紀錄
- [ ] 材料：三個分頁切換、inline 編輯儲存、待查驗狀態、試驗報告連動阻擋
- [ ] 送審：狀態點擊循環、新增 / 刪除
- [ ] 品質：嚴重度標籤、狀態切換、施工抽查單填寫 / 列印 / 儲存至管制表
- [ ] 品質（手機版）：FAB 快速填寫 → 不合格自動建缺失單 → 直達拍照
- [ ] 照片記錄：雙欄編輯、瀏覽記憶資料夾位置
- [ ] 歸檔：搜尋、分類篩選、新增文件
- [ ] 分析：各 tab 圖表全部渲染
- [ ] 監造報表：月報稽核 Tab 正常

**主題 / RWD**
- [ ] Dark / Light 切換不破版（含抽查單表頭）
- [ ] 行動版 sidebar 開關正常

---

## 每月 — 套件安全更新 + 建置驗證

```bash
# 1. 檢查過期套件
npm outdated

# 2. 安全稽核
npm audit

# 3. 安全的 patch/minor 更新
npm update

# 4. 確認 lint 與建置成功
npm run lint
npm run build
```

**檢查清單**
- [ ] `npm audit` 無新增高危漏洞
- [ ] `npm run build` 無 error（警告可接受）
- [ ] 建置產物大小無異常暴增，基準（2026-04-25）：
  - JS 主 chunk ~224 KB（gzip ~72 KB）
  - ExcelJS chunk ~933 KB（gzip ~258 KB）
  - CSS ~117 KB（gzip ~20 KB）
  - 建置時間 ~3 s
- [ ] Lint 0 嚴重錯誤（react-refresh context 警告與 hooks 警告可接受）

---

## 每季 — 資料庫健檢 + 程式碼稽核

**Supabase 健檢**（優先使用 Supabase MCP 的 `execute_sql` / `get_advisors`；無 MCP 時於 Supabase Dashboard SQL Editor 執行）

```sql
-- 1. 各表資料量
SELECT relname AS table_name, n_live_tup AS rows
FROM pg_stat_user_tables ORDER BY n_live_tup DESC;

-- 2. 孤立資料（project 已刪但子表仍有資料）
SELECT COUNT(*) FROM daily_logs
WHERE project_id NOT IN (SELECT id FROM projects);

-- 3. 確認 RLS 仍啟用
SELECT tablename, rowsecurity
FROM pg_tables WHERE schemaname = 'public';
```

- [ ] `get_advisors`（security + performance）無新增高風險項目
- [ ] Edge Function `sync-diary` 以 `get_logs` 檢視近期有無異常錯誤

**程式碼稽核**
- [ ] 確認 `.env` 未進 git：`git log --all -- .env`
- [ ] 確認無硬編碼金鑰：`grep -rn "eyJ\|sk-\|service_role" src/ supabase/functions/`
- [ ] 確認無新增未處理 console.error / unhandled promise
- [ ] 瀏覽器 DevTools Network：無異常 4xx / 5xx

**未完成功能 — 每季評估是否排入 sprint**

| 項目 | 預估工作量 | 優先度 |
|------|----------|--------|
| 送審自動歸檔 workflow | 高 | 低 |
| 歸檔進版按鈕邏輯 | 低 | 低 |

---

## 每版發版前 — 完整清單

```bash
npm audit          # 無新高危
npm run lint       # 0 嚴重錯誤
npm run build      # 成功無 error
npm run preview    # 本機走一遍核心路徑
git status         # 確認無遺漏檔案
git log --oneline -5  # commit 訊息清晰
```

- [ ] 所有週測項目通過
- [ ] `dist/` 建置成功無 error
- [ ] Supabase 連線正常
- [ ] 行動版主要頁面截圖對照無破版
- [ ] `package.json` version 欄位已更新
- [ ] 發版後確認 Vercel production 部署成功（詳見 `/pmis-deploy`）

---

## Claude 作業規則

- **新建任何 `.css` 檔前，必須先讀 `src/index.css` 確認設計系統 token，再動筆**
  - 禁止使用 Tailwind / 自創 fallback 值（`#fff`, `#f3f4f6`, `#3b82f6` 等）
  - 禁止引用不存在的 token（如 `--color-bg3`）
  - 所有顏色、間距、圓角、字級一律使用 `index.css` 中已定義的 CSS 變數

---

## 已知技術負債

| 項目 | 嚴重度 | 處理方式 |
|------|--------|---------|
| （無 xlsx CVE，已於 2026-04-25 完成 exceljs 遷移） | — | — |
| 送審自動歸檔、歸檔進版按鈕未實作 | 低 | 每季評估 |
