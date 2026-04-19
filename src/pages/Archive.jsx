/* ============================================================
   Archive.jsx — 歸檔管理
   Based on Manus_v1 Archive.tsx + version tracking + 進版 button
   ============================================================ */
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Loader2, FolderOpen, FileText, Download, Search, Tag, Calendar, GitBranch, CheckCircle, Printer } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../hooks/useProject';
import '../components/Modal.css';
import './MaterialControl.css';

/* ── 照片記錄列印工具（與 PhotoTable.jsx 共用邏輯）── */
const PHOTOS_PER_PAGE = 3;

function toRocDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getFullYear() - 1911}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`;
}

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

function buildPhotoReportHtml(pages, { title, docNo, subtitle }) {
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
              ${item.url
                ? `<img src="${item.url}" alt="照片 ${pi * PHOTOS_PER_PAGE + ci + 1}">`
                : `<div class="photo-placeholder"><span>照片 ${pi * PHOTOS_PER_PAGE + ci + 1}</span><span style="font-size:9pt">（無照片）</span></div>`
              }
            </td>
            <td class="info-cell-b">
              <div class="info-location">${item.location || '（無位置說明）'}</div>
              <div class="info-date">${toRocDate(item.date)}</div>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="desc-cell-b">說明：${item.description || ''}</td>
          </tr>
        `).join('')}
      </tbody></table>
    </div>
  `).join('');
}

function previewPhotoDoc(doc, projectName) {
  let photos = [];
  try {
    const parsed = JSON.parse(doc.remark);
    photos = parsed.photos || [];
  } catch { return; }
  if (!photos.length) { alert('此記錄無照片資料'); return; }

  const pages = [];
  for (let i = 0; i < photos.length; i += PHOTOS_PER_PAGE) {
    pages.push(photos.slice(i, i + PHOTOS_PER_PAGE));
  }
  const html = buildPhotoReportHtml(pages, {
    title: projectName || doc.title || '工程名稱',
    docNo: doc.doc_no,
    subtitle: '施工抽查紀錄',
  });
  const w = window.open('', '_blank', 'width=960,height=800');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${doc.title}</title><style>${PRINT_CSS}</style></head><body>${html}</body></html>`);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
}

const CATEGORY_TREE = [
  { key: 'contract',   label: '契約文件',   icon: '📋' },
  { key: 'design',     label: '設計圖說',   icon: '📐' },
  { key: 'submission', label: '送審文件',   icon: '📤' },
  { key: 'quality',    label: '品管文件',   icon: '🔍' },
  { key: 'diary',      label: '監造日誌',   icon: '📅' },
  { key: 'photo',      label: '施工照片',   icon: '📷' },
  { key: 'test',       label: '試驗報告',   icon: '🧪' },
  { key: 'meeting',    label: '會議記錄',   icon: '📝' },
  { key: 'change',     label: '變更文件',   icon: '🔄' },
  { key: 'other',      label: '其他',       icon: '📁' },
];

const EMPTY_FORM = {
  title: '', category: 'contract', doc_no: '',
  doc_date: new Date().toISOString().split('T')[0],
  sender: '', receiver: '', tags: '', file_url: '', version: 'v1', remark: '',
};

/* ── version bump helper ── */
function bumpVersion(ver) {
  if (!ver) return 'v2';
  const n = parseInt(ver.replace(/\D/g, ''), 10);
  return isNaN(n) ? 'v2' : `v${n + 1}`;
}

/* ── Toast ── */
function Toast({ msg, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
      background: 'var(--color-success)', color: '#fff',
      padding: '10px 16px', borderRadius: '8px',
      display: 'flex', alignItems: 'center', gap: '8px',
      fontSize: '0.82rem', fontWeight: 600,
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    }}>
      <CheckCircle size={16} />{msg}
    </div>
  );
}

