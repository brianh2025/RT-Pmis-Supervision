# 提送管制（Check App）

跨工程檢核「施工日誌是否建齊」與「監造月報是否提送、是否發文」的獨立前端應用。

與 RT-PMIS 主系統共用同一個 Supabase 專案與同一組帳號，但自成一個 Vite 專案、自己建置、自己部署，不依賴主系統的程式碼。

## 功能

- **單月檢核**：一列一個工程，顯示該月施工日誌建檔狀況、監造月報狀態、提送日期、發文文號
- **年度總表**：工程 × 1–12 月矩陣，工程名稱欄凍結，點任一格開檢核彈窗
- **檢核彈窗**：列出該月缺漏的日誌日期，並可直接更新月報的提送狀態、提送日期、發文文號與備註
- **統計摘要**：依檢視切換為當月或全年口徑（應提送、已發文、已提送待發文、逾期未提送、未到期未送、日誌缺漏天數）

## 判定規則

| 項目 | 規則 |
|---|---|
| 日誌應建檔天數 | 工期（`projects.start_date` ～ `end_date`，且不超過今日）內的每一個日曆日 |
| 日誌缺漏 | 應建檔日期中，`daily_logs` 沒有對應 `log_date` 的日子 |
| 未提送 | `supervision_reports.status` 不是 `submitted` |
| 已提送 | `status = 'submitted'` 但沒有 `doc_no` |
| 已發文 | `status = 'submitted'` 且有 `doc_no` |
| 逾期 | 尚未提送且已過該月報期限（次月 5 日） |

寫入時以 `project_id + report_month` upsert 到 `supervision_reports`，與主系統日誌頁的「月報稽核」是同一筆資料。

## 本機開發

```bash
cd apps/check
npm install
cp .env.example .env.local   # 填入 Supabase 連線資訊
npm run dev
```

## 環境變數

| 變數 | 說明 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase 專案網址（與主系統相同） |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key（與主系統相同） |
| `VITE_PMIS_BASE_URL` | RT-PMIS 主系統網址，「日誌」按鈕連過去；未設定時預設 `https://www.xiaoxiong.page` |

## 部署（Vercel）

建立一個新的 Vercel 專案指向本 repo，並設定：

- **Root Directory**：`apps/check`
- **Framework Preset**：Vite
- **環境變數**：上表三項（Production 與 Preview 都要設）

`vercel.json` 已包含 SPA rewrite，重新整理子路徑不會 404。

## Google 登入注意事項

Google 登入會把使用者導回本應用自己的網址。新網域必須先加進 Supabase 主控台的
Authentication → URL Configuration → Redirect URLs，否則 Google 這條路會被擋下；
電子郵件加密碼登入不受影響。
