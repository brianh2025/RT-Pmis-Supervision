/* ============================================================
   InspectionFormModal.jsx — 施工抽查紀錄表填寫 Modal
   ============================================================ */
import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Printer, Cloud, Loader2, CheckSquare, Save, Trash2, Camera } from 'lucide-react';
import {
  INSPECTION_TEMPLATES, TEMPLATE_OPTIONS, INSPECT_TYPE_OPTIONS,
  FLOW_OPTIONS, RESULT_SYMBOL, guessTemplateCode,
} from '../config/inspectionFormTemplates';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import './InspectionFormModal.css';

/* ── Google Drive 工具（與 PhotoTable.jsx 相同邏輯） ── */
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
async function uploadHtmlToDrive(htmlBlob, filename, token, workItem, date) {
  if (!INSPECTION_FOLDER_ID) throw new Error('尚未設定 VITE_GOOGLE_DRIVE_INSPECTION_FOLDER_ID');
  let parentId = INSPECTION_FOLDER_ID;
  if (workItem) parentId = await getOrCreateFolder(token, parentId, workItem);
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

/* ── 產生抽查單 HTML（用於列印 / Drive 上傳） ── */
function buildFormHtml({ template, header, items, defect, supervisor, signImgSrc, supervisorImgSrc, projectName, contractor }) {
  const phases = ['施工前', '施工中', '施工完成'];
  const PHASE_LABELS = { '施工前': '施工前', '施工中': '施工中', '施工完成': '施工<br>完成' };

  const rowsHtml = phases.map(phase => {
    const phaseItems = template.items.filter(it => it.phase === phase);
    if (!phaseItems.length) return '';
    return phaseItems.map((it, idx) => {
      const res = items[it.name] || {};
      const SYM = {
        pass: `<svg width="19" height="19" viewBox="0 0 19 19" style="vertical-align:middle;display:inline-block"><path d="M9.5,2 C14,2.4 16.8,6 16.5,10.2 C16.2,14.5 12.8,17.2 9.2,17 C5.4,16.8 2.5,13.5 2.8,9.8 C3.1,5.8 6.2,2.4 9.5,2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
        fail: `<svg width="19" height="19" viewBox="0 0 19 19" style="vertical-align:middle;display:inline-block"><path d="M3.5,3.5 Q7,8.5 15.5,15.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M15.5,3.5 Q11,9 3.5,15.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
        na:   `<svg width="19" height="19" viewBox="0 0 19 19" style="vertical-align:middle;display:inline-block"><path d="M14,2.5 Q9.5,9.5 5,16.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
      };
      const sym = SYM[res.result] || '';
      const td1 = idx === 0
        ? `<td class="phase-cell" rowspan="${phaseItems.length}">${PHASE_LABELS[phase]}</td>`
        : '';
      return `<tr>
        ${td1}
        <td class="item-cell">${it.key ? '★' : ''}${it.name}</td>
        <td class="std-cell">${it.standard}</td>
        <td class="actual-cell">${(res.actual || '').replace(/\n/g, '<br>')}</td>
        <td class="result-cell">${sym}</td>
      </tr>`;
    }).join('');
  }).join('');

  const defectChecked1 = defect.resolved ? '☑' : '☐';
  const defectChecked2 = defect.unresolved ? '☑' : '☐';

  const signBlock = (label, src) => src
    ? `<span style="font-size:13pt;">${label}：<img src="${src}" style="height:80px;vertical-align:middle;margin-left:8px;"></span>`
    : `<span style="font-size:13pt;">${label}：＿＿＿＿＿＿＿</span>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>${template.label}施工抽查紀錄表</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600&family=Ma+Shan+Zheng&display=swap" rel="stylesheet">
<style>
  body { font-family:'標楷體','DFKai-SB','BiauKai','Noto Serif TC',serif; margin:1.5cm; font-size:11pt; color:#000; }
  .title-wrap { margin-bottom:6px; }
  .title-wrap h2 { text-align:center; font-size:15pt; margin:0 0 2px; white-space:nowrap; }
  .title-wrap .serial { display:block; text-align:right; font-size:10pt; white-space:nowrap; }
  .serial-blank { display:inline-block; width:60px; border-bottom:1px solid #333; vertical-align:bottom; margin-left:2px; }
  table { width:100%; border-collapse:collapse; table-layout:fixed; }
  th, td { border:1px solid #000; padding:3px 6px; vertical-align:middle; }
  .hdr-label { font-weight:bold; background:#f5f5f5; text-align:center; white-space:nowrap; }
  .phase-cell { text-align:center; font-weight:bold; background:#f5f5f5; word-break:keep-all; overflow:hidden; }
  .std-cell { font-size:10pt; }
  .actual-cell { font-size:10pt; font-family:'Ma Shan Zheng','標楷體','DFKai-SB',cursive; }
  .result-cell { text-align:center; font-family:'Caveat','Comic Sans MS',cursive; font-size:18pt; font-weight:600; }
  .defect-row td { font-size:10pt; }
  .note-row td { font-size:10pt; }
  .sign-row { margin-top:12px; display:flex; justify-content:space-between; align-items:center; min-height:80px; }
  @media print { body { margin:1cm; } }
</style>
</head>
<body>
<div class="title-wrap">
  <h2>${template.label}施工抽查紀錄表</h2>
  <span class="serial">編號：${template.code}-01-<span class="serial-blank"></span></span>
</div>
<table>
  <colgroup>
    <col style="width:12%">
    <col style="width:27%">
    <col style="width:25%">
    <col style="width:26%">
    <col style="width:10%">
  </colgroup>
  <tr><td class="hdr-label">工程名稱</td><td colspan="4">${projectName || ''}</td></tr>
  <tr><td class="hdr-label">承包廠商</td><td colspan="4">${contractor || ''}</td></tr>
  <tr>
    <td class="hdr-label">檢查位置</td>
    <td>${header.location || ''}</td>
    <td class="hdr-label">檢查日期</td>
    <td colspan="2">${toRocDate(header.date)}</td>
  </tr>
  <tr>
    <td class="hdr-label">檢查時機</td>
    <td colspan="4">
      ${header.inspectType === '施工檢驗停留點' ? '☑' : '☐'} 施工檢驗停留點
      &emsp;${header.inspectType === '不定期檢查' ? '☑' : '☐'} 不定期檢查
    </td>
  </tr>
  <tr>
    <td class="hdr-label">施工流程</td>
    <td colspan="4">
      ${(header.flows||[]).includes('施工前') ? '☑' : '☐'} 施工前
      &emsp;${(header.flows||[]).includes('施工中檢查') ? '☑' : '☐'} 施工中檢查
      &emsp;${(header.flows||[]).includes('施工完成檢查') ? '☑' : '☐'} 施工完成檢查
    </td>
  </tr>
  <tr>
    <td class="hdr-label">檢查結果</td>
    <td colspan="4">○ 檢查合格　╳ 有缺失需改正　／ 無此檢查項目</td>
  </tr>
  <tr>
    <th>施工階段</th>
    <th>管理項目</th>
    <th class="std-cell">依設計圖說、規範之抽查標準（定量定性，含容許誤差）</th>
    <th class="actual-cell">實際抽查情形（含檢查數據）</th>
    <th class="result-cell" style="font-family:inherit;font-size:11pt;">抽查<br>結果</th>
  </tr>
  ${rowsHtml}
  <tr class="defect-row">
    <td colspan="5">
      <strong>缺失複查結果：</strong><br>
      ${defectChecked1} 已立即完成改善（檢附改善前中後照片）<br>
      ${defectChecked2} 未完成改善，填具「不符合事項追蹤改善表」進行追蹤改善<br>
      複查日期：${defect.date ? toRocDate(defect.date) : '　　年　　月　　日'}　　複查人員職稱：${defect.reviewer || ''}　　簽名：${defect.reviewSign || ''}
    </td>
  </tr>
  <tr class="note-row">
    <td colspan="5">
      <strong>備註：</strong><br>
      1. 檢查標準及實際檢查情形應具體明確或量化尺寸。<br>
      2. 檢查結果合格者註明「○」，不合格者註明「╳」，如無需檢查之項目則打「／」。<br>
      3. 嚴重缺失、缺失複查未完成改善，應填具「不符合事項追蹤改善表」進行追蹤改善。
    </td>
  </tr>
</table>
<div class="sign-row">
  ${signBlock('監造人員', signImgSrc)}
  <span style="padding-right:3em;">${signBlock('監造主管', supervisorImgSrc)}</span>
</div>
</body></html>`;
}

/* ── 主元件 ── */
export default function InspectionFormModal({ inspection, project, onClose, onSave }) {
  const { user } = useAuth();
  const guessedCode = guessTemplateCode(inspection?.work_item);
  const [templateCode, setTemplateCode] = useState(guessedCode || '');
  const template = INSPECTION_TEMPLATES.find(t => t.code === templateCode) || null;

  /* 表頭資料 */
  const [header, setHeader] = useState({
    location:    inspection?.location    || '',
    date:        inspection?.inspect_date || new Date().toISOString().split('T')[0],
    inspectType: inspection?.inspect_type || '',
    flows:       [],
  });

  /* 各子項目結果 { [itemName]: { result: 'pass'|'fail'|'na'|'', actual: '' } } */
  const [items, setItems] = useState({});

  /* 缺失複查 */
  const [defect, setDefect] = useState({ resolved: false, unresolved: false, date: '', reviewer: '', reviewSign: '' });

  /* 簽署影像 */
  const [signImg,      setSignImg]      = useState(null);
  const [supervisorImg, setSupervisorImg] = useState(null);
  const signRef      = useRef(null);
  const supervisorRef = useRef(null);

  const [defectOpen,      setDefectOpen]      = useState(false);
  const [signOpen,        setSignOpen]        = useState(false);
  const [diaryHintDates,  setDiaryHintDates]  = useState([]);
  const [saving,          setSaving]          = useState(false);
  const [savingDb,        setSavingDb]        = useState(false);
  const [driveLink,       setDriveLink]       = useState('');
  const [photoPickerOpen,   setPhotoPickerOpen]   = useState(false);
  const [photoBatches,      setPhotoBatches]      = useState([]);
  const [photoLoading,      setPhotoLoading]      = useState(false);
  const [pickerDateFilter,  setPickerDateFilter]  = useState('');

  /* 切換 template 時重置 items */
  useEffect(() => { setItems({}); }, [templateCode]);

  /* 查本月日誌中該工項出現的日期（以 guessTemplateCode 關鍵字比對） */
  useEffect(() => {
    if (!template || !supabase || !project?.id) { setDiaryHintDates([]); return; }
    const ym = (header.date || new Date().toISOString().split('T')[0]).substring(0, 7);
    supabase.from('daily_report_items')
      .select('log_date, item_name')
      .eq('project_id', project.id)
      .gte('log_date', `${ym}-01`)
      .lte('log_date', `${ym}-31`)
      .then(({ data }) => {
        const dates = [...new Set(
          (data || [])
            .filter(d => guessTemplateCode(d.item_name) === templateCode)
            .map(d => d.log_date)
        )].sort();
        setDiaryHintDates(dates);
      });
  }, [templateCode, project?.id, header.date?.substring(0, 7)]);

  function setResult(itemName, result) {
    setItems(prev => ({ ...prev, [itemName]: { ...(prev[itemName] || {}), result } }));
  }
  function setActual(itemName, actual) {
    setItems(prev => ({ ...prev, [itemName]: { ...(prev[itemName] || {}), actual } }));
  }
  function clearAllActual() {
    setItems(prev => Object.fromEntries(
      Object.entries(prev).map(([k, v]) => [k, { ...v, actual: '' }])
    ));
  }

  async function loadPhotoBatches() {
    if (!supabase || !project?.id) return;
    setPhotoLoading(true);
    const { data } = await supabase.from('archive_docs')
      .select('id, title, doc_no, remark, doc_date')
      .eq('project_id', project.id).eq('category', 'photo')
      .order('doc_date', { ascending: false })
      .limit(120);
    setPhotoBatches(data || []);
    setPickerDateFilter('');
    setPhotoLoading(false);
    setPhotoPickerOpen(true);
  }

  function importFromBatch(batch) {
    const info = JSON.parse(batch.remark || '{}');
    const locs = [...new Set((info.photos || []).map(p => p.location).filter(Boolean))];
    setHeader(h => ({
      ...h,
      ...(locs.length ? { location: locs.join('、') } : {}),
      ...(batch.doc_date ? { date: batch.doc_date } : {}),
    }));
    setPhotoPickerOpen(false);
  }

  function readImgFile(file, setter) {
    if (!file) return;
    const r = new FileReader();
    r.onload = e => setter(e.target.result);
    r.readAsDataURL(file);
  }

  /* 列印 */
  function handlePrint() {
    if (!template) return alert('請先選擇工項');
    const html = buildFormHtml({
      template, header, items, defect,
      signImgSrc: signImg, supervisorImgSrc: supervisorImg,
      projectName: project?.name, contractor: project?.contractor,
    });
    const w = window.open('', '_blank', 'width=900,height=800');
    w.document.write(html);
    w.document.close();
    w.onload = () => { w.focus(); w.print(); };
  }

  /* 上傳 Drive */
  async function handleUploadDrive() {
    if (!template) return alert('請先選擇工項');
    setSaving(true);
    try {
      const token = await getGoogleToken();
      const html = buildFormHtml({
        template, header, items, defect,
        signImgSrc: signImg, supervisorImgSrc: supervisorImg,
        projectName: project?.name, contractor: project?.contractor,
      });
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const filename = `${template.code}_${template.label}_${header.date || 'nodate'}.html`;
      const result = await uploadHtmlToDrive(blob, filename, token, `${template.code} ${template.label}`, header.date);
      setDriveLink(result.webViewLink || '');
      alert('已上傳至 Google Drive！');
    } catch (e) { alert(`上傳失敗：${e.message}`); }
    finally { setSaving(false); }
  }

  /* 儲存至 construction_inspections */
  async function handleSaveDb() {
    if (!template) return alert('請先選擇工項');
    if (!supabase) return alert('資料庫未連線');
    setSavingDb(true);
    try {
      const results = Object.values(items).map(v => v.result).filter(Boolean);
      const overallResult = results.includes('fail') ? '不合格'
        : results.length > 0 && results.every(r => r === 'pass') ? '合格'
        : '待複驗';
      const payload = {
        project_id:   project?.id,
        created_by:   user?.id,
        inspect_date: header.date,
        work_item:    template.label,
        location:     header.location || null,
        inspect_type: header.inspectType || null,
        result:       overallResult,
        remark:       defect.resolved ? '已立即完成改善' : defect.unresolved ? '未完成改善，需追蹤' : null,
      };
      const { data, error } = await supabase.from('construction_inspections').insert([payload]).select().single();
      if (error) throw error;
      alert(`已儲存至施工檢驗管制表（結果：${overallResult}）`);
      onSave?.(data);
      onClose();
    } catch (e) { alert(`儲存失敗：${e.message}`); }
    finally { setSavingDb(false); }
  }

  /* 各 phase 的項目 */
  const phases = template ? ['施工前', '施工中', '施工完成'] : [];

  return (
    <>
    <div className="ifm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ifm-modal">

        {/* 標題列 */}
        <div className="ifm-header">
          <span className="ifm-title">填寫施工抽查紀錄表</span>
          <div className="ifm-header-actions">
            <button className="ifm-btn ifm-btn-primary" onClick={handleSaveDb} disabled={savingDb}>
              {savingDb ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              儲存至管制表
            </button>
            <button className="ifm-btn" onClick={handlePrint}><Printer size={13} />列印 / PDF</button>
            <button className="ifm-btn" onClick={handleUploadDrive} disabled={saving}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Cloud size={13} />}
              上傳 Drive
            </button>
            {driveLink && (
              <a className="ifm-btn" href={driveLink} target="_blank" rel="noreferrer">
                <CheckSquare size={13} />開啟 Drive
              </a>
            )}
            <button className="ifm-btn-close" onClick={onClose}><X size={15} /></button>
          </div>
        </div>

        <div className="ifm-body">

          {/* 選擇工項 */}
          <div className="ifm-section">
            <div className="ifm-row">
              <label className="ifm-label">工項表單</label>
              <select className="ifm-select" value={templateCode} onChange={e => setTemplateCode(e.target.value)}>
                <option value="">— 請選擇工項 —</option>
                {TEMPLATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {guessedCode && guessedCode !== templateCode && (
                <span className="ifm-hint">依工項「{inspection?.work_item}」建議：{guessedCode}</span>
              )}
            </div>
          </div>

          {/* 基本資料 */}
          <div className="ifm-section">
            <div className="ifm-section-title">基本資料</div>
            <div className="ifm-basic-row">
              <div>
                <label className="ifm-label">檢查日期</label>
                <input className="ifm-input" type="date" value={header.date}
                  onChange={e => setHeader(h => ({ ...h, date: e.target.value }))} />
                {diaryHintDates.length > 0 && (
                  <div style={{ marginTop: 3, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {diaryHintDates.map(d => (
                      <button key={d} onClick={() => setHeader(h => ({ ...h, date: d }))}
                        style={{
                          fontSize: '11px', padding: '1px 6px', borderRadius: 4, cursor: 'pointer',
                          border: '1px solid var(--color-primary-light)',
                          background: header.date === d ? 'var(--color-primary)' : 'transparent',
                          color: header.date === d ? '#fff' : 'var(--color-primary-light)',
                        }}>
                        {parseInt(d.split('-')[2])}日
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="ifm-basic-col-wide">
                <label className="ifm-label">檢查位置</label>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input className="ifm-input" style={{ flex: 1 }} value={header.location}
                    onChange={e => setHeader(h => ({ ...h, location: e.target.value }))} />
                  <button type="button" className="ifm-btn" onClick={loadPhotoBatches}
                    disabled={photoLoading}
                    style={{ whiteSpace: 'nowrap', padding: '4px 8px', fontSize: '12px', borderColor: 'var(--color-primary-light)', color: 'var(--color-primary-light)' }}
                    title="從當日照片紀錄帶入位置、日期">
                    {photoLoading ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
                    導入照片
                  </button>
                </div>
              </div>
              <div className="ifm-basic-col-wide">
                <label className="ifm-label">檢查時機</label>
                <div className="ifm-radio-group">
                  {INSPECT_TYPE_OPTIONS.map(o => (
                    <label key={o} className="ifm-radio">
                      <input type="radio" name="inspectType" value={o}
                        checked={header.inspectType === o}
                        onChange={() => setHeader(h => ({ ...h, inspectType: o }))} />
                      {o}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ flex: 2, minWidth: 0 }}>
                <label className="ifm-label">施工流程</label>
                <div className="ifm-radio-group" style={{ gap: 6 }}>
                  {FLOW_OPTIONS.map(o => (
                    <label key={o} className="ifm-radio">
                      <input type="checkbox" value={o}
                        checked={(header.flows || []).includes(o)}
                        onChange={() => setHeader(h => {
                          const flows = h.flows || [];
                          return { ...h, flows: flows.includes(o) ? flows.filter(f => f !== o) : [...flows, o] };
                        })} />
                      {o}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 抽查項目表 */}
          {template && (
            <div className="ifm-section">
              <div className="ifm-section-title" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span>抽查項目</span>
                <button className="ifm-btn" style={{ fontSize:'var(--fs-xs)', padding:'2px 8px' }} onClick={clearAllActual}>
                  <Trash2 size={12} />實際欄留空白
                </button>
              </div>
              <div className="ifm-table-wrap">
                <table className="ifm-table">
                  <colgroup>
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '27%' }} />
                    <col style={{ width: '25%' }} />
                    <col style={{ width: '26%' }} />
                    <col style={{ width: '10%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>施工階段</th>
                      <th>管理項目</th>
                      <th>依設計圖說、規範之抽查標準</th>
                      <th>實際抽查情形（含檢查數據）</th>
                      <th>抽查結果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {phases.map(phase => {
                      const phaseItems = template.items.filter(it => it.phase === phase);
                      if (!phaseItems.length) return null;
                      return phaseItems.map((it, idx) => (
                        <tr key={it.name}>
                          {idx === 0 && (
                            <td className="ifm-phase-cell" rowSpan={phaseItems.length}>
                              {phase}
                            </td>
                          )}
                          <td className="ifm-item-name">
                            {it.key && <span className="ifm-key-star">★</span>}{it.name}
                          </td>
                          <td className="ifm-std">{it.standard}</td>
                          <td>
                            <textarea className="ifm-textarea"
                              value={items[it.name]?.actual || ''}
                              onChange={e => setActual(it.name, e.target.value)}
                              rows={1} />
                          </td>
                          <td className="ifm-result-cell">
                            {['pass', 'fail', 'na'].map(sym => (
                              <button key={sym}
                                className={`ifm-sym-btn${(items[it.name]?.result || '') === sym ? ' active' : ''}`}
                                onClick={() => setResult(it.name, items[it.name]?.result === sym ? '' : sym)}>
                                {RESULT_SYMBOL[sym]}
                              </button>
                            ))}
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 缺失複查 */}
          <div className="ifm-section">
            <div className="ifm-section-title" style={{ cursor:'pointer', userSelect:'none' }}
              onClick={() => setDefectOpen(o => !o)}>
              缺失複查結果 {defectOpen ? '▲' : '▼'}
            </div>
            {defectOpen && <>
              <div className="ifm-defect-row">
                <label className="ifm-check">
                  <input type="checkbox" checked={defect.resolved}
                    onChange={e => setDefect(d => ({ ...d, resolved: e.target.checked }))} />
                  已立即完成改善（檢附改善前中後照片）
                </label>
                <label className="ifm-check">
                  <input type="checkbox" checked={defect.unresolved}
                    onChange={e => setDefect(d => ({ ...d, unresolved: e.target.checked }))} />
                  未完成改善，填具「不符合事項追蹤改善表」
                </label>
              </div>
              <div className="ifm-grid-3" style={{ marginTop: 8 }}>
                <div>
                  <label className="ifm-label">複查日期</label>
                  <input className="ifm-input" type="date" value={defect.date}
                    onChange={e => setDefect(d => ({ ...d, date: e.target.value }))} />
                </div>
                <div>
                  <label className="ifm-label">複查人員職稱</label>
                  <input className="ifm-input" value={defect.reviewer}
                    onChange={e => setDefect(d => ({ ...d, reviewer: e.target.value }))} />
                </div>
                <div>
                  <label className="ifm-label">簽名（文字）</label>
                  <input className="ifm-input" value={defect.reviewSign}
                    onChange={e => setDefect(d => ({ ...d, reviewSign: e.target.value }))} />
                </div>
              </div>
            </>}
          </div>

          {/* 簽署影像 */}
          <div className="ifm-section">
            <div className="ifm-section-title" style={{ cursor:'pointer', userSelect:'none' }}
              onClick={() => setSignOpen(o => !o)}>
              Signatures {signOpen ? '▲' : '▼'}
            </div>
            {signOpen && (
              <div className="ifm-grid-2">
                {[
                  { label: '監造人員', img: signImg, setImg: setSignImg, ref: signRef },
                  { label: '監造主管', img: supervisorImg, setImg: setSupervisorImg, ref: supervisorRef },
                ].map(({ label, img, setImg, ref: r }) => (
                  <div key={label} className="ifm-sign-block">
                    <label className="ifm-label">{label}</label>
                    {img
                      ? <div className="ifm-sign-preview">
                          <img src={img} alt={label} />
                          <button className="ifm-btn" style={{ marginTop: 4 }} onClick={() => setImg(null)}>
                            <X size={12} />移除
                          </button>
                        </div>
                      : <button className="ifm-btn" onClick={() => r.current?.click()}>
                          <Upload size={12} />上傳簽署影像
                        </button>
                    }
                    <input ref={r} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => readImgFile(e.target.files[0], setImg)} />
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>

    {/* 照片批次選取 overlay */}
    {photoPickerOpen && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={() => setPhotoPickerOpen(false)}>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-block-border)', borderRadius: 10, padding: 16, minWidth: 340, maxWidth: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: 10, color: 'var(--color-text-main)' }}>
            選擇照片批次
          </div>
          <input type="date" value={pickerDateFilter}
            onChange={e => setPickerDateFilter(e.target.value)}
            style={{ marginBottom: 8, padding: '4px 8px', fontSize: '13px', borderRadius: 6, border: '1px solid var(--color-block-border)', background: 'var(--color-background-soft)', color: 'var(--color-text-main)', width: '100%', boxSizing: 'border-box' }} />
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {(() => {
              const filtered = pickerDateFilter
                ? photoBatches.filter(b => b.doc_date === pickerDateFilter)
                : photoBatches;
              return filtered.length === 0
                ? <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', padding: '8px 0' }}>無照片紀錄</div>
                : filtered.map(b => (
                  <button key={b.id} onClick={() => importFromBatch(b)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '7px 10px', marginBottom: 5, borderRadius: 6, border: '1px solid var(--color-block-border)', background: 'var(--color-background-soft)', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-main)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{b.doc_date}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title || b.doc_no || '（無標題）'}</span>
                  </button>
                ));
            })()}
          </div>
          <button onClick={() => setPhotoPickerOpen(false)}
            style={{ marginTop: 10, padding: '4px 12px', borderRadius: 6, border: '1px solid var(--color-block-border)', background: 'transparent', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text-muted)', alignSelf: 'flex-start' }}>
            取消
          </button>
        </div>
      </div>
    )}
    </>
  );
}
