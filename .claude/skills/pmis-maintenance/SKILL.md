---
name: pmis-maintenance
description: RT-PMIS 系統定期驗證除錯計畫。執行週測、月更新、季健檢、或發版前檢查清單。
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

# RT-PMIS 定期驗證除錯計畫

## 系統完整度基準（2026-04）

| 模組 | 完成度 | 備註 |
|------|--------|------|
| 認證 / 登入 | 100% | |
| 專案管理 | 100% | |
| 日誌 / 監工日報 | 98% | DailyReport/ 空目錄待清除 |
| 進度管理 (S-Curve) | 95% | |
| 材料管控 (3 表) | 90% | `material_entries` UI 未實作 |
| 送審管理 | 95% | 自動歸檔邏輯未實作 |
| 品質管理 | 95% | `construction_inspections` UI 未實作 |
| 文件歸檔 | 90% | 進版按鈕未實作 |
| 分析儀表板 | 90% | |

---

## 計畫架構

```
每週  →  功能迴歸測試        (~15 min)
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

**ProjectDashboard**
- [ ] KPI 數字正確顯示
- [ ] 快速連結導航正常

**各子模組（選一個測試專案走過）**
- [ ] 日誌：月曆顯示、新增日誌、PDF 匯入
- [ ] 進度：S-Curve 圖表渲染、新增 / 刪除紀錄
- [ ] 材料：三個分頁切換、inline 編輯儲存
- [ ] 送審：狀態點擊循環、新增 / 刪除
- [ ] 品質：嚴重度標籤、狀態切換
- [ ] 歸檔：搜尋、分類篩選、新增文件
- [ ] 分析：四個 tab 圖表全部渲染

**主題 / RWD**
- [ ] Dark / Light 切換不破版
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

# 4. 確認建置成功
npm run build
```

**檢查清單**
- [ ] `npm audit` 無新增高危漏洞
- [ ] `npm run build` 無 error（警告可接受）
- [ ] 建置產物大小無異常暴增（基準：JS ~1.85MB、CSS ~88KB）
- [ ] `xlsx` 漏洞狀態確認（目前無官方修正，持續觀察；考慮換 `exceljs`）

---

## 每季 — 資料庫健檢 + 程式碼稽核

**Supabase 健檢（於 Supabase Dashboard SQL Editor 執行）**

```sql
-- 1. 各表資料量
SELECT table_name, n_live_tup AS rows
FROM pg_stat_user_tables ORDER BY n_live_tup DESC;

-- 2. 孤立資料（project 已刪但子表仍有資料）
SELECT COUNT(*) FROM daily_logs
WHERE project_id NOT IN (SELECT id FROM projects);

-- 3. 確認 RLS 仍啟用
SELECT tablename, rowsecurity
FROM pg_tables WHERE schemaname = 'public';
```

**程式碼稽核**
- [ ] 確認 `.env` 未進 git：`git log --all -- .env`
- [ ] 確認無硬編碼金鑰：`grep -r "eyJ\|sk-\|anon" src/`
- [ ] 確認無新增未處理 console.error / unhandled promise
- [ ] 瀏覽器 DevTools Network：無異常 4xx / 5xx

**P4 未完成功能 — 每季評估是否排入 sprint**

| 項目 | 預估工作量 | 優先度 |
|------|----------|--------|
| `material_entries` UI | 中 | 中 |
| `construction_inspections` UI | 中 | 中 |
| 送審自動歸檔 workflow | 高 | 低 |
| 進版按鈕邏輯 | 低 | 低 |

---

## 每版發版前 — 完整清單

```bash
npm audit          # 無新高危
npm run build      # 成功無 error
npm run preview    # 本機走一遍核心路徑
git status         # 確認無遺漏檔案
git log --oneline -5  # commit 訊息清晰
```

- [ ] 所有週測項目通過
- [ ] `dist/` 建置成功無 error
- [ ] Supabase 連線正常（staging / prod 各別確認）
- [ ] 行動版主要頁面截圖對照無破版
- [ ] `package.json` version 欄位已更新

---

## 已知技術負債

| 項目 | 嚴重度 | 處理方式 |
|------|--------|---------|
| `xlsx` CVE（Prototype Pollution + ReDoS） | 高 | 接受風險（內部系統）；每季重新評估換 `exceljs` |
| `DailyReport/` 空目錄 | 低 | 下次清理時刪除 |
| `Manus_v1` submodule 有未提交修改 | 低 | 確認後提交或清除 |
