/* ============================================================
   PhotoTable.jsx — 工程照片記錄系統
   ============================================================ */
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Camera, ChevronLeft, ChevronRight, Printer, Upload, Cloud, FolderOpen,
  RotateCcw, X, Check, FileImage, MapPin, RefreshCw,
  Save, Loader2, FileText, Plus, Trash2, Lock, Zap, ArrowLeft, Link2, HelpCircle, ScanLine, Images, CalendarDays,
} from 'lucide-react';
import * as exifr from 'exifr';
import { supabase } from '../lib/supabaseClient';
import { useProject } from '../hooks/useProject';
import './PhotoTable.css';

const PHOTOS_PER_PAGE = 3;

function toRocDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getFullYear() - 1911}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`;
}
function todayISO() { return new Date().toISOString().split('T')[0]; }
function parseRemark(r) { try { return JSON.parse(r) || {}; } catch { return {}; } }

/* ── Google Picker / Drive 工具 ── */
const GAPI_KEY              = import.meta.env.VITE_GOOGLE_API_KEY                    || '';
const GCLIENT_ID            = import.meta.env.VITE_GOOGLE_CLIENT_ID                  || '';
const DRIVE_FOLDER_ID       = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID            || '';

/** 通用：取得或建立子資料夾，回傳資料夾 ID */
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

/** 設定 Drive 檔案任何人可讀，回傳可嵌入縮圖 URL */
async function makeFilePublic(fileId, token) {
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    }
  );
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1280`;
}

/**
 * 上傳照片至 Drive。
 * 結構：根目錄 → E0-1施工 / E0-2材料進場 → 工項 → YYYYMMDD → 檔案
 * category：照片類別（'材料進場' 進 E0-2，其餘進 E0-1）
 * workItem：工項名稱（作為子資料夾，空值則省略）
 * rootFolderId：指定根資料夾（工程的 drive_folder_id）；空值時回退全域 VITE_GOOGLE_DRIVE_FOLDER_ID
 */
async function uploadToDrive(blob, mimeType, token, date, category = '', workItem = '', rootFolderId = '') {
  const rootId = rootFolderId || DRIVE_FOLDER_ID;
  if (!rootId) throw new Error('此工程未設定雲端資料夾，且未設定 VITE_GOOGLE_DRIVE_FOLDER_ID');

  const catFolderName = category === '材料進場' ? 'E0-2材料進場' : 'E0-1施工';
  let parentId = await getOrCreateFolder(token, rootId, catFolderName);
  if (workItem) parentId = await getOrCreateFolder(token, parentId, workItem);
  const dateFolder = (date || todayISO()).replace(/-/g, '');
  parentId = await getOrCreateFolder(token, parentId, dateFolder);

  const ext      = (mimeType || '').includes('png') ? 'png' : 'jpg';
  const filename = `photo_${Date.now()}.${ext}`;

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify({ name: filename, parents: [parentId] })], { type: 'application/json' }));
  form.append('file', blob);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id',
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
  );
  if (!uploadRes.ok) throw new Error(`Drive 上傳失敗（${uploadRes.status}）`);
  const { id } = await uploadRes.json();
  return makeFilePublic(id, token);
}

/** 從本機 File 解析 EXIF */
async function parseExif(file) {
  try {
    const tags = await exifr.parse(file, {
      pick: ['DateTimeOriginal', 'CreateDate', 'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef'],
    });
    if (!tags) return { exifDate: '', exifGps: '' };
    const dt = tags.DateTimeOriginal || tags.CreateDate;
    const exifDate = dt instanceof Date ? dt.toISOString().split('T')[0] : '';
    let exifGps = '';
    if (tags.GPSLatitude && tags.GPSLongitude) {
      const lat = tags.GPSLatitude, lng = tags.GPSLongitude;
      const lD = (typeof lat === 'number' ? lat : lat[0] + lat[1] / 60 + lat[2] / 3600) * (tags.GPSLatitudeRef  === 'S' ? -1 : 1);
      const gD = (typeof lng === 'number' ? lng : lng[0] + lng[1] / 60 + lng[2] / 3600) * (tags.GPSLongitudeRef === 'W' ? -1 : 1);
      exifGps = `${lD.toFixed(6)}, ${gD.toFixed(6)}`;
    }
    return { exifDate, exifGps };
  } catch { return { exifDate: '', exifGps: '' }; }
}

let _gisReady        = false;

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

async function ensureGIS() {
  if (_gisReady) return;
  await loadScript('https://accounts.google.com/gsi/client');
  _gisReady = true;
}

async function getGoogleToken() {
  await ensureGIS();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GCLIENT_ID,
      // drive.file：僅限本應用建立/開啟的檔案（不需 OAuth 驗證，sensitive 等級）
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: resp => resp.error ? reject(new Error(resp.error)) : resolve(resp.access_token),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

/** 取得唯讀 token，供從 Drive 匯入既有照片使用 */
async function getGoogleReadToken() {
  await ensureGIS();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GCLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: resp => resp.error ? reject(new Error(resp.error)) : resolve(resp.access_token),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

/** 從 Drive 下載檔案內容為 Blob */
async function downloadDriveFile(fileId, token) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`下載失敗（${res.status}）`);
  return res.blob();
}

