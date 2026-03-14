# 專案主從邏輯重構任務清單

- [x] **路徑與導航重構 (Architecture & Navigation)**
    - [x] 將 `submission`, `quality`, `archive`, `analytics` 移至 `app/projects/[id]/` 目錄下
    - [x] 更新 `Sidebar.tsx` 以讀取當前 `projectId` 並生成動態連結
    - [x] 修正所有頁面的「返回」按鈕，導向至 `/projects/[id]/dashboard`

- [x] **數據動態化 (Dynamic Data)**
    - [x] 建立專案數據映射表 (Mock Data Mapper) (實作為 `useProject` hook)
    - [x] 在各頁面中使用 `params.id` 讀取並顯示對應專案的資料
    - [x] 確保總覽頁點擊特定專案時，儀表板顯示正確的標題與進度

- [x] **功能完整性檢查 (Full Functional Check)**
    - [x] 確保所有子頁面（送審、品質、歸檔、日誌）在不同專案間切換時數據正確
    - [x] 驗證返回路徑不再跳回全局導航
