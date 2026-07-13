# RT-PMIS 設計系統規範

單一事實來源：token 定義以 `src/index.css` 為準，本檔為對照表與使用場合說明。工作流程紀律（對齊、空白、邊距、內容完整性）見 `/ui-rules` skill。

---

## 1. 風格語言

- **基調**：Deep Graphite 深色底 + 玻璃擬態（glass-panel、backdrop-filter blur）+ 藍色主色
- **雙主題**：深色為預設，淺色以 `[data-theme="light"]` 覆寫；任何 UI 修改兩種主題都必須驗證不破版
- **微互動**：hover 浮起（hover-float）、glow 邊框（hover-glow）、按壓縮放（interactive-scale / 全域 button:active）、清單交錯進場（list-item-enter）

## 2. 色彩 token

### 品牌色

| Token | 值 | 用途 |
|---|---|---|
| `--color-primary` | `#2563EB` | 主色（按鈕、連結、焦點） |
| `--color-primary-light` | `#60A5FA` | 主色亮階（hover、漸層） |
| `--color-primary-dark` | `#1D4ED8` | 主色暗階 |
| `--color-primary-glow` | `rgba(37,99,235,.35)` | 光暈、focus ring |
| `--color-secondary` | `#FFC107` | 次色（強調、警示性亮點） |

### 語意色（深 / 淺主題各自覆寫）

| Token | 深色主題 | 淺色主題 | 用途 |
|---|---|---|---|
| `--color-success` | `#10b981` | `#059669` | 合格、完成 |
| `--color-warning` | `#f59e0b` | `#d97706` | 警告、待處理 |
| `--color-danger` / `--color-error` | `#ef4444` | `#dc2626` | 不合格、逾期、錯誤 |

### 中性色 / 表面

| Token | 用途 |
|---|---|
| `--color-background-base` | 頁面底色 |
| `--color-surface` / `--color-surface-hover` | 卡片、面板及其 hover |
| `--color-surface-border` / `--color-block-border` | 面板邊框（後者對比較強） |
| `--color-surface-translucent` / `--color-background-soft` | 半透明層、柔和底 |
| `--color-text-main` / `--color-text-muted` | 主文字 / 次要文字 |

### Alias token（MaterialControl、ProjectLayout、Analytics、Dashboard 使用）

| Token | 用途 |
|---|---|
| `--color-text1` / `--color-text2` | 主 / 次文字（alias） |
| `--color-bg1` / `--color-bg2`（含 `--color-bg2-rgb`） | 區塊底色兩階 |
| `--color-border` | 通用邊框 |

> 禁止引用不存在的 token（如 `--color-bg3`）；禁止自創 fallback 色值。

## 3. 字階系統（7 級）與使用場合

| Token | 值 | px | 定位 | 使用限制 |
|---|---|---|---|---|
| `--fs-2xl` | 1.4rem | 22.4 | 頁面標題 | — |
| `--fs-xl` | 1.15rem | 18.4 | 卡片主標題 | — |
| `--fs-lg` | 1.0rem | 16 | 子標題 | — |
| `--fs-base` | 0.9rem | 14.4 | **主要內容、按鈕**（body 預設） | 主要可讀內容的下限 |
| `--fs-sm` | 0.82rem | 13.1 | 次要內容、表頭 | 輔助字階常用上限，空間受限時使用 |
| `--fs-xs` | 0.75rem | 12 | 輔助標籤、badge、圖表刻度 | 不得承載必讀資訊 |
| `--fs-2xs` | 0.65rem | 10.4 | 最小標注、hint | 僅限裝飾性標注，不讀不影響操作 |

**字級底線規則**（詳見 `/ui-rules` 第 7 條）：使用者必須讀懂才能完成操作的文字 = 主要可讀內容，不得小於 10pt（≈13.33px），一律用 `--fs-base` 以上；容器放不下時擴大容器，嚴禁刪內容或降級字階。

字重：`--fw-normal` 400 / `--fw-medium` 500 / `--fw-semi` 600 / `--fw-bold` 700。

字體：介面 `Inter` + `Noto Sans TC`（Google Fonts 引入 `Outfit`、`Noto Sans TC`）；公文列印格式用標楷體 / `Noto Serif TC`（見抽查單、日誌列印視圖）。

## 4. 圓角 / 陰影 / 動效 token

| 類別 | Token |
|---|---|
| 圓角 | `--radius-sm` 4px、`--radius-md` 8px、`--radius-lg` 12px、`--radius-xl` 1.25rem、`--radius-2xl` 2rem、`--radius-full` |
| 陰影 | `--shadow-sm/md/lg/xl`（層級遞增）、`--shadow-glow`（主色光暈）、`--shadow-card`（重卡片） |
| 過渡 | `--transition-fast` 0.15s、`--transition-normal` 0.25s |

## 5. 全域 utility

| Class | 效果 |
|---|---|
| `.glass-panel` | 玻璃擬態面板（blur 12px + 半透明底 + 邊框 + shadow-lg） |
| `.text-gradient` / `.text-gradient-secondary` | 主色 / 次色漸層文字 |
| `.animate-fade-in` / `.animate-slide-up`（+ `.delay-100`〜`.delay-500`） | 進場動畫 |
| `.list-item-enter` | 清單交錯進場（nth-child 1–10，間隔 30ms） |
| `.card-enter` | 卡片進場 |
| `.hover-float` / `.hover-glow` / `.interactive-scale` | 微互動 |
| `.custom-scrollbar` | 細捲軸，捲動時顯示、逾時隱藏 |

## 6. 雙主題驗證清單（修改 UI 後必跑）

- [ ] Dark / Light 切換後表頭、標籤、badge 對比足夠（深色下最易失去對比）
- [ ] 語意色（success / warning / danger）在兩主題下均可辨識
- [ ] 玻璃擬態面板在淺色主題下邊界仍清楚
- [ ] 列印視圖（抽查單、日誌）不受主題影響（列印一律白底黑字）
- [ ] 行動版 sidebar、FAB 在兩主題下正常

## 7. 動效使用原則

- 進場動畫僅用於首次載入或新增項目，不得阻礙操作（全部 ≤ 0.8s）
- 按壓回饋（scale 0.97）為全域預設，disabled 按鈕除外
- 過渡一律使用 `--transition-fast` / `--transition-normal`，不自訂 duration
