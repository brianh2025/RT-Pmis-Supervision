/**
 * RT-PMIS 施工日誌自動同步 — Google Apps Script
 *
 * 安裝步驟：
 * 1. 開啟 https://script.google.com → 新增專案
 * 2. 將此程式碼複製貼入
 * 3. 修改下方 EDGE_FN_URL 與 SYNC_SECRET
 * 4. 點選「觸發器」→ 新增觸發器：
 *    - 函式：onDriveChange
 *    - 事件來源：Google Drive
 *    - 事件類型：檔案變更
 * 5. 授予 Drive 存取權限
 *
 * Google Drive 資料夾結構：
 *   共用雲端硬碟/
 *     └─ {工程名}/                ← drive_folder_id 填此層 ID
 *          └─ 施工日誌/
 *               └─ 施工日誌-1150408.xlsx   ← 廠商每日上傳
 *
 * 檔名格式：施工日誌-YYYMMDD.xlsx（YYY 為民國年，三位數）
 */

const EDGE_FN_URL = 'https://<your-project>.supabase.co/functions/v1/sync-diary';
const SYNC_SECRET = '<your-sync-secret>';

/**
 * Google Drive 檔案變更時自動觸發
 * @param {Object} e - Drive change event
 */
function onDriveChange(e) {
  try {
    const file = DriveApp.getFileById(e.fileId);
    const name = file.getName();

    // 僅處理施工日誌 Excel 檔
    if (!name.startsWith('施工日誌-')) return;
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) return;

    // 確認在「施工日誌」資料夾內
    const parentIterator = file.getParents();
    if (!parentIterator.hasNext()) return;
    const diaryFolder = parentIterator.next();
    if (!diaryFolder.getName().includes('施工日誌')) return;

    // 取得工程資料夾（上層）
    const projectFolderIterator = diaryFolder.getParents();
    if (!projectFolderIterator.hasNext()) return;
    const projectFolder = projectFolderIterator.next();

    // 呼叫 Supabase Edge Function
    const payload = JSON.stringify({
      fileId: file.getId(),
      fileName: name,
      projectFolderId: projectFolder.getId(),
      secret: SYNC_SECRET,
    });

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: payload,
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(EDGE_FN_URL, options);
    const result = JSON.parse(response.getContentText());

    if (result.success) {
      Logger.log(`同步成功：${name} → 日期 ${result.date}，工項 ${result.itemCount} 筆`);
    } else {
      Logger.log(`同步失敗：${name} → ${result.error}`);
    }
  } catch (err) {
    Logger.log('sync-trigger 例外：' + err.toString());
  }
}

/**
 * 手動測試函式（不需觸發器，直接在 Apps Script 執行）
 * 使用方式：修改 testFileId 後，點選執行
 */
function testSync() {
  const testFileId = '<test-file-id>';  // 換成實際的 Drive 檔案 ID
  onDriveChange({ fileId: testFileId });
}
