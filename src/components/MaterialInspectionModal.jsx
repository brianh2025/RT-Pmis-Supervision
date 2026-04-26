/* ============================================================
   MaterialInspectionModal.jsx — 材料進場抽查紀錄表 Modal
   ============================================================ */
import React, { useState } from 'react';
import { X, Printer, Cloud, Loader2, Save } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import './MaterialInspectionModal.css';

/* ── Google Drive 工具（沿用 InspectionFormModal 邏輯） ── */
const GCLIENT_ID           = import.meta.env.VITE_GOOGLE_CLIENT_ID                  || '';
const INSPECTION_FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_INSPECTION_FOLDER_ID || '';

let _gisReady = false;
function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}
async function getGoogleToken() {
  if (!_gisReady) { await loadScript('https://accounts.google.com/gsi/client'); _gisReady = true; }
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GCLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: resp => resp.error ? reject(new Error(resp.error)) : resolve(resp.access_token),
    });
    client.requestAccessToken({ prompt: '' });
  });
}
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
  const cr = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  return (await cr.json()).id;
}
async function uploadHtmlToDrive(htmlBlob, filename, token, folderName, date) {
  if (!INSPECTION_FOLDER_ID) throw new Error('尚未設定 VITE_GOOGLE_DRIVE_INSPECTION_FOLDER_ID');
  let parentId = INSPECTION_FOLDER_ID;
  if (folderName) parentId = await getOrCreateFolder(token, parentId, folderName);
  const dateStr = (date || new Date().toISOString().split('T')[0]).replace(/-/g, '');
  parentId = await getOrCreateFolder(token, parentId, dateStr);
  const form = new FormData();
  form.append('metadata', new Blob(
    [JSON.stringify({ name: filename, parents: [parentId], mimeType: 'text/html' })],
    { type: 'application/json' }
  ));
  form.append('file', htmlBlob);
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink',
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
  );
  if (!res.ok) throw new Error(`上傳失敗（${res.status}）`);
  return await res.json();
}

/* ── ROC 日期格式 ── */
function toRocDate(d) {
  if (!d) return '　　年　　月　　日';
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getFullYear() - 1911} 年 ${dt.getMonth() + 1} 月 ${dt.getDate()} 日`;
}

/* ── 抽樣頻率計算（簡易） ── */
function calcSampleQty(name, qty) {
  const q = parseFloat(qty) || 0;
  if (!q) return '';
  const n = name || '';
  if (n.includes('混凝土'))   return String(Math.ceil(q / 50));  // 每 50m³ 取一組
  if (n.includes('鋼筋'))     return String(Math.ceil(q / 20));  // 每 20t 取一組
  if (n.includes('瀝青'))     return String(Math.ceil(q / 100)); // 每 100t 取一組
  return '1';
}

/* ── 產生材料檢驗紀錄表 HTML ── */
function buildMaterialFormHtml({ form, project }) {
  const { name, spec, qty, unit, vendor, sampleQty, sampleDate, result, inspector } = form;
  const projectName  = project?.name        || '';
  const contractor   = project?.contractor  || '';
  const sampleGroups = calcSampleQty(name, qty);

  const checked = (val, target) => val === target ? '☑' : '☐';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>材料進場抽查紀錄表</title>
<style>
  body { font-family:'標楷體','DFKai-SB','BiauKai','Noto Serif TC',serif; margin:1.5cm; font-size:11pt; color:#000; }
  h2  { text-align:center; font-size:15pt; margin:0 0 8px; }
  .sub { text-align:center; font-size:10pt; color:#444; margin-bottom:12px; }
  table { width:100%; border-collapse:collapse; table-layout:fixed; }
  th, td { border:1px solid #000; padding:4px 8px; vertical-align:middle; }
  .lbl { font-weight:bold; background:#f5f5f5; text-align:center; white-space:nowrap; width:90px; }
  .result-row td { font-size:11pt; }
  .sign-row { margin-top:14px; display:flex; justify-content:flex-start; gap:80px; font-size:13pt; }
  .blank { display:inline-block; min-width:80px; border-bottom:1px solid #333; vertical-align:bottom; }
  @media print { body { margin:1cm; } }
</style>
</head>
<body>
<h2>材料(設備)進場抽查紀錄表</h2>
<p class="sub">E2 材料(設備)抽查</p>
<table>
  <tr><td class="lbl">工程名稱</td><td colspan="3">${projectName}</td></tr>
  <tr><td class="lbl">承包廠商</td><td colspan="3">${contractor}</td></tr>
  <tr>
    <td class="lbl">抽查日期</td><td>${toRocDate(sampleDate)}</td>
    <td class="lbl">廠商</td><td>${vendor || ''}</td>
  </tr>
  <tr>
    <td class="lbl">材料名稱</td><td>${name}</td>
    <td class="lbl">規格</td><td>${spec || ''}</td>
  </tr>
  <tr>
    <td class="lbl">本次進場量</td><td>${qty || ''} ${unit || ''}</td>
    <td class="lbl">取樣組數</td><td>${sampleQty || sampleGroups} 組</td>
  </tr>
  <tr>
    <td class="lbl">試驗規範</td>
    <td colspan="3" style="font-size:10pt;">依契約規定及相關 CNS/ASTM 標準辦理</td>
  </tr>
  <tr class="result-row">
    <td class="lbl">進場判定</td>
    <td colspan="3">
      ${checked(result, '合格')} 合格（進場材料外觀、規格符合規定）
      &emsp;${checked(result, '不合格')} 不合格（已退場處理）
      &emsp;${checked(result, '待試驗')} 待試驗（先行隔離存放）
    </td>
  </tr>
  <tr>
    <td class="lbl">備註</td>
    <td colspan="3" style="min-height:40px;">&nbsp;</td>
  </tr>
</table>
<div class="sign-row">
  <span>監造人員：<span class="blank">${inspector || ''}</span></span>
  <span>監造主管：<span class="blank"></span></span>
</div>
</body></html>`;
}

