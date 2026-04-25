# RT-PMIS — 雲林縣公共工程監造管理系統

雲林縣政府公共工程監造督導平台，提供工程人員統一管理施工日誌、進度追蹤、材料送審、品管缺失與文件歸檔的一站式作業環境。

## 技術棧

- **前端**：React 19 + Vite 8 (Rolldown)
- **後端/資料庫**：Supabase（PostgreSQL + Auth + Storage）
- **UI**：Lucide React、Recharts
- **PDF**：pdfjs-dist

## 功能模組

| 模組 | 說明 |
|------|------|
| 工程總覽 | 多工程列表、狀態概覽、快速進入 |
| 專案儀表板 | S-Curve 進度曲線、里程碑追蹤 |
| 施工日誌 | 每日施工記事、PDF 匯入、列印視圖 |
| 進度管理 | 計畫進度匯入（xlsx）、實際進度更新 |
| 材料管制 | 送審管制表、檢試驗管制表、施工計畫管制 |
| 品管管理 | 缺失紀錄、改善追蹤 |
| 送審管理 | 文件送審流程 |
| 歸檔管理 | 工程文件分類歸檔 |
| 統計分析 | 各模組彙總圖表 |

## 開發啟動

```bash
npm install
npm run dev
```

## 資料庫建置

依序在 Supabase SQL Editor 執行：

1. `supabase_schema.sql` — 基本資料表（projects、progress_records）
2. `supabase_schema_phase4.sql` — 施工日誌、監造月報
3. `db_migration_p4.sql` — P4 擴充資料表（材料管控、品管、歸檔等）

## 環境變數

複製 `.env.example`（若有）或在專案根目錄建立 `.env`：

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## 授權

本系統由XIAOXIONG.PAGE開發，獨家授權予RT雲林工務所內部使用，未經授權不得對外散布。