/** 列出 Drive 資料夾的子資料夾與圖片檔 */
async function listDriveFolder(folderId, token) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,thumbnailLink)&orderBy=name&pageSize=200`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`資料夾列出失敗（${res.status}）`);
  const { files = [] } = await res.json();
  return {
    folders: files.filter(f => f.mimeType === 'application/vnd.google-apps.folder'),
    images:  files.filter(f => f.mimeType?.startsWith('image/')),
  };
}

/** 從資料夾路徑陣列推算 date / workItem / category
 *  E0-x 開頭 → 類別資料夾：含「材料」→ 材料進場；否則 → 施工抽查
 *  YYYYMMDD（西元）或 YYYMMDD（民國）→ 日期
 *  其他純數字（如民國年月 11506）→ 略過不視為工項；其餘 → 工項名稱
 */
function parsePathMeta(path) {
  let driveDate = '', driveWorkItem = '', driveCategory = '';
  for (const seg of path) {
    if (/^\d{8}$/.test(seg.name)) {
      driveDate = `${seg.name.slice(0,4)}-${seg.name.slice(4,6)}-${seg.name.slice(6,8)}`;
    } else if (/^\d{7}$/.test(seg.name)) {
      driveDate = `${Number(seg.name.slice(0,3)) + 1911}-${seg.name.slice(3,5)}-${seg.name.slice(5,7)}`;
    } else if (/^E0-\d/i.test(seg.name)) {
      driveCategory = /材料/.test(seg.name) ? '材料進場' : '施工抽查';
    } else if (!/^\d+$/.test(seg.name)) {
      driveWorkItem = seg.name;
    }
  }
  return { driveDate, driveWorkItem, driveCategory };
}

/* ── 瀏覽位置記憶（每工程一份，相簿瀏覽與匯入瀏覽器共用）── */
function loadBrowseMemory(projectId) {
  if (!projectId) return null;
  try { return JSON.parse(localStorage.getItem(`pmis_drive_browse_${projectId}`) || 'null'); }
  catch { return null; }
}
function saveBrowseMemory(projectId, patch) {
  if (!projectId) return;
  try {
    localStorage.setItem(`pmis_drive_browse_${projectId}`,
      JSON.stringify({ ...(loadBrowseMemory(projectId) || {}), ...patch }));
  } catch { /* localStorage 不可用時略過 */ }
}

/* 共用列印 CSS
   A4 可用高度：29.7cm - 2cm padding = 27.7cm
   頁首約 3.0cm（大字） → 剩 24.7cm 供 3 組照片
   每組 = photo(6.9cm) + desc(1.35cm) = 8.25cm × 3 = 24.75cm ✓
   最小字體 12pt（表單編號除外）
*/
const PRINT_CSS = `
  body { margin: 0; background: #e0e0e0; }
  .report-page {
    font-family: 'DFKai-SB','BiauKai','標楷體','Noto Serif TC',serif;
    width: 21cm; height: 29.7cm; padding: 1cm;
    margin: 1.5cm auto; background: #fff; box-sizing: border-box; color: #000;
    page-break-after: always; overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.25);
  }
  @media print {
    body { background: #fff; }
    .report-page { margin: 0 auto; box-shadow: none; }
  }
  .report-header { display:flex; align-items:flex-start; gap:8px; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:0; }
  .report-header-left { width:80px; flex-shrink:0; }
  .report-header-center { flex:1; text-align:center; }
  .report-header-center h1 { font-size:18pt; font-weight:700; margin:0 0 4px; }
  .report-header-center h2 { font-size:14pt; font-weight:600; margin:0; }
  .report-header-right { width:80px; flex-shrink:0; text-align:right; font-size:9pt; line-height:2; }
  .report-table-b { width:100%; border-collapse:collapse; border-top:1px solid #000; border-left:1px solid #000; border-right:1px solid #000; }
  .report-block-b { page-break-inside:avoid; }
  .photo-cell-b { width:70%; height:6.9cm; padding:.3rem; text-align:center; vertical-align:middle; border-bottom:1px solid #000; }
  .photo-cell-b img { max-width:100%; max-height:6.5cm; object-fit:contain; }
  .photo-placeholder { width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#f5f5f5; border:1px dashed #ccc; color:#999; font-size:12pt; gap:4px; }
  .info-cell-b { width:30%; padding:.3rem .7rem; border-left:1px solid #000; border-bottom:1px solid #000; vertical-align:top; font-size:12pt; word-break:break-all; }
  .info-location { font-weight:700; line-height:1.5; }
  .info-date { margin-top:.5rem; font-size:12pt; }
  .desc-cell-b { padding:.2rem .7rem; font-size:12pt; border-bottom:1px solid #000; word-break:break-all; line-height:1.4; height:1.35cm; box-sizing:border-box; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
`;

function buildReportHtml(pages, { title, docNo, subtitle }) {
  const sub = subtitle || '施工抽查紀錄';
  return pages.map((page, pi) => `
    <div class="report-page">
      <div class="report-header">
        <div class="report-header-left"></div>
        <div class="report-header-center">
          <h1>${title || '工程名稱'}</h1>
          <h2>${sub}</h2>
        </div>
        <div class="report-header-right">
          ${docNo ? `<div>編號：${docNo}</div>` : ''}
          <div>第 ${pi + 1} 頁</div>
        </div>
      </div>
      <table class="report-table-b"><tbody>
        ${page.map((item, ci) => `
          <tr class="report-block-b">
            <td class="photo-cell-b">
              ${(item.photo?.url || item.photo?.src)
                ? `<img src="${item.photo.url || item.photo.src}" alt="照片 ${pi * PHOTOS_PER_PAGE + ci + 1}">`
                : `<div class="photo-placeholder"><span>照片 ${pi * PHOTOS_PER_PAGE + ci + 1}</span><span style="font-size:9pt">（無照片）</span></div>`
              }
            </td>
            <td class="info-cell-b">
              <div class="info-location">${item.info?.location || '（無位置說明）'}</div>
              <div class="info-date">${toRocDate(item.info?.date)}</div>
            </td>
          </tr>
          <tr class="description-row-b">
            <td colspan="2" class="desc-cell-b">說明：${item.info?.description || ''}</td>
          </tr>
        `).join('')}
      </tbody></table>
    </div>
  `).join('');
}

function openPrintWindow(bodyHtml, windowTitle) {
  const w = window.open('', '_blank', 'width=960,height=800');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${windowTitle}</title><style>${PRINT_CSS}</style></head><body>${bodyHtml}</body></html>`);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
}

/* ── 記錄詳情 / 編輯 ── */
function RecordDetail({ record, projectId: _projectId, projectName, driveRootId = '', onBack, onSaved, onDeleted, onGoReportDB }) {
  const locked     = record.tags?.includes('日報已附註');
  const isMaterial = record.source_table === 'material_entries';
  const info       = parseRemark(record.remark);

  const [title,        setTitle]        = useState(record.title || '');
  const [docDate,      setDocDate]      = useState(record.doc_date || '');
  const [docNo,        setDocNo]        = useState(record.doc_no || '');
  const [photos,       setPhotos]       = useState(info.photos || []);
  const [saving,       setSaving]       = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [subtitle,     setSubtitle]     = useState(
    isMaterial ? SUBTITLE_OPTIONS[1]
      : (SUBTITLE_OPTIONS.includes(info.subtitle) ? info.subtitle : SUBTITLE_OPTIONS[0])
  );
  const [replacingIdx, setReplacingIdx] = useState(null);
  const replaceInputRef = useRef(null);

  /* 更換單張照片 */
  function triggerReplace(i) { setReplacingIdx(i); replaceInputRef.current?.click(); }
  async function handleReplaceFile(file) {
    if (!file || replacingIdx === null) return;
    const previewUrl = URL.createObjectURL(file);
    // 先用本機預覽，等儲存時才上傳
    setPhotos(prev => prev.map((p, i) => i === replacingIdx
      ? { ...p, _pendingBlob: file, _pendingPreview: previewUrl }
      : p
    ));
    setReplacingIdx(null);
  }

  function updatePhoto(i, field, val) {
    setPhotos(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  }

  async function handleSave() {
    setSaving(true);
    try {
      // 若有待更換的照片，先取得 Google token 再上傳
      const hasPending = photos.some(p => p._pendingBlob);
      let token = null;
      if (hasPending) {
        token = await getGoogleToken().catch(e => { throw new Error(`Google 授權失敗：${e.message}`); });
      }
      const finalPhotos = await Promise.all(photos.map(async p => {
        if (!p._pendingBlob) return p;
        const url = await uploadToDrive(p._pendingBlob, p._pendingBlob.type, token, p.date, '', '', driveRootId);
        const { _pendingBlob: _b, _pendingPreview: _pv, ...rest } = p;
        return { ...rest, url };
      }));
      const { error } = await supabase.from('archive_docs')
        .update({ title, doc_date: docDate || null, doc_no: docNo || null,
          remark: JSON.stringify({ count: finalPhotos.length, photos: finalPhotos, subtitle }) })
        .eq('id', record.id);
      if (error) throw error;
      onSaved();
    } catch (err) { alert(`儲存失敗：${err.message}`); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!window.confirm(`確定刪除「${title}」？\n此操作無法復原。`)) return;
    setDeleting(true);
    const { error } = await supabase.from('archive_docs').delete().eq('id', record.id);
    setDeleting(false);
    if (error) alert(`刪除失敗：${error.message}`);
    else onDeleted();
  }

  function handlePrint() {
    const pages = [];
    for (let i = 0; i < photos.length; i += PHOTOS_PER_PAGE) {
      pages.push(
        photos.slice(i, i + PHOTOS_PER_PAGE).map(p => ({ photo: { url: p.url }, info: p }))
      );
    }
    openPrintWindow(
      buildReportHtml(pages, { title: projectName || title, docNo, subtitle }),
      `工程照片報告 ${docNo || title}`
    );
  }

  return (
    <div className="pt-detail-view">
      <div className="pt-detail-header">
        <button className="pt-btn" onClick={onBack}><ChevronLeft size={13} />返回列表</button>
        {locked
          ? <span className="pt-detail-badge locked"><Lock size={11} />已附日報（唯讀）</span>
          : <span className="pt-detail-badge edit">編輯照片記錄</span>
        }
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {SUBTITLE_OPTIONS.map(opt => (
            <button key={opt}
              className={`pt-btn${subtitle === opt ? ' pt-btn-primary' : ''}`}
              style={{ padding: '4px 10px', fontSize: '13px', opacity: (locked || isMaterial) ? 0.45 : 1, cursor: (locked || isMaterial) ? 'not-allowed' : 'pointer' }}
              disabled={locked || isMaterial}
              onClick={() => setSubtitle(opt)}>
              {opt}
            </button>
          ))}
          <button className="pt-btn" onClick={handlePrint}>
            <Printer size={13} />列印 / 另存 PDF
          </button>
          {locked
            ? <button className="pt-btn" onClick={onGoReportDB}><FileText size={13} />前往報表資料庫</button>
            : <>
                <button className="pt-btn pt-btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}儲存變更
                </button>
                <button className="pt-btn pt-btn-danger" onClick={handleDelete} disabled={deleting}>
                  {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}刪除
                </button>
              </>
          }
        </div>
      </div>

      <div className="pt-detail-body">
        <div className="pt-detail-section">
          <div className="pt-detail-fields">
            <div>
              <label className="form-label">批次標題</label>
              <input className="form-input" value={title} disabled={locked}
                onChange={e => setTitle(e.target.value)} style={{ marginTop: 4 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label className="form-label">紀錄日期</label>
                <input className="form-input" type="date" value={docDate} disabled={locked}
                  onChange={e => setDocDate(e.target.value)} style={{ marginTop: 4 }} />
              </div>
              <div style={{ gridColumn: '2 / -1' }}>
                <label className="form-label">記錄編號（報告掃描檔所示）</label>
                <input className="form-input" value={docNo} disabled={locked}
                  onChange={e => setDocNo(e.target.value)} style={{ marginTop: 4 }} />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-detail-section">
          <div className="pt-detail-photos-title">
            <Camera size={12} />照片明細（共 {photos.length} 張）
          </div>
          {/* 隱藏的更換照片 input */}
          <input ref={replaceInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => handleReplaceFile(e.target.files[0])} />

          {photos.map((p, i) => {
            const displaySrc = p._pendingPreview || p.url;
            return (
            <div key={i} className="pt-detail-photo-row">
              <div className="pt-detail-photo-num">#{i + 1}</div>
              <div className="pt-detail-photo-preview">
                {displaySrc
                  ? <img src={displaySrc} alt="" className="pt-detail-photo-img"
                      onError={e => { e.target.style.opacity = 0.2; }} />
                  : <div className="pt-detail-photo-placeholder">
                      <Camera size={20} style={{ opacity: 0.3 }} />
                    </div>
                }
                {!locked && (
                  <button className="pt-btn" style={{ fontSize: '13px', padding: '2px 8px' }}
                    onClick={() => triggerReplace(i)}>
                    <RefreshCw size={11} />更換
                  </button>
                )}
              </div>
              <div className="pt-detail-photo-fields" style={{ flex: 1 }}>
                <div>
                  <label className="form-label" style={{ fontSize: '13px' }}>拍攝位置</label>
                  <input className="form-input" value={p.location || ''} disabled={locked}
                    onChange={e => updatePhoto(i, 'location', e.target.value)} style={{ marginTop: 2, fontSize: '13px' }} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '13px' }}>日期</label>
                  <input className="form-input" type="date" value={p.date || ''} disabled={locked}
                    onChange={e => updatePhoto(i, 'date', e.target.value)} style={{ marginTop: 2, fontSize: '13px' }} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label" style={{ fontSize: '13px' }}>說明</label>
                  <textarea className="form-input" value={p.description || ''} disabled={locked}
                    onChange={e => updatePhoto(i, 'description', e.target.value)}
                    rows={2} style={{ marginTop: 2, fontSize: '13px', resize: 'none' }} />
                </div>
              </div>
            </div>
          );})}
          {photos.length === 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', padding: '12px 0' }}>無照片明細</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 照片記錄列表 ── */
function PhotoRecordDB({ projectId, projectName: _projectName, onNew, onAlbum, onDetail, srcCtx, autoOpen, filterMode, srcDate }) {
  const navigate = useNavigate();
  const [records,  setRecords]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [busy,     setBusy]     = useState(false);
  const selectAllRef = useRef(null);
  const autoOpenDone = useRef(false);

  /* inline 指附狀態 */
  const [attachingId,    setAttachingId]    = useState(null);
  const [attachType,     setAttachType]     = useState('');
  const [attachSrcRecs,  setAttachSrcRecs]  = useState([]);
  const [attachLoading,  setAttachLoading]  = useState(false);
  const [attachRecordId, setAttachRecordId] = useState('');

  function fetchRecords() {
    if (!projectId || !supabase) { setLoading(false); return; }
    setLoading(true);
    let q = supabase.from('archive_docs')
      .select('id, title, doc_date, doc_no, remark, tags, created_at, source_table, submission_id, photo_category')
      .eq('project_id', projectId).eq('category', 'photo')
      .order('doc_date', { ascending: false });
    if (filterMode === 'linked' && srcCtx?.srcTable && srcCtx?.srcId) {
      q = q.eq('source_table', srcCtx.srcTable).eq('submission_id', srcCtx.srcId);
    } else if (filterMode === 'date' && srcDate) {
      q = q.eq('doc_date', srcDate);
    }
    q.then(({ data }) => { setRecords(data || []); setLoading(false); });
  }

  useEffect(() => { fetchRecords(); }, [projectId, srcCtx?.srcId, filterMode, srcDate]);

  /* auto=open：只有一筆時自動進入詳情 */
  useEffect(() => {
    if (!autoOpenDone.current && autoOpen && !loading && records.length === 1) {
      autoOpenDone.current = true;
      onDetail(records[0]);
    }
  }, [records, loading, autoOpen]);

  async function loadSrcRecordsFor(tableKey) {
    if (!tableKey || !supabase) { setAttachSrcRecs([]); return; }
    setAttachLoading(true);
    const isMat = tableKey === 'material_entries';
    const nameField = isMat ? 'name' : 'work_item';
    const dateField = isMat ? 'entry_date' : 'inspect_date';
    const { data: recs } = await supabase.from(tableKey).select(`id, ${dateField}, ${nameField}`)
      .eq('project_id', projectId).order(dateField, { ascending: false }).order('created_at', { ascending: false }).limit(80);
    setAttachSrcRecs((recs || []).map(r => ({
      id: r.id,
      label: `${r[dateField] || '—'} · ${r[nameField] || '（無名稱）'}`,
    })));
    setAttachLoading(false);
  }

  async function handleAttach(rec) {
    const srcTagMap = { material_entries: '材料管制已附', construction_inspections: '施工抽查已附' };
    const newTags = [...(rec.tags || []), srcTagMap[attachType] || '已附記錄'];
    const { error } = await supabase.from('archive_docs').update({
      source_table: attachType,
      submission_id: attachRecordId,
      tags: newTags,
    }).eq('id', rec.id);
    if (!error) { setAttachingId(null); fetchRecords(); }
  }

  const SOURCE_LABEL = { material_entries: '材料管制', construction_inspections: '施工抽查' };

  const unattached = records.filter(r => !r.source_table && !r.tags?.includes('日報已附註'));
  const selectableIds = unattached.map(r => r.id);
  const allSel  = selectableIds.length > 0 && selectableIds.every(id => selected.has(id));
  const someSel = selectableIds.some(id => selected.has(id));

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSel && !allSel;
  }, [someSel, allSel]);

  function toggleAll() { setSelected(allSel ? new Set() : new Set(selectableIds)); }
  function toggleOne(id) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  async function bulkDelete() {
    const ids = [...selected].filter(id => unattached.find(r => r.id === id));
    if (!ids.length || !window.confirm(`確定刪除選取的 ${ids.length} 筆記錄？此操作無法復原。`)) return;
    setBusy(true);
    await Promise.all(ids.map(id => supabase.from('archive_docs').delete().eq('id', id)));
    setSelected(new Set()); setBusy(false); fetchRecords();
  }

  async function handleWithdraw(rec) {
    if (!window.confirm(`確定解除「${rec.title}」的來源連結？\n解除後可再次編輯。`)) return;
    const newTags = (rec.tags || []).filter(t => t !== '日報已附註' && t !== '材料管制已附' && t !== '施工抽查已附');
    const { error } = await supabase.from('archive_docs').update({ tags: newTags, source_table: null, submission_id: null }).eq('id', rec.id);
    if (!error) fetchRecords();
  }

  return (
    <div className="pt-step-list">
      {/* 新增按鈕列（標題已移至 Topbar pageLabel） */}
      <div className="pt-new-btn-bar">
        <button className="pt-big-btn pt-big-btn-primary" onClick={onNew}>
          <Plus size={20} />新增照片記錄
        </button>
        <button className="pt-big-btn" onClick={onAlbum}>
          <Images size={20} />相簿瀏覽
        </button>
        <span className="pt-tab-count" style={{ marginLeft: 8 }}>{records.length}</span>
      </div>

      {/* 來源 breadcrumb */}
      {srcCtx?.srcName && (
        <div className="pt-src-breadcrumb">
          <button className="pt-btn" onClick={() => navigate(-1)}><ArrowLeft size={12} />返回</button>
          <span className="pt-src-label">
            <Link2 size={12} />
            {SOURCE_LABEL[srcCtx.srcTable] || srcCtx.srcTable} ／ {decodeURIComponent(srcCtx.srcName)}
          </span>
        </div>
      )}

      {/* 批次刪除列 */}
      {someSel && (
        <div className="pt-bulk-bar">
          <span>已選 {selected.size} 筆</span>
          <button className="pt-btn pt-btn-danger" onClick={bulkDelete} disabled={busy}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}刪除所選
          </button>
        </div>
      )}

      {/* 表格：表頭 + 資料列（subgrid 自動欄寬） */}
      <div className="pt-record-table">
        <div className="pt-record-header">
          <span className="col-check">
            <input type="checkbox" ref={selectAllRef} checked={allSel}
              onChange={toggleAll} disabled={unattached.length === 0} />
          </span>
          <span className="col-status">狀態</span>
          <span className="col-title">標題</span>
          <span className="col-date">紀錄日期</span>
          <span className="col-docno">記錄編號</span>
          <span className="col-count">張數</span>
        </div>

      {loading ? (
        <div className="pt-list-loading" style={{ gridColumn: '1 / -1' }}><Loader2 size={14} className="animate-spin" />載入中…</div>
      ) : records.length === 0 ? (
        <div className="pt-list-empty" style={{ gridColumn: '1 / -1' }}>
          <Camera size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
          <div>尚無照片記錄</div>
          <div style={{ fontSize: '13px', marginTop: 4 }}>點擊「新增照片記錄」開始建立</div>
        </div>
      ) : records.map(rec => {
        const isAttached = !!(rec.source_table || rec.tags?.includes('日報已附註'));
        const srcLabel = SOURCE_LABEL[rec.source_table] || (rec.tags?.includes('日報已附註') ? '日報' : null);
        const info = parseRemark(rec.remark);
        return (
          <div key={rec.id}
            className={`pt-record-item ${isAttached ? 'locked' : ''} ${selected.has(rec.id) ? 'selected' : ''}`}
            onClick={() => onDetail(rec)}>
            <span className="col-check" onClick={e => e.stopPropagation()}>
              <input type="checkbox" checked={selected.has(rec.id)} disabled={isAttached}
                onChange={() => !isAttached && toggleOne(rec.id)} />
            </span>
            <div className="col-status" onClick={e => e.stopPropagation()}>
              {srcLabel ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
                  <span className="pt-log-tag attached"><Link2 size={10} />已附{srcLabel}</span>
                  <button className="pt-btn" style={{ padding: '1px 6px', fontSize: '12px' }}
                    onClick={() => handleWithdraw(rec)}><RotateCcw size={10} />抽回</button>
                </div>
              ) : attachingId === rec.id ? (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select value={attachType}
                    style={{ padding: '2px 5px', fontSize: '13px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text1)' }}
                    onChange={e => { setAttachType(e.target.value); setAttachRecordId(''); loadSrcRecordsFor(e.target.value); }}>
                    <option value="">指附…</option>
                    <option value="material_entries">材料管制</option>
                    <option value="construction_inspections">施工抽查</option>
                  </select>
                  {attachType && (
                    attachLoading ? <Loader2 size={12} className="animate-spin" />
                    : <select value={attachRecordId}
                        style={{ padding: '2px 5px', fontSize: '13px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text1)', maxWidth: 110 }}
                        onChange={e => setAttachRecordId(e.target.value)}>
                        <option value="">選記錄…</option>
                        {attachSrcRecs.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                  )}
                  {attachType && attachRecordId && (
                    <button className="pt-btn pt-btn-primary" style={{ padding: '2px 7px', fontSize: '13px' }}
                      onClick={() => handleAttach(rec)}><Check size={11} /></button>
                  )}
                  <button className="pt-btn" style={{ padding: '2px 7px', fontSize: '13px' }}
                    onClick={() => setAttachingId(null)}><X size={11} /></button>
                </div>
              ) : (
                <span className="pt-log-tag unlocked"
                  title="點擊指定附入來源"
                  onClick={() => { setAttachingId(rec.id); setAttachType(''); setAttachSrcRecs([]); setAttachRecordId(''); }}>
                  <FileText size={10} />指附日誌
                </span>
              )}
            </div>
            <div className="col-title pt-record-title">
              {rec.photo_category && <span className="pt-category-badge">{rec.photo_category}</span>}
              {rec.title}
            </div>
            <div className="col-date pt-record-meta">{toRocDate(rec.doc_date)}</div>
            <div className="col-docno pt-record-meta">{rec.doc_no || '—'}</div>
            <div className="col-count pt-record-meta">{info.count ?? 0} 張</div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

/* ── 選取照片（本機 / Google Drive 資料夾瀏覽）── */
function StepUpload({ onPhotosReady, onBack, driveRootId = '', projectId = '' }) {
  // 匯入瀏覽根資料夾：工程指定的 drive_folder_id 優先，未設定時回退全域資料夾
  const driveRoot = driveRootId || DRIVE_FOLDER_ID;
  // item: { id, previewUrl, blob, mimeType, exifDate, exifGps, driveWorkItem, driveCategory }
  const [items,      setItems]      = useState([]);
  // driveBrowse: null = 關閉；開啟時 = { token, loading, path, folders, images, importBusy, importStatus }
  const [driveBrowse, setDriveBrowse] = useState(null);
  const fileInputRef = useRef(null);

  /* 本機上傳 */
  async function handleLocalFiles(files) {
    for (const file of Array.from(files).filter(f => f.type.startsWith('image/'))) {
      const previewUrl = URL.createObjectURL(file);
      const { exifDate, exifGps } = await parseExif(file);
      setItems(prev => [...prev, {
        id: crypto.randomUUID(), previewUrl, blob: file,
        mimeType: file.type, exifDate, exifGps, driveWorkItem: '', driveCategory: '',
      }]);
    }
  }

  /* ── Drive 資料夾瀏覽器 ── */
  async function openDriveBrowser() {
    if (!GCLIENT_ID) { alert('尚未設定 VITE_GOOGLE_CLIENT_ID'); return; }
    if (!driveRoot)  { alert('此工程未設定雲端資料夾（請於「編輯工程」填入雲端資料夾 ID），且未設定全域 VITE_GOOGLE_DRIVE_FOLDER_ID'); return; }
    setDriveBrowse({ token: null, loading: true, path: [], folders: [], images: [], importBusy: false, importStatus: '' });
    try {
      const token = await getGoogleReadToken();
      // 優先還原上次瀏覽位置；資料夾已失效則清除記憶回根目錄
      const memPath = loadBrowseMemory(projectId)?.path;
      if (Array.isArray(memPath) && memPath.length) {
        try {
          const { folders, images } = await listDriveFolder(memPath[memPath.length - 1].id, token);
          setDriveBrowse({ token, loading: false, path: memPath, folders, images, importBusy: false, importStatus: '' });
          return;
        } catch { saveBrowseMemory(projectId, { path: [] }); }
      }
      const { folders, images } = await listDriveFolder(driveRoot, token);
      setDriveBrowse({ token, loading: false, path: [], folders, images, importBusy: false, importStatus: '' });
    } catch (e) {
      alert(`無法開啟 Drive：${e.message}`);
      setDriveBrowse(null);
    }
  }

  async function browseTo(folder) {
    setDriveBrowse(prev => ({ ...prev, loading: true }));
    try {
      const { folders, images } = await listDriveFolder(folder.id, driveBrowse.token);
      const newPath = [...driveBrowse.path, folder];
      saveBrowseMemory(projectId, { path: newPath });
      setDriveBrowse(prev => ({ ...prev, loading: false, path: newPath, folders, images }));
    } catch (e) {
      alert(`無法開啟資料夾：${e.message}`);
      setDriveBrowse(prev => ({ ...prev, loading: false }));
    }
  }

  async function browseBack(toIndex) {
    // toIndex = -1 → 回根目錄；≥0 → path[0..toIndex]
    setDriveBrowse(prev => ({ ...prev, loading: true }));
    try {
      const newPath = toIndex < 0 ? [] : driveBrowse.path.slice(0, toIndex + 1);
      const parentId = newPath.length ? newPath[newPath.length - 1].id : driveRoot;
      const { folders, images } = await listDriveFolder(parentId, driveBrowse.token);
      saveBrowseMemory(projectId, { path: newPath });
      setDriveBrowse(prev => ({ ...prev, loading: false, path: newPath, folders, images }));
    } catch {
      setDriveBrowse(prev => ({ ...prev, loading: false }));
    }
  }

  async function importCurrentFolder() {
    const imgs = driveBrowse.images;
    if (!imgs.length) return;
    const { driveDate, driveWorkItem, driveCategory } = parsePathMeta(driveBrowse.path);
    setDriveBrowse(prev => ({ ...prev, importBusy: true, importStatus: '' }));
    try {
      for (let i = 0; i < imgs.length; i++) {
        setDriveBrowse(prev => ({ ...prev, importStatus: `下載第 ${i + 1} / ${imgs.length} 張…` }));
        const blob = await downloadDriveFile(imgs[i].id, driveBrowse.token);
        const file = new File([blob], imgs[i].name || `photo_${i + 1}.jpg`, { type: blob.type || 'image/jpeg' });
        const previewUrl = URL.createObjectURL(blob);
        const { exifDate, exifGps } = await parseExif(file);
        setItems(prev => [...prev, {
          id: crypto.randomUUID(), previewUrl, blob: file,
          mimeType: file.type,
          exifDate: driveDate || exifDate,   // 資料夾日期優先
          exifGps,
          driveWorkItem,
          driveCategory,
        }]);
      }
      setDriveBrowse(null);  // 匯入完成後關閉瀏覽器
    } catch (e) {
      alert(`匯入失敗：${e.message}`);
      setDriveBrowse(prev => ({ ...prev, importBusy: false, importStatus: '' }));
    }
  }

  /* 繼續到填資料步驟 */
  function handleNext() {
    onPhotosReady(items.map(item => ({
      id:            item.id,
      src:           item.previewUrl,
      blob:          item.blob,
      mimeType:      item.mimeType,
      exifDate:      item.exifDate,
      exifGps:       item.exifGps,
      driveWorkItem: item.driveWorkItem || '',
      driveCategory: item.driveCategory || '',
    })));
  }

  return (
    <div className="pt-step-upload">
      {/* 照片來源按鈕 */}
      <div className="pt-upload-sources">
        <button className="pt-upload-source-btn" onClick={() => fileInputRef.current?.click()}>
          <Upload size={22} /><span>從電腦 / 手機上傳</span>
        </button>
        <button className="pt-upload-source-btn" onClick={openDriveBrowser}>
          <Cloud size={22} /><span>從 Google Drive 匯入</span>
        </button>
        <input ref={fileInputRef} type="file" multiple accept="image/*" style={{ display: 'none' }}
          onChange={e => handleLocalFiles(e.target.files)} />
      </div>

      {/* Drive 資料夾瀏覽器 */}
      {driveBrowse && (
        <div className="pt-drive-browser">
          {/* 麵包屑 */}
          <div className="pt-drive-breadcrumb">
            <button onClick={() => browseBack(-1)}>根目錄</button>
            {driveBrowse.path.map((seg, i) => (
              <span key={seg.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span className="pt-drive-bc-sep">›</span>
                <button onClick={() => browseBack(i)}>{seg.name}</button>
              </span>
            ))}
          </div>

          {driveBrowse.loading ? (
            <div className="pt-drive-loading"><Loader2 size={14} className="pt-spin" />載入中…</div>
          ) : (
            <>
              {/* 子資料夾清單 */}
              {driveBrowse.folders.length > 0 && (
                <div className="pt-drive-folder-list">
                  {driveBrowse.folders.map(f => (
                    <button key={f.id} className="pt-drive-folder-btn" onClick={() => browseTo(f)}>
                      <FolderOpen size={15} /><span>{f.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* 圖片匯入列 */}
              {driveBrowse.images.length > 0 && (
                <div className="pt-drive-import-row">
                  <span>此資料夾有 <strong>{driveBrowse.images.length}</strong> 張照片</span>
                  <button onClick={importCurrentFolder} disabled={driveBrowse.importBusy}>
                    {driveBrowse.importBusy
                      ? <><Loader2 size={13} className="pt-spin" />{driveBrowse.importStatus || '匯入中…'}</>
                      : <>匯入全部 {driveBrowse.images.length} 張</>}
                  </button>
                </div>
              )}

              {driveBrowse.folders.length === 0 && driveBrowse.images.length === 0 && (
                <div className="pt-drive-empty">此資料夾為空</div>
              )}
            </>
          )}

          <button className="pt-drive-close" onClick={() => setDriveBrowse(null)}>
            <X size={12} />關閉瀏覽器
          </button>
        </div>
      )}

      {/* 已選照片縮圖列 */}
      {items.length > 0 && (
        <div className="pt-thumb-grid">
          {items.map((item, i) => (
            <div key={item.id} className="pt-thumb-cell">
              <img src={item.previewUrl} alt="" className="pt-thumb-img" />
              <button className="pt-thumb-remove" onClick={() => setItems(prev => prev.filter(x => x.id !== item.id))}>
                <X size={11} />
              </button>
              <div style={{ position: 'absolute', bottom: 2, left: 3, fontSize: '13px', background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '2px 5px', borderRadius: 4 }}>
                #{i + 1}
              </div>
              {item.exifDate && (
                <div className="pt-thumb-exif"
                  title={`日期：${item.exifDate}${item.driveWorkItem ? '\n工項：' + item.driveWorkItem : ''}${item.exifGps ? '\nGPS：' + item.exifGps : ''}`}>
                  <Zap size={9} />{item.driveWorkItem ? 'Drive' : item.exifGps ? 'GPS+日' : '日期'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="pt-upload-actions">
        <button className="pt-btn" onClick={onBack}><RotateCcw size={13} />返回列表</button>
        {items.length > 0 && (
          <button className="pt-btn pt-btn-primary" style={{ marginLeft: 'auto' }} onClick={handleNext}>
            <Check size={14} />開始填寫資料（{items.length} 張）
          </button>
        )}
      </div>
    </div>
  );
}

/* ── 雲端相簿瀏覽（唯讀：只瀏覽 Drive 照片，不下載、不上傳、不寫入） ── */
function albumThumbUrl(img) {
  return img.thumbnailLink || `https://drive.google.com/thumbnail?id=${img.id}&sz=w400`;
}
function albumLargeUrl(img) {
  // thumbnailLink 結尾為 =s220 之類的尺寸參數，放大取代即可取得大圖
  if (img.thumbnailLink) return img.thumbnailLink.replace(/=s\d+(-c)?$/, '=s1600');
  return `https://drive.google.com/thumbnail?id=${img.id}&sz=w1600`;
}

const DATE_SCAN_EMPTY = { loading: false, loaded: false, error: '', progress: '', groups: [], flat: [] };
const dateScanCache = new Map();   // key = driveRoot，同一 session 內快取日期掃描結果

function DriveAlbum({ projectId = '', driveRootId = '', onBack }) {
  const driveRoot = driveRootId || DRIVE_FOLDER_ID;
  // album: { token, loading, error, path, folders, images }
  const [album, setAlbum] = useState(() => ({
    token: null, loading: !!driveRoot,
    error: driveRoot ? '' : '此工程未設定雲端資料夾（請於「編輯工程」填入雲端資料夾 ID），且未設定全域 VITE_GOOGLE_DRIVE_FOLDER_ID',
    path: [], folders: [], images: [],
  }));
  // date = 日期條列瀏覽；folder = 資料夾瀏覽（記住上次模式，無記憶預設資料夾瀏覽）
  const [mode, setMode] = useState(() => loadBrowseMemory(projectId)?.mode || 'folder');
  // dateScan: { loading, loaded, error, progress, groups: [{ date, items, start }], flat }
  const [dateScan, setDateScan] = useState(() => dateScanCache.get(driveRoot) || DATE_SCAN_EMPTY);
  const [lightbox, setLightbox] = useState(null); // null 或目前清單索引

  /* 進入時授權並載入資料夾（優先還原上次瀏覽位置，失效則清除記憶回根目錄） */
  useEffect(() => {
    if (!driveRoot) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getGoogleReadToken();
        const memPath = loadBrowseMemory(projectId)?.path;
        if (Array.isArray(memPath) && memPath.length) {
          try {
            const { folders, images } = await listDriveFolder(memPath[memPath.length - 1].id, token);
            if (!cancelled) setAlbum({ token, loading: false, error: '', path: memPath, folders, images });
            return;
          } catch { saveBrowseMemory(projectId, { path: [] }); }
        }
        const { folders, images } = await listDriveFolder(driveRoot, token);
        if (!cancelled) setAlbum({ token, loading: false, error: '', path: [], folders, images });
      } catch (e) {
        if (!cancelled) setAlbum(prev => ({ ...prev, loading: false, error: `無法開啟相簿：${e.message}` }));
      }
    })();
    return () => { cancelled = true; };
  }, [driveRoot, projectId]);

  /* 日期模式：遞迴掃描全部照片，依日期新→舊分組條列 */
  useEffect(() => {
    if (mode !== 'date' || !album.token || dateScan.loaded || dateScan.loading) return;
    let cancelled = false;
    setDateScan(prev => ({ ...prev, loading: true, error: '', progress: '掃描中…' }));
    (async () => {
      try {
        const byDate = new Map();
        const queue = [{ id: driveRoot, path: [] }];
        let folderN = 0, imageN = 0;
        while (queue.length) {
          if (cancelled) return;
          const { id, path } = queue.shift();
          const { folders, images } = await listDriveFolder(id, album.token);
          folderN++;
          const { driveDate, driveWorkItem } = parsePathMeta(path);
          for (const img of images) {
            imageN++;
            const key = driveDate || '';
            if (!byDate.has(key)) byDate.set(key, []);
            byDate.get(key).push({ ...img, workItem: driveWorkItem });
          }
          // 結構深度：類別 → 工項 → 日期，最多再往下一層保險
          if (path.length < 4) for (const f of folders) queue.push({ id: f.id, path: [...path, f] });
          if (!cancelled) setDateScan(prev => ({ ...prev, progress: `掃描中…已掃 ${folderN} 個資料夾、${imageN} 張照片` }));
        }
        let offset = 0;
        const groups = [...byDate.entries()]
          .sort((a, b) => (b[0] || '0000').localeCompare(a[0] || '0000'))
          .map(([date, items]) => {
            items.sort((x, y) => (x.workItem || '').localeCompare(y.workItem || '') || (x.name || '').localeCompare(y.name || ''));
            const g = { date, items, start: offset };
            offset += items.length;
            return g;
          });
        const flat = groups.flatMap(g => g.items);
        const done = { loading: false, loaded: true, error: '', progress: '', groups, flat };
        dateScanCache.set(driveRoot, done);
        if (!cancelled) setDateScan(done);
      } catch (e) {
        if (!cancelled) setDateScan(prev => ({ ...prev, loading: false, error: `掃描失敗：${e.message}` }));
      }
    })();
    return () => { cancelled = true; };
  }, [mode, album.token, dateScan.loaded, dateScan.loading, driveRoot]);

  async function openFolder(folderId, newPath) {
    setAlbum(prev => ({ ...prev, loading: true }));
    try {
      const { folders, images } = await listDriveFolder(folderId, album.token);
      setLightbox(null);
      saveBrowseMemory(projectId, { path: newPath });
      setAlbum(prev => ({ ...prev, loading: false, path: newPath, folders, images }));
    } catch (e) {
      alert(`無法開啟資料夾：${e.message}`);
      setAlbum(prev => ({ ...prev, loading: false }));
    }
  }
  function goTo(folder) { openFolder(folder.id, [...album.path, folder]); }
  function goUp(toIndex) {
    // toIndex = -1 → 回根目錄；≥0 → path[0..toIndex]
    const newPath = toIndex < 0 ? [] : album.path.slice(0, toIndex + 1);
    openFolder(newPath.length ? newPath[newPath.length - 1].id : driveRoot, newPath);
  }
  function switchMode(m) {
    setMode(m); setLightbox(null);
    saveBrowseMemory(projectId, { mode: m });
  }
  function rescanDates() {
    dateScanCache.delete(driveRoot);
    setDateScan(DATE_SCAN_EMPTY);   // loaded 重設後掃描 effect 會自動重跑
  }

  /* 燈箱清單：日期模式用掃描後的全量清單，資料夾模式用當前資料夾 */
  const lbList = mode === 'date' ? dateScan.flat : album.images;

  /* 燈箱鍵盤操作：← → 換張、Esc 關閉 */
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setLightbox(null);
      else if (e.key === 'ArrowLeft')  setLightbox(i => Math.max(0, i - 1));
      else if (e.key === 'ArrowRight') setLightbox(i => Math.min(lbList.length - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, lbList.length]);

  const lbImg = lightbox !== null ? lbList[lightbox] : null;

  return (
    <div className="pt-album-view">
      <div className="pt-album-toolbar">
        <button className="pt-btn" onClick={onBack}><ChevronLeft size={13} />返回列表</button>
        <span className="pt-album-title"><Images size={14} />雲端相簿瀏覽</span>
        <div className="pt-album-mode">
          <button className={`pt-btn${mode === 'date' ? ' pt-btn-primary' : ''}`}
            onClick={() => switchMode('date')}>
            <CalendarDays size={13} />日期瀏覽
          </button>
          <button className={`pt-btn${mode === 'folder' ? ' pt-btn-primary' : ''}`}
            onClick={() => switchMode('folder')}>
            <FolderOpen size={13} />資料夾瀏覽
          </button>
          {mode === 'date' && dateScan.loaded && (
            <button className="pt-btn" onClick={rescanDates} title="清除快取並重新掃描全部照片">
              <RotateCcw size={13} />重新掃描
            </button>
          )}
        </div>
        <span className="pt-album-hint">唯讀瀏覽，不會下載或變更任何檔案</span>
      </div>

      {/* 麵包屑（資料夾模式） */}
      {mode === 'folder' && (
        <div className="pt-drive-breadcrumb">
          <button onClick={() => goUp(-1)}>根目錄</button>
          {album.path.map((seg, i) => (
            <span key={seg.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span className="pt-drive-bc-sep">›</span>
              <button onClick={() => goUp(i)}>{seg.name}</button>
            </span>
          ))}
        </div>
      )}

      {album.error ? (
        <div className="pt-drive-empty">{album.error}</div>
      ) : mode === 'date' ? (
        /* ── 日期條列瀏覽 ── */
        (album.loading || dateScan.loading) ? (
          <div className="pt-drive-loading"><Loader2 size={14} className="pt-spin" />{dateScan.progress || '載入中…'}</div>
        ) : dateScan.error ? (
          <div className="pt-drive-empty">{dateScan.error}</div>
        ) : dateScan.flat.length === 0 ? (
          <div className="pt-drive-empty">雲端資料夾內沒有照片</div>
        ) : (
          <>
            <div className="pt-album-count">共 {dateScan.flat.length} 張照片，依日期由新至舊條列，點擊可放大檢視</div>
            {dateScan.groups.map(g => (
              <div key={g.date || 'none'} className="pt-album-date-group">
                <div className="pt-album-date-header">
                  <CalendarDays size={14} />
                  <span className="pt-album-date-label">{g.date ? toRocDate(g.date) : '未依日期歸檔'}</span>
                  <span className="pt-album-date-count">{g.items.length} 張</span>
                </div>
                <div className="pt-album-list">
                  {g.items.map((img, i) => (
                    <button key={img.id} className="pt-album-list-row" onClick={() => setLightbox(g.start + i)}>
                      <img className="pt-album-list-thumb" src={albumThumbUrl(img)} alt={img.name} loading="lazy" referrerPolicy="no-referrer"
                        onError={e => { e.target.style.opacity = 0.15; }} />
                      <span className="pt-album-list-info">
                        {img.workItem && <span className="pt-category-badge">{img.workItem}</span>}
                        <span className="pt-album-list-name" title={img.name}>{img.name}</span>
                      </span>
                      <ChevronRight size={14} className="pt-album-list-arrow" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )
      ) : album.loading ? (
        <div className="pt-drive-loading"><Loader2 size={14} className="pt-spin" />載入中…</div>
      ) : (
        <>
          {/* 子資料夾清單 */}
          {album.folders.length > 0 && (
            <div className="pt-drive-folder-list">
              {album.folders.map(f => (
                <button key={f.id} className="pt-drive-folder-btn" onClick={() => goTo(f)}>
                  <FolderOpen size={15} /><span>{f.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* 照片縮圖牆 */}
          {album.images.length > 0 && (
            <>
              <div className="pt-album-count">此資料夾共 {album.images.length} 張照片，點擊可放大檢視</div>
              <div className="pt-album-grid">
                {album.images.map((img, i) => (
                  <button key={img.id} className="pt-album-cell" onClick={() => setLightbox(i)}>
                    <img src={albumThumbUrl(img)} alt={img.name} loading="lazy" referrerPolicy="no-referrer"
                      onError={e => { e.target.style.opacity = 0.15; }} />
                    <span className="pt-album-cell-name">{img.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {album.folders.length === 0 && album.images.length === 0 && (
            <div className="pt-drive-empty">此資料夾為空</div>
          )}
        </>
      )}

      {/* 燈箱 */}
      {lbImg && (
        <div className="pt-album-lightbox" onClick={() => setLightbox(null)}>
          <button className="pt-album-lb-close" onClick={() => setLightbox(null)}><X size={18} /></button>
          {lightbox > 0 && (
            <button className="pt-album-lb-nav pt-album-lb-prev"
              onClick={e => { e.stopPropagation(); setLightbox(i => i - 1); }}>
              <ChevronLeft size={22} />
            </button>
          )}
          <img src={albumLargeUrl(lbImg)} alt={lbImg.name} referrerPolicy="no-referrer"
            onClick={e => e.stopPropagation()} />
          {lightbox < lbList.length - 1 && (
            <button className="pt-album-lb-nav pt-album-lb-next"
              onClick={e => { e.stopPropagation(); setLightbox(i => i + 1); }}>
              <ChevronRight size={22} />
            </button>
          )}
          <div className="pt-album-lb-caption">
            <span>{lbImg.workItem ? `${lbImg.workItem}｜${lbImg.name}` : lbImg.name}</span>
            <span>{lightbox + 1} / {lbList.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 填資料 ── */
const PHOTO_CATEGORIES = ['材料進場', '施工抽查', '查驗記錄', '會勘紀錄', '其他'];

async function toBase64(src, blob) {
  const target = blob || await fetch(src).then(r => r.blob());
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res({ base64: reader.result.split(',')[1], mime: target.type || 'image/jpeg' });
    reader.onerror = rej;
    reader.readAsDataURL(target);
  });
}

function parseWhiteboardText(text) {
  const result = { work_item: null, location: null, date: null, description: null, category: null };

  const get = (patterns) => {
    for (const p of patterns) {
      const m = text.match(new RegExp(`(?:${p})[：:﹕]\\s*([^\\n\\r]+)`));
      if (m) return m[1].trim();
    }
    return null;
  };

  result.work_item  = get(['工程項目', '工項', '項目']);
  result.location   = get(['施工部位', '部位', '位置', '施工位置', '施工區域']);
  result.description = get(['施工說明', '說明', '備註', '工作說明', '抽查說明']);

  // 日期：民國年 or 西元年
  const rocM = text.match(/(?:日期|施工日期|檢驗日期)[：:﹕]?\s*(\d{2,3})[/\-年](\d{1,2})[/\-月](\d{1,2})/);
  if (rocM) {
    const y = parseInt(rocM[1]) < 1000 ? parseInt(rocM[1]) + 1911 : parseInt(rocM[1]);
    result.date = `${y}-${String(rocM[2]).padStart(2,'0')}-${String(rocM[3]).padStart(2,'0')}`;
  } else {
    const wM = text.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (wM) result.date = `${wM[1]}-${String(wM[2]).padStart(2,'0')}-${String(wM[3]).padStart(2,'0')}`;
  }

  // 類別關鍵詞比對
  for (const cat of ['材料進場', '施工抽查', '查驗記錄', '會勘紀錄']) {
    if (text.includes(cat)) { result.category = cat; break; }
  }

  return result;
}

function StepEntry({ photos, onComplete, onBack }) {
  const [index, setIndex] = useState(0);
  const [photoCategory, setPhotoCategory] = useState(() => {
    const first = photos.find(p => p.driveCategory);
    return first?.driveCategory || '';
  });
  const [data, setData] = useState(() => photos.map(p => ({
    date: p.exifDate || todayISO(),
    location: '',
    description: p.driveWorkItem || '',
    gps: p.exifGps || '',
  })));
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState('');

  function update(f, v) { setData(prev => prev.map((d, i) => i === index ? { ...d, [f]: v } : d)); }

  async function recognizeWhiteboard() {
    if (scanning) return;
    setScanning(true);
    setScanMsg('');
    try {
      const cur = photos[index];
      const { base64 } = await toBase64(cur.src, cur.blob);

      const res = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${GAPI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{ image: { content: base64 }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] }],
          }),
        }
      );
      const json = await res.json();
      const fullText = json.responses?.[0]?.fullTextAnnotation?.text || '';
      if (!fullText) { setScanMsg('未偵測到文字'); return; }

      const result = parseWhiteboardText(fullText);
      setData(prev => prev.map((d, i) => {
        if (i !== index) return d;
        const desc = result.work_item && !result.description
          ? result.work_item
          : result.work_item && result.description
          ? `${result.work_item} — ${result.description}`
          : result.description || d.description;
        return {
          ...d,
          location: result.location || d.location,
          description: desc || d.description,
          date: result.date || d.date,
        };
      }));
      if (result.category && PHOTO_CATEGORIES.includes(result.category)) setPhotoCategory(result.category);
      const hits = [result.work_item, result.location, result.date].filter(Boolean).length;
      setScanMsg(hits > 0 ? `識別完成，填入 ${hits} 項資訊` : '未偵測到白板欄位');
    } catch {
      setScanMsg('識別失敗，請手動填寫');
    } finally {
      setScanning(false);
    }
  }

  // 前往下一張時，若下一張位置/說明為空，自動帶入當前值（暫存）
  function goNext() {
    setData(prev => prev.map((d, i) => {
      if (i !== index + 1) return d;
      return {
        ...d,
        location: d.location || prev[index].location,
        description: d.description || prev[index].description,
      };
    }));
    setIndex(i => i + 1);
  }

  const cur = photos[index], curD = data[index];

  return (
    <div className="pt-step-entry">
      <div className="pt-entry-header">
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text1)' }}>填寫照片資料</span>
        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{index + 1} / {photos.length}</span>
      </div>
      <div className="pt-entry-body">
        <div className="pt-entry-preview">
          <img src={cur.src} alt="" style={{ maxWidth: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 6 }}
            onError={e => { e.target.style.opacity = 0.2; }} />
          <div className="pt-scan-bar">
            <button className="pt-scan-btn" onClick={recognizeWhiteboard} disabled={scanning}>
              {scanning ? <Loader2 size={12} className="animate-spin" /> : <ScanLine size={12} />}
              {scanning ? '識別中…' : '識別白板'}
            </button>
            {scanMsg && <span className="pt-scan-msg">{scanMsg}</span>}
          </div>
        </div>
        <div className="pt-entry-fields">
          <div>
            <label className="form-label">類別</label>
            <select className="form-input" value={photoCategory} onChange={e => setPhotoCategory(e.target.value)} style={{ marginTop: 4 }}>
              <option value="">請選擇類別</option>
              {PHOTO_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              拍攝日期
              {cur.exifDate && (
                <span style={{ fontSize: '13px', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Zap size={10} />{cur.driveWorkItem ? 'Drive 資料夾' : 'EXIF'}自動帶入
                </span>
              )}
            </label>
            <input className="form-input" type="date" value={curD.date} onChange={e => update('date', e.target.value)} style={{ marginTop: 4 }} />
          </div>
          {curD.gps && (
            <div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={11} />GPS 座標</label>
              <div style={{ marginTop: 4, padding: '4px 8px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 5, fontSize: '0.72rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{curD.gps}</div>
            </div>
          )}
          <div>
            <label className="form-label">拍攝位置</label>
            <input className="form-input" placeholder="例：B棟1F柱位 A3" value={curD.location} onChange={e => update('location', e.target.value)} style={{ marginTop: 4 }} />
          </div>
          <div>
            <label className="form-label">說明</label>
            <textarea className="form-input" rows={4} placeholder="施工說明、查驗結果…" value={curD.description}
              onChange={e => update('description', e.target.value)} style={{ marginTop: 4, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
        </div>
      </div>
      <div className="pt-entry-nav">
        <button className="pt-btn" onClick={onBack}><RotateCcw size={13} />重新上傳</button>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button className="pt-btn" disabled={index === 0} onClick={() => setIndex(i => i - 1)}><ChevronLeft size={14} />上一張</button>
          {index < photos.length - 1
            ? <button className="pt-btn pt-btn-primary" onClick={goNext}>下一張<ChevronRight size={14} /></button>
            : <button className="pt-btn pt-btn-primary" onClick={() => onComplete(data, photoCategory)}><Check size={14} />產生報告</button>
          }
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 8 }}>
        {photos.map((_, i) => (
          <div key={i} onClick={() => setIndex(i)} style={{ width: 8, height: 8, borderRadius: '50%', cursor: 'pointer', background: i === index ? 'var(--color-primary)' : 'var(--color-border)', transition: 'background 0.15s' }} />
        ))}
      </div>
    </div>
  );
}

const SUBTITLE_OPTIONS = ['施工抽查紀錄', '材料抽查紀錄'];

const SOURCE_TYPE_OPTIONS = [
  { value: '',                     label: '（僅歸檔，不附入）' },
  { value: 'material_entries',     label: '附入材料管制' },
  { value: 'construction_inspections', label: '附入施工抽查' },
];

/* ── 報告預覽 ── */
function StepReport({ photos, data, projectName, batchTitle, reportNo, setReportNo: _setReportNo, projectId, driveRootId = '', onBack, onSaved, srcCtx, photoCategory }) {
  const isMaterial = srcCtx?.srcTable === 'material_entries';
  const [saving,         setSaving]         = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [subtitle,       setSubtitle]       = useState(isMaterial ? SUBTITLE_OPTIONS[1] : SUBTITLE_OPTIONS[0]);
  // 附入來源（獨立開啟時顯示）
  const [srcTypeChoice,  setSrcTypeChoice]  = useState('');
  const [srcRecords,     setSrcRecords]     = useState([]);
  const [srcRecordId,    setSrcRecordId]    = useState('');
  const [srcWorkItem,    setSrcWorkItem]    = useState('');
  const [srcLoading,     setSrcLoading]     = useState(false);

  const pages = [];
  for (let i = 0; i < photos.length; i += PHOTOS_PER_PAGE) {
    pages.push(photos.slice(i, i + PHOTOS_PER_PAGE).map((p, j) => ({ photo: p, info: data[i + j] })));
  }

  async function loadSrcRecords(tableKey) {
    if (!tableKey || !supabase) { setSrcRecords([]); return; }
    setSrcLoading(true);
    const isMat = tableKey === 'material_entries';
    const nameField = isMat ? 'name' : 'work_item';
    const dateField = isMat ? 'entry_date' : 'inspect_date';
    const { data: recs } = await supabase.from(tableKey).select(`id, ${dateField}, ${nameField}`)
      .eq('project_id', projectId).order(dateField, { ascending: false }).order('created_at', { ascending: false }).limit(80);
    setSrcRecords((recs || []).map(r => ({
      id: r.id,
      label: `${r[dateField] || '—'} · ${r[nameField] || '（無名稱）'}`,
      workItem: r[nameField] || '',
    })));
    setSrcRecordId('');
    setSrcWorkItem('');
    setSrcLoading(false);
  }

  function handleSrcTypeChange(val) {
    setSrcTypeChoice(val);
    loadSrcRecords(val);
  }

  function handlePrint() {
    openPrintWindow(
      buildReportHtml(pages, { title: projectName || batchTitle || '工程名稱', docNo: reportNo, subtitle }),
      `工程照片報告 ${reportNo || batchTitle || ''}`
    );
  }

  async function handleSave() {
    if (!projectId || !supabase) return;
    setSaving(true);
    try {
      let token = null;
      const needUpload = photos.some(p => p.blob);
      if (needUpload) {
        token = await getGoogleToken().catch(e => { throw new Error(`Google 授權失敗：${e.message}`); });
      }

      const photoDetails = await Promise.all(data.map(async (d, i) => {
        const p = photos[i] || {};
        let url = p.url || '';
        if (p.blob && token) {
          const effectiveWorkItem = srcCtx?.workItem || srcWorkItem || '';
          url = await uploadToDrive(p.blob, p.mimeType || 'image/jpeg', token, d.date, photoCategory || '', effectiveWorkItem, driveRootId);
        }
        return { location: d.location, description: d.description, date: d.date, gps: d.gps, url };
      }));

      // 決定 source_table / submission_id / tags
      const effectiveSrcTable = srcCtx?.srcTable || (srcTypeChoice || null);
      const effectiveSrcId    = srcCtx?.srcId    || (srcTypeChoice && srcRecordId ? srcRecordId : null);
      const srcTagMap = { material_entries: '材料管制已附', construction_inspections: '施工抽查已附' };
      const tags = effectiveSrcTable ? [srcTagMap[effectiveSrcTable] || '已附記錄'] : [];

      const title = batchTitle || `${data[0]?.date || todayISO()} 施工照片（${photos.length}張）`;
      const { error } = await supabase.from('archive_docs').insert({
        project_id: projectId, category: 'photo', title,
        doc_no: reportNo || null, doc_date: data[0]?.date || todayISO(),
        remark: JSON.stringify({ count: photos.length, photos: photoDetails, subtitle }),
        file_url: photoDetails[0]?.url || null,
        tags,
        source_table: effectiveSrcTable || null,
        submission_id: effectiveSrcId || null,
        photo_category: photoCategory || null,
      });
      if (error) throw error;
      setSaved(true);
      setTimeout(() => onSaved(), 1200);
    } catch (err) { alert(`儲存失敗：${err.message}`); }
    finally { setSaving(false); }
  }

  return (
    <div className="pt-step-report">
      <div className="pt-report-toolbar no-print">
        <button className="pt-btn" onClick={onBack}><RotateCcw size={13} />返回編輯</button>
        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          共 {photos.length} 張 / {pages.length} 頁
        </span>
        {/* 副標題選擇 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {SUBTITLE_OPTIONS.map(opt => (
            <button key={opt}
              className={`pt-btn${subtitle === opt ? ' pt-btn-primary' : ''}`}
              style={{ padding: '4px 10px', fontSize: '13px', opacity: isMaterial ? 0.45 : 1, cursor: isMaterial ? 'not-allowed' : 'pointer' }}
              disabled={isMaterial}
              onClick={() => setSubtitle(opt)}>
              {opt}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 附入來源 */}
          {srcCtx?.srcName ? (
            <span style={{ fontSize: '13px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Link2 size={11} />附入：{decodeURIComponent(srcCtx.srcName)}
            </span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <select value={srcTypeChoice} onChange={e => handleSrcTypeChange(e.target.value)}
                style={{ padding: '3px 6px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 5, fontSize: '13px', color: 'var(--color-text1)' }}>
                {SOURCE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {srcTypeChoice && (
                srcLoading
                  ? <Loader2 size={12} className="animate-spin" />
                  : <select value={srcRecordId} onChange={e => { setSrcRecordId(e.target.value); setSrcWorkItem(srcRecords.find(r => r.id === e.target.value)?.workItem || ''); }}
                      style={{ padding: '3px 6px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 5, fontSize: '13px', color: 'var(--color-text1)', maxWidth: 160 }}>
                      <option value="">選擇記錄…</option>
                      {srcRecords.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
              )}
            </div>
          )}
          <button className="pt-btn" onClick={handleSave} disabled={saving || saved}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saved ? '已存檔' : '儲存至系統'}
          </button>
          <button className="pt-btn pt-btn-primary" onClick={handlePrint}>
            <Printer size={13} />列印 / 另存 PDF
          </button>
        </div>
      </div>

      {/* 螢幕預覽 */}
      {pages.map((page, pi) => (
        <div key={pi} className="report-page">
          <div className="report-header">
            <div className="report-header-left" />
            <div className="report-header-center">
              <h1>{projectName || '工程名稱'}</h1>
              <h2>{subtitle}</h2>
            </div>
            <div className="report-header-right">
              {reportNo && <div>編號：{reportNo}</div>}
              <div>第 {pi + 1} 頁</div>
            </div>
          </div>
          <table className="report-table-b"><tbody>
            {page.map((item, ci) => (
              <React.Fragment key={ci}>
                <tr className="report-block-b">
                  <td className="photo-cell-b">
                    <img src={item.photo.src} alt={`照片 ${pi * PHOTOS_PER_PAGE + ci + 1}`} />
                  </td>
                  <td className="info-cell-b">
                    <div className="info-location">{item.info.location || '（無位置說明）'}</div>
                    <div className="info-date">{toRocDate(item.info.date)}</div>
                  </td>
                </tr>
                <tr className="description-row-b">
                  <td colSpan={2} className="desc-cell-b">說明：{item.info.description || ''}</td>
                </tr>
              </React.Fragment>
            ))}
          </tbody></table>
        </div>
      ))}
    </div>
  );
}

/* ── 主元件 ── */
export function PhotoTable() {
  const { id: projectId } = useParams();
  const { project }       = useProject(projectId);
  const [searchParams]    = useSearchParams();
  const autoParam = searchParams.get('auto') || '';
  const [view,        setView]        = useState(autoParam === 'new' ? 'upload' : 'list');
  const [detailRec,   setDetailRec]   = useState(null);
  const [photos,        setPhotos]        = useState([]);
  const [photoData,     setPhotoData]     = useState([]);
  const [photoCategory, setPhotoCategory] = useState('');
  const [reportNo,      setReportNo]      = useState('');
  const [batchTitle,    setBatchTitle]    = useState('');
  const [refreshKey,    setRefreshKey]    = useState(0);

  const srcCtx = {
    srcTable: searchParams.get('src_table') || '',
    srcId:    searchParams.get('src_id')    || '',
    srcName:  searchParams.get('src_name')  || '',
  };
  const srcDate = searchParams.get('src_date') || '';
  const filterMode = autoParam === 'open' ? 'linked' : autoParam === 'date' ? 'date' : 'all';

  /* 自動產生流水號：民國 YYY/MM/DD-NNN */
  useEffect(() => {
    if (view !== 'report' || reportNo || !projectId) return;
    const date = photoData[0]?.date || todayISO();
    const dt = new Date(date + 'T00:00:00');
    const roc = dt.getFullYear() - 1911;
    const mm  = String(dt.getMonth() + 1).padStart(2, '0');
    const dd  = String(dt.getDate()).padStart(2, '0');
    const prefix = `${roc}/${mm}/${dd}-`;
    supabase.from('archive_docs')
      .select('doc_no')
      .eq('project_id', projectId)
      .eq('category', 'photo')
      .like('doc_no', `${prefix}%`)
      .then(({ data }) => {
        let max = 0;
        for (const row of (data || [])) {
          const n = parseInt((row.doc_no || '').slice(prefix.length));
          if (!isNaN(n) && n > max) max = n;
        }
        setReportNo(`${prefix}${String(max + 1).padStart(3, '0')}`);
      });
  }, [view, projectId]);

  function openDetail(rec) { setDetailRec(rec); setView('detail'); }
  function refresh() { setRefreshKey(k => k + 1); }
  function handleSaved() {
    setPhotos([]); setPhotoData([]); setPhotoCategory(''); setReportNo(''); setBatchTitle('');
    setView('list'); refresh();
  }

  return (
    <div className="photo-table-root">
      {(view === 'upload' || view === 'entry') && (
        <div className="photo-table-toolbar no-print">
          <FileImage size={15} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text1)' }}>工程照片報告產生器</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <input placeholder="批次標題（選填）" value={batchTitle} onChange={e => setBatchTitle(e.target.value)}
              style={{ padding: '4px 8px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 5, fontSize: '0.75rem', color: 'var(--color-text1)', width: 160 }} />
          </div>
        </div>
      )}

      {view === 'list' && (
        <PhotoRecordDB key={refreshKey} projectId={projectId} projectName={project?.name}
          onNew={() => setView('upload')} onAlbum={() => setView('album')} onDetail={openDetail}
          srcCtx={srcCtx.srcTable ? srcCtx : null}
          autoOpen={autoParam === 'open'}
          filterMode={filterMode} srcDate={srcDate} />
      )}
      {view === 'album' && (
        <DriveAlbum projectId={projectId} driveRootId={project?.drive_folder_id || ''} onBack={() => setView('list')} />
      )}
      {view === 'detail' && detailRec && (
        <RecordDetail record={detailRec} projectId={projectId} projectName={project?.name}
          driveRootId={project?.drive_folder_id || ''}
          onBack={() => { setView('list'); refresh(); }}
          onSaved={() => { setView('list'); refresh(); }}
          onDeleted={() => { setView('list'); refresh(); }}
          onGoReportDB={() => setView('list')}
        />
      )}
      {view === 'upload' && (
        <StepUpload onPhotosReady={ps => { setPhotos(ps); setView('entry'); }} onBack={() => setView('list')}
          driveRootId={project?.drive_folder_id || ''} projectId={projectId} />
      )}
      {view === 'entry' && (
        <StepEntry photos={photos} onComplete={(data, cat) => { setPhotoData(data); setPhotoCategory(cat); setView('report'); }} onBack={() => setView('upload')} />
      )}
      {view === 'report' && (
        <StepReport photos={photos} data={photoData} projectName={project?.name}
          batchTitle={batchTitle} reportNo={reportNo} setReportNo={setReportNo}
          projectId={projectId} driveRootId={project?.drive_folder_id || ''}
          onBack={() => setView('entry')} onSaved={handleSaved}
          srcCtx={srcCtx.srcTable ? srcCtx : null} photoCategory={photoCategory} />
      )}
    </div>
  );
}
