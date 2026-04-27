/* 監造計畫 PDF 上傳工具 */
const DRIVE_FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || '';

async function getOrCreateFolder(token, parentId, name) {
  const q = encodeURIComponent(
    `'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const { files } = await res.json();
  if (files?.length > 0) return files[0].id;

  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
    }
  );
  const folder = await createRes.json();
  return folder.id;
}

/**
 * 上傳監造計畫 PDF 至 Google Drive。
 * 結構：根目錄 → 監造計畫 → folderName → 檔案
 * @returns {{ id: string, webViewLink: string }}
 */
export async function uploadPdfToDrive(file, token, folderName) {
  if (!DRIVE_FOLDER_ID) throw new Error('尚未設定 VITE_GOOGLE_DRIVE_FOLDER_ID');

  let parentId = await getOrCreateFolder(token, DRIVE_FOLDER_ID, '監造計畫');
  parentId = await getOrCreateFolder(token, parentId, folderName);

  const filename = file.name || `plan_${Date.now()}.pdf`;
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify({ name: filename, parents: [parentId] })], { type: 'application/json' }));
  form.append('file', file);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink',
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
  );
  if (!uploadRes.ok) throw new Error(`PDF 上傳失敗（${uploadRes.status}）`);

  const result = await uploadRes.json();

  await fetch(
    `https://www.googleapis.com/drive/v3/files/${result.id}/permissions?supportsAllDrives=true`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    }
  );

  return { id: result.id, webViewLink: result.webViewLink };
}
