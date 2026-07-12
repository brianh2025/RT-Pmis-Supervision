# RT-PMIS 系統分析報告（系統目標 × 使用體驗 × Skill × CLAUDE.md × 設計規範）

分析日期：2026-07-12

> 前提說明：分析當下專案中不存在 `design.md`，設計規範分散於 `src/index.css`（token）與 `/ui-rules` skill；`docs/arch-index.md` 亦尚未產生。本報告發現的問題已於同一批次修正（見文末「修正對照」）。

---

## 一、系統目標分析

| 目標層次 | 內容 | 達成狀況 |
|---|---|---|
| 核心定位 | 雲林縣公共工程監造管理系統：施工日誌、進度、材料、品管、送審、歸檔的一站式作業平台 | ✅ 九大模組全數上線，完成度 90–100%（見 pmis-maintenance 基準表） |
| 減少人工輸入 | PDF 辨識匯入（日誌、抽查單、送審總表）、Excel 匯入、Google Drive 自動同步（sync-diary v54） | ✅ 已成為系統主軸，近期 49 個 commit 大半投入於此 |
| 任務驅動監督 | 儀表板燈號（urgent/warning）+ 期限日期 + 逾期自動升級，涵蓋 8 類待辦 | ✅ 已完成推播式任務驅動 |
| 行動化現場作業 | 手機 FAB 一條龍：填工項 → 不合格自動建缺失單 → 直達拍照 | ✅ 已完成 |
| 合規產出 | 抽查單/日誌列印格式（標楷體、欄寬、表頭斷字） | ✅ 多輪調整已收斂 |
| 未竟目標 | 送審自動歸檔 workflow、歸檔進版按鈕 | ⚠️ 標記為低優先，每季評估 |

## 二、使用體驗（UX）分析

| 面向 | 現況 | 評估 |
|---|---|---|
| 資訊架構 | Dashboard（跨工程）→ ProjectDashboard（Bento Grid 任務看板）→ 各子模組，雙層儀表板 | ✅ 清楚；任務燈號讓使用者「被告知該做什麼」而非自己找 |
| 輸入成本 | 三種匯入管道（PDF/Excel/Drive）+ 一鍵建立抽查/材料 Modal +「前往抽查」預填機制 | ✅ 大幅降低重複輸入，是本系統最強的 UX 資產 |
| 防呆保護 | 同步中 beforeunload 防離頁、overlay 防誤關、試驗報告不合格阻擋材料判定、開工日下限防護 | ✅ 針對真實故障模式逐一補上 |
| 主題/RWD | Dark/Light 雙主題（token 化）、行動版 sidebar、手機 FAB | ✅ 週測清單有固定驗證項 |
| 潛在痛點 | ExcelJS chunk 933 KB（gzip 258 KB）雖已 lazy load，首次開匯入功能仍有等待；玻璃擬態（backdrop-filter）在低階現場設備可能吃效能 | ⚠️ 可觀察但非急迫 |
| 體驗量測 | 無使用行為回饋機制，待辦欄寫「依使用回饋再安排」但回饋管道未定義 | ⚠️ 建議至少建立簡易回報入口 |

## 三、Skill 分析（.claude/skills/，共 7 個）

| Skill | 性質 | 品質評估 |
|---|---|---|
| `/arch-index` | 架構索引產生器 | ⚠️ 設計良好但目標產物 docs/arch-index.md 當時不存在（本批次已產生） |
| `/pmis-maintenance` | 週/月/季/發版檢查清單 | ✅ 最完整的 skill，含完成度基準、建置基準、SQL 健檢；基準日期與 CLAUDE.md 同步 |
| `/pmis-deploy` | 部署流程 | ✅ 驗證→commit→push→Vercel 確認一條龍，已預留「雲端 session 依指定分支」例外 |
| `/drive-sync-debug` | Drive 同步除錯協議 | ✅ 含架構圖、4 種檔名格式、已修故障模式表（v35–v54）、除錯順序，典型「經驗結晶」型 skill |
| `/ui-rules` | UI 規範 | ✅ 規則具體（含真實錯誤案例）；原第 7 條與字階 token 有矛盾（本批次已修） |
| `/screenshot-interpretation` | 截圖標註解讀 | ✅ 符號對照表 + 顏色分組 + 「不對」強制停止規則 |
| `supabase-postgres-best-practices` | 外部 skill（skills-lock.json 管理） | ✅ 完整參考庫（40+ 檔），被動查詢型 |

