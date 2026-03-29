# RT-PMIS 系統架構修正計畫
**建立日期：2026-03-29**
**狀態：完成 ✅**

---

## 一、主題一致性（Theme Consistency）

**問題：**
- 部分元件 CSS 使用硬編碼 `rgba()` 而非 `var(--color-*)`
- `index.css` 缺少部分 Manus_v1 使用的 token（`--color-success`, `--color-warning` 等）

**修正：**
- [ ] 補齊 `index.css` 缺少的 CSS 變數
- [ ] 審查各頁面 CSS，硬編碼顏色改用 CSS 變數

---

## 二、儀表板重設計（ProjectDashboard）

**參考：** Manus_v1 `ProjectDashboard.tsx`

**目標介面：**
```
┌─ 專案標頭（名稱 + 狀態徽章）──────────────────┐
├─ 快速捷徑列（橫排 7個小按鈕，移至頂部）────────┤
│  [進度] [材料] [監造] [送審] [品管] [歸檔] [統計]  │
├─ Bento Grid (2欄) ────────────────────────────┤
│  施工進度（寬）       │ 工程資訊（neon盒）     │
│  監造報表（sci-fi）   │ 材料管制計數           │
│  送審管理             │ 品管缺失               │
└───────────────────────────────────────────────┘
```

**修正：**
- [ ] 移植 Bento Grid CSS（stunning-card, neon-stat-box, sci-fi-tracker, counter-box 等）
- [ ] 快速導覽移至頂部，改為橫排捷徑按鈕列
- [ ] 移除底部快速導覽 bento 卡
- [ ] 補齊所有 stats 資料抓取

---

## 三、模組重組

### 3-A 材料管制（`/material`）

```
材料管制
├── Tab 1：材料進場紀錄（新增）
│   欄位：日期 / 材料名稱 / 規格 / 數量 / 廠商 / 驗收人 / 備註
│   新增資料表：material_entries
│   功能：新增列、刪除、內嵌編輯、CSV 匯出
│
└── Tab 2：檢試驗管制表（現有 mcs_test）
    維持 Manus 版試算表介面
```

**修正：**
- [ ] 新增 `material_entries` 資料表
- [ ] MaterialControl.jsx 加入「材料進場紀錄」Tab
- [ ] 移除 mcs_submission / mcs_plan 兩表（移至送審管理）

### 3-B 送審管理（`/submission`）

```
送審管理
├── Tab 1：材料送審管制表（mcs_submission，從材料管制移入）
│   維持試算表介面 + 已核定項目顯示「→歸檔」按鈕
│
└── Tab 2：計畫書送審管制表（mcs_plan，從材料管制移入）
    維持試算表介面 + 已核定項目顯示「→歸檔」按鈕
```

**修正：**
- [ ] Submission.jsx 重組為雙 Tab（材料送審 + 計畫書送審）
- [ ] 採用 Manus 版 MCS 試算表介面
- [ ] 已核定項目加「→歸檔」觸發按鈕

### 3-C 品質管理（`/quality`）

```
品質管理
├── Tab 1：施工檢驗管制（新增）
│   欄位：日期 / 工程項目 / 部位 / 檢驗類型 / 人員 / 結果 / 備註
│   結果：合格 / 不合格 / 待複驗（三態切換徽章）
│   新增資料表：construction_inspections
│
└── Tab 2：缺失改善管制（現有 quality_issues）
    維持 Manus Quality.tsx 嚴重度 + 5狀態流程
```

**修正：**
- [ ] 新增 `construction_inspections` 資料表
- [ ] Quality.jsx 改為雙 Tab
- [ ] 施工檢驗 Tab：三態結果徽章（合格/不合格/待複驗）

### 3-D 歸檔管理（`/archive`）

```
歸檔管理（以 Manus Archive.tsx 為基礎補齊）
├── 左側：10 類分類樹（含件數徽章）
├── 右側：搜尋列 + 文件卡片列表
│   卡片：文號 / 標題 / 版本號 / 日期 / 標籤 / 下載
├── 手動新增歸檔 Modal
├── 版本號欄位（v1/v2/v3...）
└── 「進版」按鈕（已歸檔項目右側）
```

**修正：**
- [ ] Archive.jsx 以 Manus 版為基礎重寫
- [ ] 加入版本號顯示欄位
- [ ] 加入「進版」按鈕及邏輯

---

## 四、送審 → 歸檔自動工作流程

```
送審管理（材料送審或計畫書送審）
   │
   ▼ result = '同意備查' 或 approve 欄位有值
   │
   ↓ [自動] 建立 archive_docs 記錄
     title       ← 材料/計畫名稱
     doc_no      ← 文號（remark欄）
     category    ← 'submission'
     version     ← 'v1'
     doc_date    ← 審查日期
     submission_id ← 來源記錄 id
     tags        ← ['材料送審'] 或 ['施工計畫']
   顯示通知：「已自動建立歸檔記錄 ✓」

歸檔管理
   │
   ▼ 點擊「進版」
   ↓ 計算新版本號（v1→v2）
   ↓ 更新 archive_docs.version
   ↓ 在原送審表建立新列（ver=新版本，result清空）
   顯示通知：「已建立 v2 送審記錄」
```

**資料庫變更：**
```sql
ALTER TABLE archive_docs
  ADD COLUMN version VARCHAR DEFAULT 'v1',
  ADD COLUMN submission_id UUID,
  ADD COLUMN source_table VARCHAR;

CREATE TABLE material_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  entry_date DATE,
  name TEXT, spec TEXT, qty TEXT,
  vendor TEXT, inspector TEXT, remark TEXT,
  created_by UUID, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE construction_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  inspect_date DATE,
  work_item TEXT, location TEXT, inspect_type TEXT,
  inspector TEXT,
  result TEXT CHECK (result IN ('合格','不合格','待複驗')),
  remark TEXT,
  created_by UUID, created_at TIMESTAMPTZ DEFAULT now()
);
```

**修正：**
- [ ] archive_docs 資料表加欄位
- [ ] 新增 material_entries / construction_inspections 資料表
- [ ] 送審管理「已核定」→ 自動呼叫歸檔建立函式
- [ ] 歸檔管理「進版」→ 建立新版送審記錄

---

## 五、執行順序

| 階段 | 項目 | 狀態 |
|------|------|------|
| P1 | 補齊 CSS 變數 + Bento Grid CSS | ✅ |
| P1 | ProjectDashboard 重設計 | ✅ |
| P2 | Submission.jsx 重組（MCS兩表移入） | ✅ |
| P2 | MaterialControl.jsx 重組（+進場紀錄） | ✅ |
| P3 | Quality.jsx 重組（+施工檢驗Tab） | ✅ |
| P3 | Archive.jsx 補齊（Manus版） | ✅ |
| P4 | 自動歸檔 workflow + DB Schema | ✅ |
