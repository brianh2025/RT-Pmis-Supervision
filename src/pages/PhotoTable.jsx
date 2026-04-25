/* ============================================================
   PhotoTable.jsx — 工程照片記錄系統
   ============================================================ */
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Camera, ChevronLeft, ChevronRight, Printer, Upload, Cloud,
  RotateCcw, X, Check, FileImage, MapPin, RefreshCw,
  Save, Loader2, FileText, Plus, Trash2, Lock, Zap, ArrowLeft, Link2, HelpCircle,
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
const GAPI_KEY        = import.meta.env.VITE_GOOGLE_API_KEY        || '';
const GCLIENT_ID      = import.meta.env.VITE_GOOGLE_CLIENT_ID      || '';
const DRIVE_FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || '';

/** 取得或建立日期子資料夾（YYYYMMDD），回傳資料夾 ID */
async function getOrCreateDateFolder(token, date) {
  const name = (date || todayISO()).replace(/-/g, '');
  const q = encodeURIComponent(
    `'${DRIVE_FOLDER_ID}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
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
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [DRIVE_FOLDER_ID] }),
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
 * 上傳 Blob 至共用雲端硬碟日期子資料夾，設公開，回傳可嵌入縮圖 URL。
 * date 格式 YYYY-MM-DD，用於建立 YYYYMMDD 子資料夾。
 */
async function uploadToDrive(blob, mimeType, token, date) {
  if (!DRIVE_FOLDER_ID) throw new Error('尚未設定 VITE_GOOGLE_DRIVE_FOLDER_ID');
  const folderId = await getOrCreateDateFolder(token, date);
  const ext      = (mimeType || '').includes('png') ? 'png' : 'jpg';
  const filename = `photo_${Date.now()}.${ext}`;

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify({ name: filename, parents: [folderId] })], { type: 'application/json' }));
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

let _gapiPickerReady = false;
let _gisReady        = false;

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

async function ensureGapiPicker() {
  if (_gapiPickerReady) return;
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise(res => window.gapi.load('picker', res));
  _gapiPickerReady = true;
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

/** 開啟 Google Picker，viewId 可為 DOCS_IMAGES 或 PHOTOS */
async function openGooglePicker(viewId, token) {
  await ensureGapiPicker();
  return new Promise(resolve => {
    const P = window.google.picker;
    const view = new P.View(viewId);
    view.setMimeTypes('image/jpeg,image/png,image/heic,image/webp');
    new P.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(GAPI_KEY)
      .enableFeature(P.Feature.MULTISELECT_ENABLED)
      .enableFeature(P.Feature.SUPPORT_DRIVES)   // 支援共用雲端硬碟
      .setCallback(data => { if (data.action === P.Action.PICKED) resolve(data.docs); })
      .build()
      .setVisible(true);
  });
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
function RecordDetail({ record, projectId: _projectId, projectName, onBack, onSaved, onDeleted, onGoReportDB }) {
  const locked = record.tags?.includes('日報已附註');
  const info   = parseRemark(record.remark);

  const [title,        setTitle]        = useState(record.title || '');
  const [docDate,      setDocDate]      = useState(record.doc_date || '');
  const [docNo,        setDocNo]        = useState(record.doc_no || '');
  const [photos,       setPhotos]       = useState(info.photos || []);
  const [saving,       setSaving]       = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [subtitle,     setSubtitle]     = useState(SUBTITLE_OPTIONS[0]);
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
        const url = await uploadToDrive(p._pendingBlob, p._pendingBlob.type, token, p.date);
        const { _pendingBlob: _b, _pendingPreview: _pv, ...rest } = p;
        return { ...rest, url };
      }));
      const { error } = await supabase.from('archive_docs')
        .update({ title, doc_date: docDate || null, doc_no: docNo || null,
          remark: JSON.stringify({ count: finalPhotos.length, photos: finalPhotos }) })
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
              style={{ padding: '4px 10px', fontSize: '13px' }}
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                {displaySrc
                  ? <img src={displaySrc} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 5, border: '1px solid var(--color-border)' }}
                      onError={e => { e.target.style.opacity = 0.2; }} />
                  : <div style={{ width: 72, height: 72, borderRadius: 5, border: '1px dashed var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
function PhotoRecordDB({ projectId, projectName: _projectName, onNew, onDetail, srcCtx, autoOpen, filterMode, srcDate }) {
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

      {/* 工具列 */}
      <div className="pt-db-tabs">
        <span className="pt-db-tab active" style={{ cursor: 'default' }}>
          <Camera size={13} />照片記錄<span className="pt-tab-count">{records.length}</span>
        </span>
        <button style={{ display:'flex', alignItems:'center', justifyContent:'center', width:26, height:26, borderRadius:'50%', background:'none', border:'1px solid var(--color-border)', color:'var(--color-text-muted)', cursor:'pointer', marginLeft:4, flexShrink:0 }}
          title="照片記錄說明" onClick={() => window.dispatchEvent(new CustomEvent('pmis-help', { detail: 'photos' }))}>
          <HelpCircle size={14} />
        </button>
        <button className="pt-btn pt-btn-primary" style={{ marginLeft: 'auto' }} onClick={onNew}>
          <Plus size={13} />新增照片記錄
        </button>
      </div>

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
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="pt-log-tag attached"><Link2 size={10} />已附{srcLabel}</span>
                  <button className="pt-btn" style={{ padding: '2px 7px', fontSize: '13px' }}
                    onClick={() => handleWithdraw(rec)}><RotateCcw size={11} />抽回</button>
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

/* ── 選取照片（三種來源）── */
function StepUpload({ onPhotosReady, onBack }) {
  // item: { id, previewUrl, blob, mimeType, exifDate, exifGps }
  const [items,   setItems]   = useState([]);
  const [gToken,  setGToken]  = useState(null);
  const [_gBusy,   setGBusy]   = useState(false);
  const fileInputRef = useRef(null);

  /* 本機上傳 */
  async function handleLocalFiles(files) {
    for (const file of Array.from(files).filter(f => f.type.startsWith('image/'))) {
      const previewUrl = URL.createObjectURL(file);
      const { exifDate, exifGps } = await parseExif(file);
      setItems(prev => [...prev, {
        id: crypto.randomUUID(), previewUrl, blob: file,
        mimeType: file.type, exifDate, exifGps,
      }]);
    }
  }

  /* 取得 Google token（共用） */
  async function ensureToken() {
    if (gToken) return gToken;
    if (!GCLIENT_ID) { alert('尚未設定 Google OAuth Client ID（VITE_GOOGLE_CLIENT_ID）'); return null; }
    setGBusy(true);
    try {
      const token = await getGoogleToken();
      setGToken(token);
      return token;
    } catch (e) { alert(`Google 授權失敗：${e.message}`); return null; }
    finally { setGBusy(false); }
  }

  /* Google 雲端硬碟 / 相簿：設公開後直接用 thumbnail URL，不下載 blob
     viewIdKey：字串 key（'DOCS_IMAGES' | 'PHOTOS'），在 ensureGapiPicker 後才解析 */
  async function handlePickerSource(viewIdKey, errLabel) {
    const token = await ensureToken();
    if (!token) return;
    setGBusy(true);
    try {
      await ensureGapiPicker();                          // 確保 Picker 已載入
      const viewId = window.google.picker.ViewId[viewIdKey]; // 載入後才能存取
      const docs = await openGooglePicker(viewId, token);
      for (const doc of docs) {
        const url = await makeFilePublic(doc.id, token);
        setItems(prev => [...prev, {
          id: crypto.randomUUID(), previewUrl: url,
          blob: null, mimeType: null, exifDate: '', exifGps: '',
        }]);
      }
    } catch (e) { alert(`${errLabel}失敗：${e.message}`); }
    finally { setGBusy(false); }
  }
  const _handleDrive  = () => handlePickerSource('DOCS_IMAGES', 'Drive 選取');
  const _handlePhotos = () => handlePickerSource('PHOTOS',      '相簿選取');

  /* 繼續：直接進填資料，不在此上傳（保留 blob 供後續存檔用）*/
  function handleNext() {
    // 傳 previewUrl 作為 src 供 StepEntry 預覽，blob 留給 StepReport 存檔時上傳
    onPhotosReady(items.map(item => ({
      id:       item.id,
      src:      item.previewUrl,   // blob URL，僅當次瀏覽器 session 有效
      blob:     item.blob,
      mimeType: item.mimeType,
      exifDate: item.exifDate,
      exifGps:  item.exifGps,
    })));
  }

  return (
    <div className="pt-step-upload">
      {/* 照片來源：目前僅開放本機上傳 */}
      <div className="pt-upload-sources">
        <button className="pt-upload-source-btn" onClick={() => fileInputRef.current?.click()}>
          <Upload size={22} /><span>從電腦 / 手機上傳</span>
        </button>
        <input ref={fileInputRef} type="file" multiple accept="image/*" style={{ display: 'none' }}
          onChange={e => handleLocalFiles(e.target.files)} />
      </div>

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
                <div className="pt-thumb-exif" title={`EXIF 日期：${item.exifDate}${item.exifGps ? '\nGPS：' + item.exifGps : ''}`}>
                  <Zap size={9} />{item.exifGps ? 'GPS+日' : '日期'}
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

/* ── 填資料 ── */
const PHOTO_CATEGORIES = ['材料進場', '施工抽查', '查驗記錄', '會勘紀錄', '其他'];

function StepEntry({ photos, onComplete, onBack }) {
  const [index, setIndex] = useState(0);
  const [photoCategory, setPhotoCategory] = useState('');
  const [data, setData] = useState(() => photos.map(p => ({
    date: p.exifDate || todayISO(), location: '', description: '', gps: p.exifGps || '',
  })));

  function update(f, v) { setData(prev => prev.map((d, i) => i === index ? { ...d, [f]: v } : d)); }

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
              {cur.exifDate && <span style={{ fontSize: '13px', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 2 }}><Zap size={10} />EXIF 自動帶入</span>}
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
function StepReport({ photos, data, projectName, batchTitle, reportNo, setReportNo: _setReportNo, projectId, onBack, onSaved, srcCtx, photoCategory }) {
  const [saving,         setSaving]         = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [subtitle,       setSubtitle]       = useState(SUBTITLE_OPTIONS[0]);
  // 附入來源（獨立開啟時顯示）
  const [srcTypeChoice,  setSrcTypeChoice]  = useState('');
  const [srcRecords,     setSrcRecords]     = useState([]);
  const [srcRecordId,    setSrcRecordId]    = useState('');
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
    })));
    setSrcRecordId('');
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
          url = await uploadToDrive(p.blob, p.mimeType || 'image/jpeg', token, d.date);
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
        remark: JSON.stringify({ count: photos.length, photos: photoDetails }),
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
              style={{ padding: '4px 10px', fontSize: '13px' }}
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
                  : <select value={srcRecordId} onChange={e => setSrcRecordId(e.target.value)}
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
          onNew={() => setView('upload')} onDetail={openDetail}
          srcCtx={srcCtx.srcTable ? srcCtx : null}
          autoOpen={autoParam === 'open'}
          filterMode={filterMode} srcDate={srcDate} />
      )}
      {view === 'detail' && detailRec && (
        <RecordDetail record={detailRec} projectId={projectId} projectName={project?.name}
          onBack={() => { setView('list'); refresh(); }}
          onSaved={() => { setView('list'); refresh(); }}
          onDeleted={() => { setView('list'); refresh(); }}
          onGoReportDB={() => setView('list')}
        />
      )}
      {view === 'upload' && (
        <StepUpload onPhotosReady={ps => { setPhotos(ps); setView('entry'); }} onBack={() => setView('list')} />
      )}
      {view === 'entry' && (
        <StepEntry photos={photos} onComplete={(data, cat) => { setPhotoData(data); setPhotoCategory(cat); setView('report'); }} onBack={() => setView('upload')} />
      )}
      {view === 'report' && (
        <StepReport photos={photos} data={photoData} projectName={project?.name}
          batchTitle={batchTitle} reportNo={reportNo} setReportNo={setReportNo}
          projectId={projectId} onBack={() => setView('entry')} onSaved={handleSaved}
          srcCtx={srcCtx.srcTable ? srcCtx : null} photoCategory={photoCategory} />
      )}
    </div>
  );
}