整體：skill 體系成熟，特色是每個 skill 都內建已發生的錯誤案例，屬防回歸型知識庫。

## 四、CLAUDE.md 分析

| 面向 | 現況（分析當下） | 問題 |
|---|---|---|
| 結構 | 背景→語言→規範→UI→部署→紀律→skill 索引→維護→建置基準→開發狀態 | ✅ 分區清楚 |
| 內部矛盾 ① | 開頭寫「GitHub（主要 origin）、GitLab（備援）」，「基礎建設」段卻寫「Git remote 從 GitHub 遷移至 GitLab」 | ⚠️ 兩段敘述相反（實查 remote 為 GitHub，後者為過時歷史） |
| 膨脹問題 | 「近期完成功能」累積 4 個日期批次、數十條 changelog，每次對話全量載入 | ⚠️ 違背自身「省 token」哲學 |
| 規範重複 | UI/token 紀律同時存在於 CLAUDE.md、ui-rules、pmis-maintenance 三處 | ⚠️ 缺單一事實來源 |
| 部署敘述 | 「直接推 main、不開 PR」 | ✅ pmis-deploy 已補雲端 session 例外，無實際衝突 |

## 五、設計規範分析（src/index.css + ui-rules）

| 面向 | 現況（分析當下） | 問題 |
|---|---|---|
| Token 完整度 | 色彩（primary/secondary/語意色）、7 級字階、字重、圓角、陰影、動效、雙主題覆寫、alias tokens | ✅ 結構完整 |
| 規範矛盾 ②（最重要發現） | ui-rules 第 7 條規定「字體不得小於 10pt（≈13.33px），不可協商」，但 index.css 定義 `--fs-2xs`（10.4px）、`--fs-xs`（12px）、`--fs-sm`（13.1px）三個低於底線的 token，且全案 12 檔 35 處使用中 | ⚠️ 規則與 token 系統直接衝突，需明文化適用範圍 |
| 文件化 | 設計決策只存在於 CSS 註解與 skill 條文，無統整文件 | ⚠️ 缺 design.md |
| 風格語言 | Deep Graphite + 玻璃擬態 + 藍色主色 + 微互動 | ✅ 與「全系統設計語言升級」一致 |

---

## 綜合結論（依優先序）

1. **兩個明確矛盾**：CLAUDE.md 的 GitHub/GitLab 敘述互斥；ui-rules 10pt 底線 vs index.css 三個小於底線的字階 token。
2. **arch-index 未兌現**：skill 存在但索引檔從未產生。
3. **CLAUDE.md 該瘦身**：changelog 累積影響每次對話的 token 成本。
4. **系統目標達成度高**：九大模組 90–100%，剩餘待辦僅兩項低優先功能；UX 強項在匯入自動化與任務驅動，缺口在使用回饋管道。

## 修正對照（本批次已執行）

| 發現 | 修正 |
|---|---|
| GitHub/GitLab 敘述矛盾 | 過時的「遷移至 GitLab」敘述移入 `docs/CHANGELOG.md` 並更正為正確歷史（曾遷移、後改回 GitHub 為主） |
| 10pt 底線 vs 小字階 token 矛盾 | `/ui-rules` 第 7 條明文化：底線適用「主要可讀內容」；`--fs-sm`/`--fs-xs`/`--fs-2xs` 限輔助用途，並定義判斷準則（必須讀懂才能操作 = 主要內容） |
| CLAUDE.md 膨脹 | changelog 歷史批次移至 `docs/CHANGELOG.md`，CLAUDE.md 僅留最新狀態摘要與文件索引 |
| UI 規範三處重複 | 單一事實來源定為 `/ui-rules` + `docs/design.md`，CLAUDE.md 留引用 |
| 缺 design.md | 建立 `docs/design.md`（token 對照、字階使用場合、雙主題驗證清單、動效原則） |
| arch-index 未產生 | 執行 `/arch-index`，產生 `docs/arch-index.md`（13 頁面、28 元件、13 資料表、2 Edge Functions） |

## 未執行的後續建議

- 建立使用者回饋管道（簡易回報入口），支撐「依使用回饋再安排」的待辦機制
- 觀察 ExcelJS chunk 載入等待與低階設備上 backdrop-filter 的效能表現