/* ── 主元件 ── */
export default function MaterialInspectionModal({ date, materialName, qty, unit, project, onClose, onSave }) {
  const { user } = useAuth();

  const [form, setForm] = useState({
    name:       materialName || '',
    spec:       '',
    qty:        qty != null ? String(qty) : '',
    unit:       unit || '',
    vendor:     '',
    sampleQty:  '',
    sampleDate: date || new Date().toISOString().split('T')[0],
    result:     '合格',
    inspector:  '',
  });

  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [driveLink, setDriveLink] = useState('');

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  /* 儲存至 material_entries + 更新 mcs_test */
  async function handleSave() {
    if (!form.name.trim()) return alert('請填寫材料名稱');
    if (!supabase)         return alert('資料庫未連線');
    setSaving(true);
    try {
      const { data: entry, error } = await supabase.from('material_entries').insert([{
        project_id:  project?.id,
        created_by:  user?.id,
        entry_date:  form.sampleDate,
        name:        form.name,
        spec:        form.spec  || null,
        qty:         form.qty   || null,
        vendor:      form.vendor || null,
        inspector:   form.inspector || null,
        result:      form.result,
      }]).select().single();
      if (error) throw error;

      /* 比對 mcs_test（前4字元） */
      const prefix = form.name.slice(0, 4);
      const { data: testRows } = await supabase.from('mcs_test')
        .select('id, name, cum_qty').eq('project_id', project?.id);
      const match = testRows?.find(r => r.name?.startsWith(prefix));
      if (match) {
        const prev  = parseFloat(match.cum_qty) || 0;
        const added = parseFloat(form.qty)      || 0;
        if (added > 0) {
          await supabase.from('mcs_test')
            .update({ cum_qty: String(prev + added) }).eq('id', match.id);
        }
      }

      alert(`已儲存材料進場記錄${match ? '，並更新試驗管制累積進場量' : ''}`);
      onSave?.(entry);
      onClose();
    } catch (e) { alert(`儲存失敗：${e.message}`); }
    finally { setSaving(false); }
  }

  /* 列印 */
  function handlePrint() {
    const html = buildMaterialFormHtml({ form, project });
    const w = window.open('', '_blank', 'width=900,height=700');
    w.document.write(html);
    w.document.close();
    w.onload = () => { w.focus(); w.print(); };
  }

  /* 上傳 Drive */
  async function handleUploadDrive() {
    setUploading(true);
    try {
      const token = await getGoogleToken();
      const html  = buildMaterialFormHtml({ form, project });
      const blob  = new Blob([html], { type: 'text/html;charset=utf-8' });
      const filename = `E2_材料進場抽查_${form.name}_${form.sampleDate || 'nodate'}.html`;
      const result = await uploadHtmlToDrive(blob, filename, token, 'E2 材料(設備)抽查', form.sampleDate);
      setDriveLink(result.webViewLink || '');
      alert('已上傳至 Google Drive！');
    } catch (e) { alert(`上傳失敗：${e.message}`); }
    finally { setUploading(false); }
  }

  const RESULT_OPTIONS = ['合格', '不合格', '待試驗'];

  return (
    <div className="mim-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mim-modal">

        {/* 標題列 */}
        <div className="mim-header">
          <span className="mim-title">材料進場抽查紀錄表</span>
          <div className="mim-header-actions">
            <button className="mim-btn mim-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              儲存至材料管制
            </button>
            <button className="mim-btn" onClick={handlePrint}><Printer size={13} />列印 / PDF</button>
            <button className="mim-btn" onClick={handleUploadDrive} disabled={uploading}>
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Cloud size={13} />}
              上傳 Drive
            </button>
            {driveLink && (
              <a className="mim-btn" href={driveLink} target="_blank" rel="noreferrer">開啟 Drive</a>
            )}
            <button className="mim-btn-close" onClick={onClose}><X size={15} /></button>
          </div>
        </div>

        <div className="mim-body">

          {/* 基本資料 */}
          <div className="mim-section">
            <div className="mim-section-title">進場資料</div>
            <div className="mim-grid-3">
              <div>
                <label className="mim-label">抽查日期</label>
                <input className="mim-input" type="date" value={form.sampleDate}
                  onChange={e => setField('sampleDate', e.target.value)} />
              </div>
              <div>
                <label className="mim-label">工程名稱</label>
                <input className="mim-input" value={project?.name || ''} readOnly />
              </div>
              <div>
                <label className="mim-label">承包廠商</label>
                <input className="mim-input" value={project?.contractor || ''} readOnly />
              </div>
            </div>
            <div className="mim-grid-3" style={{ marginTop: 8 }}>
              <div>
                <label className="mim-label">材料名稱</label>
                <input className="mim-input" value={form.name}
                  onChange={e => setField('name', e.target.value)} />
              </div>
              <div>
                <label className="mim-label">規格</label>
                <input className="mim-input" value={form.spec}
                  onChange={e => setField('spec', e.target.value)} />
              </div>
              <div>
                <label className="mim-label">廠商</label>
                <input className="mim-input" value={form.vendor}
                  onChange={e => setField('vendor', e.target.value)} />
              </div>
            </div>
            <div className="mim-grid-4" style={{ marginTop: 8 }}>
              <div>
                <label className="mim-label">進場數量</label>
                <input className="mim-input" value={form.qty}
                  onChange={e => setField('qty', e.target.value)} />
              </div>
              <div>
                <label className="mim-label">單位</label>
                <input className="mim-input" value={form.unit}
                  onChange={e => setField('unit', e.target.value)} />
              </div>
              <div>
                <label className="mim-label">取樣組數</label>
                <input className="mim-input"
                  placeholder={calcSampleQty(form.name, form.qty) || '—'}
                  value={form.sampleQty}
                  onChange={e => setField('sampleQty', e.target.value)} />
              </div>
              <div>
                <label className="mim-label">監造人員</label>
                <input className="mim-input" value={form.inspector}
                  onChange={e => setField('inspector', e.target.value)} />
              </div>
            </div>
          </div>

          {/* 進場判定 */}
          <div className="mim-section">
            <div className="mim-section-title">進場判定</div>
            <div className="mim-radio-group">
              {RESULT_OPTIONS.map(opt => (
                <label key={opt} className="mim-radio">
                  <input type="radio" name="result" value={opt}
                    checked={form.result === opt}
                    onChange={() => setField('result', opt)} />
                  {opt}
                </label>
              ))}
            </div>
            {form.result === '不合格' && (
              <p className="mim-hint" style={{ marginTop: 6 }}>
                ⚠ 不合格材料應退場，並填具缺失改善單（可至材料管制頁面補建）
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