export function Archive() {
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const { project } = useProject(projectId);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [newForm, setNewForm] = useState({ ...EMPTY_FORM });
  const [bumpingId, setBumpingId] = useState(null);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    if (!supabase || !projectId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from('archive_docs').select('*')
      .eq('project_id', projectId).order('doc_date', { ascending: false });
    setRecords(data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const filtered = records.filter(r => {
    const matchCat = activeCategory === 'all' || r.category === activeCategory;
    const q = searchQ.toLowerCase();
    const matchSearch = !q || r.title?.toLowerCase().includes(q) || r.doc_no?.toLowerCase().includes(q)
      || (Array.isArray(r.tags) ? r.tags.join(',') : (r.tags || '')).toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  async function addRecord() {
    if (!supabase || !newForm.title.trim()) return;
    setSaving(true);
    const tagsVal = typeof newForm.tags === 'string' ? newForm.tags.split(',').map(t => t.trim()).filter(Boolean) : newForm.tags;
    const { data } = await supabase.from('archive_docs').insert([{
      project_id: projectId, created_by: user?.id,
      ...newForm, tags: tagsVal, doc_date: newForm.doc_date || null,
    }]).select().single();
    if (data) setRecords(prev => [data, ...prev]);
    setShowAddModal(false);
    setNewForm({ ...EMPTY_FORM });
    setSaving(false);
  }

  async function deleteSelected() {
    if (!supabase || !selected.size) return;
    const ids = Array.from(selected);
    await supabase.from('archive_docs').delete().in('id', ids);
    setRecords(prev => prev.filter(r => !selected.has(r.id)));
    setSelected(new Set());
  }

  /* ── 進版：bump version + create new submission record ── */
  async function bumpDoc(doc) {
    if (!supabase || bumpingId) return;
    const newVer = bumpVersion(doc.version);
    setBumpingId(doc.id);
    try {
      // 1. Update archive_docs version
      await supabase.from('archive_docs').update({ version: newVer }).eq('id', doc.id);
      setRecords(prev => prev.map(r => r.id === doc.id ? { ...r, version: newVer } : r));

      // 2. Create new submission record if source_table exists
      if (doc.source_table && doc.submission_id) {
        const { data: src } = await supabase.from(doc.source_table).select('*').eq('id', doc.submission_id).single();
        if (src) {
          const { id: _id, created_at: _ca, ...rest } = src;
          const newRow = {
            ...rest,
            ver: newVer,
            result: '',
            r_date: '',
            approve: '',
            created_by: user?.id,
            sort_order: (rest.sort_order ?? 0) + 0.5,
          };
          await supabase.from(doc.source_table).insert([newRow]);
        }
      }

      setToast(`已建立 ${newVer} 送審記錄`);
    } finally {
      setBumpingId(null);
    }
  }

  const catCounts = Object.fromEntries(CATEGORY_TREE.map(c => [c.key, records.filter(r => r.category === c.key).length]));

  if (loading) return (
    <div className="mcs-loading"><Loader2 size={20} className="animate-spin" /><span>載入歸檔資料中…</span></div>
  );

  return (
    <div className="archive-root">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h1 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text1)', margin: 0 }}>歸檔管理</h1>
          <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0, letterSpacing: '0.06em' }}>DOCUMENT ARCHIVE SYSTEM</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {selected.size > 0 && (
            <button className="mcs-btn mcs-btn-del" onClick={deleteSelected}><Trash2 size={12} /> 刪除 ({selected.size})</button>
          )}
          <button className="mcs-btn mcs-btn-primary" onClick={() => setShowAddModal(true)}><Plus size={14} /> 新增文件</button>
        </div>
      </div>

      <div className="archive-grid">
        {/* Left: Category Tree */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-border)', borderRadius: '10px', padding: '10px 0', height: 'fit-content' }}>
          <div style={{ padding: '0 12px 8px', fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 700, letterSpacing: '0.08em' }}>文件分類</div>
          {[{ key: 'all', label: '全部文件', icon: null }].concat(CATEGORY_TREE).map(cat => {
            const count = cat.key === 'all' ? records.length : (catCounts[cat.key] || 0);
            const active = activeCategory === cat.key;
            return (
              <div key={cat.key} onClick={() => setActiveCategory(cat.key)}
                style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: active ? 'var(--color-bg2)' : 'transparent',
                  borderLeft: active ? '2px solid var(--color-primary)' : '2px solid transparent',
                  transition: 'all 0.15s' }}>
                <span style={{ fontSize: '12px', color: active ? 'var(--color-primary-light)' : 'var(--color-text2)', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                  {cat.icon ? <span>{cat.icon}</span> : <FolderOpen size={12} />}
                  {cat.label}
                </span>
                {count > 0 && (
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{count}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Document List */}
        <div className="archive-doc-list">
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input type="text" placeholder="搜尋文件名稱、文號、標籤…" value={searchQ} onChange={e => setSearchQ(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 32px', background: 'var(--color-bg1)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text1)', fontSize: '13px', boxSizing: 'border-box' }} />
          </div>

          {/* Document Cards */}
          {filtered.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-surface-border)', borderRadius: '10px' }}>
              <FolderOpen size={36} style={{ color: 'var(--color-border)', margin: '0 auto 12px' }} />
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                {searchQ ? '找不到符合條件的文件' : '目前無歸檔文件 — 點擊「新增文件」建立'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filtered.map(doc => {
                const cat = CATEGORY_TREE.find(c => c.key === doc.category);
                const tags = Array.isArray(doc.tags) ? doc.tags : (doc.tags ? doc.tags.split(',').map(t => t.trim()).filter(Boolean) : []);
                const hasSource = doc.source_table && doc.submission_id;
                return (
                  <div key={doc.id} style={{
                    padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px',
                    background: 'var(--color-surface)', borderRadius: '8px',
                    border: selected.has(doc.id) ? '1px solid var(--color-primary)' : '1px solid var(--color-surface-border)',
                    transition: 'border-color 0.15s',
                  }}>
                    <input type="checkbox" checked={selected.has(doc.id)}
                      onChange={() => setSelected(prev => { const ns = new Set(prev); ns.has(doc.id) ? ns.delete(doc.id) : ns.add(doc.id); return ns; })}
                      style={{ marginTop: '2px', accentColor: 'var(--color-primary)' }} />
                    <div style={{ fontSize: '20px', flexShrink: 0 }}>{cat?.icon || '📁'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text1)' }}>{doc.title}</span>
                        {doc.doc_no && (
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace', background: 'var(--color-bg2)', padding: '1px 6px', borderRadius: '4px' }}>
                            {doc.doc_no}
                          </span>
                        )}
                        {doc.version && (
                          <span style={{ fontSize: '10px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#1565C0', background: 'rgba(21,101,192,0.1)', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(21,101,192,0.2)' }}>
                            {doc.version}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                        {doc.doc_date && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Calendar size={10} />{doc.doc_date}</span>}
                        {doc.sender && <span>發文：{doc.sender}</span>}
                        {doc.receiver && <span>收文：{doc.receiver}</span>}
                        {cat && <span style={{ color: 'var(--color-primary-light)', opacity: 0.8 }}>{cat.label}</span>}
                      </div>
                      {tags.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                          {tags.map(t => (
                            <span key={t} style={{ padding: '1px 6px', background: 'rgba(21,101,192,0.08)', color: 'var(--color-primary-light)', borderRadius: '4px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <Tag size={8} />{t}
                            </span>
                          ))}
                        </div>
                      )}
                      {doc.remark && (() => {
                        try {
                          const parsed = JSON.parse(doc.remark);
                          if (parsed && typeof parsed === 'object') {
                            // 照片記錄：顯示張數摘要而非原始 JSON
                            if (parsed.count !== undefined) return null;
                            return null; // 其他 JSON 物件不顯示
                          }
                        } catch { /* 不是 JSON，繼續顯示文字 */ }
                        return <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px', lineHeight: 1.5 }}>{doc.remark}</p>;
                      })()}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
                      {doc.category === 'photo' && doc.remark && (
                        <button
                          onClick={() => previewPhotoDoc(doc, project?.name)}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: 'rgba(21,101,192,0.08)', border: '1px solid rgba(21,101,192,0.2)', borderRadius: '6px', fontSize: '11px', color: 'var(--color-primary-light)', cursor: 'pointer', transition: 'all 0.15s' }}
                          title="預覽照片報告 PDF">
                          <Printer size={11} /> 預覽 PDF
                        </button>
                      )}
                      {doc.file_url && (
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '11px', color: 'var(--color-text2)', textDecoration: 'none' }}>
                          <Download size={11} /> 下載
                        </a>
                      )}
                      {hasSource && (
                        <button onClick={() => bumpDoc(doc)} disabled={bumpingId === doc.id}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: 'rgba(21,101,192,0.08)', border: '1px solid rgba(21,101,192,0.2)', borderRadius: '6px', fontSize: '11px', color: 'var(--color-primary-light)', cursor: 'pointer', transition: 'all 0.15s' }}
                          title={`建立 ${bumpVersion(doc.version)} 版本`}>
                          {bumpingId === doc.id ? <Loader2 size={11} className="mcs-spin" /> : <GitBranch size={11} />}
                          進版
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', paddingTop: '4px' }}>
            共 {filtered.length} 份文件{searchQ ? `（搜尋：${searchQ}）` : ''}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="modal-box" style={{ maxWidth: '560px', width: '92%' }}>
            <div className="modal-header">
              <div className="modal-title"><FolderOpen size={16} style={{ color: 'var(--color-primary-light)' }} /><span>新增歸檔文件</span></div>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  { label: '文件名稱', field: 'title', type: 'text', placeholder: '文件主旨', full: true },
                  { label: '文件分類', field: 'category', type: 'select', opts: CATEGORY_TREE.map(c => ({ value: c.key, label: `${c.icon} ${c.label}` })) },
                  { label: '版本號', field: 'version', type: 'text', placeholder: 'v1' },
                  { label: '文號', field: 'doc_no', type: 'text', placeholder: '例：府水工二字第...' },
                  { label: '文件日期', field: 'doc_date', type: 'date' },
                  { label: '發文機關', field: 'sender', type: 'text', placeholder: '發文單位' },
                  { label: '收文機關', field: 'receiver', type: 'text', placeholder: '收文單位' },
                  { label: '標籤（逗號分隔）', field: 'tags', type: 'text', placeholder: '例：混凝土,鋼筋,品管', full: true },
                  { label: '檔案連結', field: 'file_url', type: 'url', placeholder: 'https://...', full: true },
                  { label: '備註', field: 'remark', type: 'text', placeholder: '備註說明', full: true },
                ].map(({ label, field, type, placeholder, full, opts }) => (
                  <div key={field} style={{ gridColumn: full ? '1 / -1' : undefined }}>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>{label}</label>
                    {type === 'select' ? (
                      <select value={newForm[field]} onChange={e => setNewForm(prev => ({ ...prev, [field]: e.target.value }))}
                        style={{ width: '100%', padding: '6px 8px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text1)', fontSize: '13px' }}>
                        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input type={type} placeholder={placeholder} value={newForm[field] || ''}
                        onChange={e => setNewForm(prev => ({ ...prev, [field]: e.target.value }))}
                        style={{ width: '100%', padding: '6px 8px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text1)', fontSize: '13px', boxSizing: 'border-box' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>取消</button>
              <button className="btn-primary" onClick={addRecord} disabled={saving || !newForm.title.trim()}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} 新增
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
