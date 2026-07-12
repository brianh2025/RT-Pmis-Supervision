---
name: pmis-deploy
description: RT-PMIS 部署流程。當使用者說「部署」、「推上去」、「發佈」、「上 production」、「推 main」時觸發。執行建置驗證 → commit → push main → 確認 Vercel 部署成功的完整流程。
allowed-tools: Read, Grep, Glob, Bash
---

# RT-PMIS 部署流程

## 部署模型

- **所有修改直接推送 `main` 分支**，不建立 feature branch、不開 PR（雲端 session 若被指定專用分支則依 session 指示）
- GitHub 為主要 origin；GitLab 為備援，push 自動同步
- Vercel 從 main 自動部署到 production，無預覽流程——**推上去就是上線**，推之前必須驗證

## 執行步驟

### 1. 推送前驗證（強制，不可跳過）

```bash
npm run lint     # 0 嚴重錯誤（react-refresh context 與 hooks 警告可接受）
npm run build    # 成功無 error
git status       # 確認無遺漏或誤入的檔案
```

建置產物大小比對基準（異常暴增即停止並回報）：
- JS 主 chunk ~224 KB（gzip ~72 KB）
- ExcelJS chunk ~933 KB（gzip ~258 KB）
- CSS ~117 KB（gzip ~20 KB）

### 2. Commit 與推送

- commit message 一律**繁體中文**，格式：`類型: 一句話描述改了什麼`（例：`fix: 修正抽查單深色主題表頭對比`）
- 一個邏輯改動一個 commit，不混雜無關檔案

```bash
git add <明確列出檔案>
git commit -m "類型: 描述"
git push
```

push 失敗（網路因素）→ 以 2s、4s、8s、16s 間隔重試最多 4 次。

### 3. 部署確認

- 有 Vercel MCP 時：`list_deployments` 確認最新 deployment 狀態為 READY；若 ERROR 則用 `get_deployment_build_logs` 查建置錯誤
- 部署失敗時：先在本機重現（`npm run build`），修正後重推；**禁止在未查明原因前反覆重推**

### 4. Edge Function 部署（若本次有改 supabase/functions/）

- Edge Function 不隨 Vercel 部署，需另用 Supabase MCP `deploy_edge_function` 部署
- 部署前確認檔頭版本號已遞增（規則見 `/drive-sync-debug`）

## 回報格式

完成後回報：commit hash、一句話變更摘要、Vercel 部署狀態（含 Edge Function 部署與否）。
