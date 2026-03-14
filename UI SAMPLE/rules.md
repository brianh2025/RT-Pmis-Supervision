公共工程 PMIS 專案治理規範 (Project Governance Directive)
1. 系統合規性 (Compliance)
系統架構與資料流必須嚴格遵守行政院工程會《公共工程施工品質管理作業要點》。
任何工程數據（進度、照片、缺失）的異動，必須具備不可篡改的稽核軌跡 (Audit Trail)。
2. 核心技術棧與架構 (Tech Stack)
前端框架：Next.js 15 (App Router)，嚴格使用 Server Components 提升效能。
樣式與 UI：Tailwind CSS + Shadcn UI，全面支援響應式設計 (Mobile-First)。
後端與資料庫：Supabase (PostgreSQL + Auth + Storage)。
語言：TypeScript (嚴格模式，絕對禁止使用 any)。
3. 表單與資料防呆 (Data Integrity)
所有使用者輸入的工程表單，寫入資料庫前必須透過 Zod 進行伺服器端與客戶端雙重驗證。
施工日誌與品質抽查表單，必須鎖定送出後的狀態，需經電子簽核解鎖才可修改。
4. 防偽與文件生成 (Security & Documentation)
現場施工照片上傳時，必須強制讀取並驗證 EXIF 資訊（包含精確地理座標與時間戳記）。
所有法定報表匯出功能，統一透過伺服器端產出標準 A4 尺寸之 PDF 檔案。
