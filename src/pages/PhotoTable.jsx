/* ============================================================
   PhotoTable.jsx — 現場照片查驗記錄
   功能：每格含照片上傳+描述，可列印 A4 查驗記錄表
   ============================================================ */
import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Camera, Plus, Trash2, Printer, X, Download, RotateCcw } from 'lucide-react';
import { useProject } from '../hooks/useProject';
import './PhotoTable.css';

const today = () => new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
const todayISO = () => new Date().toISOString().split('T')[0];

const EMPTY_CELL = () => ({ id: crypto.randomUUID(), photo: null, location: '', description: '', date: todayISO() });
const LAYOUT_OPTIONS = [
  { key: '2x3', label: '2×3（每頁6張）', cols: 2, rows: 3 },
  { key: '2x2', label: '2×2（每頁4張）', cols: 2, rows: 2 },
  { key: '3x3', label: '3×3（每頁9張）', cols: 3, rows: 3 },
];

export function PhotoTable() {
  const { id: projectId } = useParams();
  const { project } = useProject(projectId);

  const [layout, setLayout] = useState('2x3');
  const [title, setTitle] = useState('施工查驗照片記錄表');
  const [inspector, setInspector] = useState('');
  const [cells, setCells] = useState(() => Array.from({ length: 6 }, EMPTY_CELL));
  const printRef = useRef(null);
  const fileInputRefs = useRef({});

  const currentLayout = LAYOUT_OPTIONS.find(l => l.key === layout);
  const perPage = currentLayout.cols * currentLayout.rows;

  function addCell() {
    setCells(prev => [...prev, EMPTY_CELL()]);
  }

  function removeCell(id) {
    setCells(prev => prev.filter(c => c.id !== id));
  }

  function updateCell(id, field, value) {
    setCells(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  }

  function handlePhotoUpload(id, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => updateCell(id, 'photo', e.target.result);
    reader.readAsDataURL(file);
  }

  function resetAll() {
    setCells(Array.from({ length: perPage }, EMPTY_CELL));
  }

  function handlePrint() {
    window.print();
  }

  // 分頁
  const pages = [];
  for (let i = 0; i < cells.length; i += perPage) {
    pages.push(cells.slice(i, i + perPage));
  }

  return (
    <div className="photo-table-root">
      {/* ── 工具列（列印時隱藏）── */}
      <div className="photo-table-toolbar no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text1)' }}>照片查驗記錄</span>

          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="表單標題"
            style={{ padding: '4px 8px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: '5px', fontSize: '0.75rem', color: 'var(--color-text1)', width: 220 }}
          />
          <input
            value={inspector}
            onChange={e => setInspector(e.target.value)}
            placeholder="查驗人員"
            style={{ padding: '4px 8px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: '5px', fontSize: '0.75rem', color: 'var(--color-text1)', width: 120 }}
          />
          <select
            value={layout}
            onChange={e => setLayout(e.target.value)}
            style={{ padding: '4px 8px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: '5px', fontSize: '0.75rem', color: 'var(--color-text1)' }}
          >
            {LAYOUT_OPTIONS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
          <button className="pt-btn" onClick={resetAll} title="清除重設">
            <RotateCcw size={13} />清除
          </button>
          <button className="pt-btn" onClick={addCell}>
            <Plus size={13} />加格
          </button>
          <button className="pt-btn pt-btn-primary" onClick={handlePrint}>
            <Printer size={13} />列印 A4
          </button>
        </div>
      </div>

      {/* ── 預覽／列印區 ── */}
      <div ref={printRef}>
        {pages.map((page, pi) => (
          <div key={pi} className="photo-table-page">
            {/* 頁首 */}
            <div className="pt-page-header">
              <div className="pt-page-title">{title}</div>
              <div className="pt-page-meta">
                <span>工程名稱：{project?.name || '—'}</span>
                <span>查驗日期：{today()}</span>
                <span>查驗人員：{inspector || '—'}</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                  第 {pi + 1} 頁 / 共 {pages.length} 頁
                </span>
              </div>
            </div>

            {/* 照片格 */}
            <div
              className="pt-photo-grid"
              style={{ gridTemplateColumns: `repeat(${currentLayout.cols}, 1fr)` }}
            >
              {page.map((cell, ci) => (
                <div key={cell.id} className="pt-photo-cell">
                  {/* 照片區 */}
                  <div className="pt-photo-area no-print-border"
                    onClick={() => !cell.photo && fileInputRefs.current[cell.id]?.click()}
                    style={{ cursor: cell.photo ? 'default' : 'pointer' }}
                  >
                    {cell.photo ? (
                      <>
                        <img src={cell.photo} alt={`照片 ${pi * perPage + ci + 1}`} className="pt-photo-img" />
                        <button
                          className="pt-photo-remove no-print"
                          onClick={e => { e.stopPropagation(); updateCell(cell.id, 'photo', null); }}
                          title="移除照片"
                        >
                          <X size={11} />
                        </button>
                      </>
                    ) : (
                      <div className="pt-photo-placeholder no-print">
                        <Camera size={24} style={{ opacity: 0.3 }} />
                        <span>點擊上傳照片</span>
                        <span style={{ fontSize: '0.65rem' }}>JPG / PNG / HEIC</span>
                      </div>
                    )}
                    <input
                      ref={el => fileInputRefs.current[cell.id] = el}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => handlePhotoUpload(cell.id, e.target.files[0])}
                    />
                    {/* 列印時的空白框 */}
                    {!cell.photo && <div className="pt-photo-print-placeholder" />}
                  </div>

                  {/* 資訊區 */}
                  <div className="pt-photo-info">
                    <div className="pt-info-row">
                      <span className="pt-info-label">編號</span>
                      <span className="pt-info-val">{pi * perPage + ci + 1}</span>
                      <input
                        className="pt-info-date no-print"
                        type="date"
                        value={cell.date}
                        onChange={e => updateCell(cell.id, 'date', e.target.value)}
                      />
                      <span className="pt-print-only">{cell.date}</span>
                    </div>
                    <div className="pt-info-row">
                      <span className="pt-info-label">位置</span>
                      <input
                        className="pt-info-input no-print"
                        placeholder="部位/位置說明"
                        value={cell.location}
                        onChange={e => updateCell(cell.id, 'location', e.target.value)}
                      />
                      <span className="pt-print-only pt-print-field">{cell.location || '　'}</span>
                    </div>
                    <div className="pt-info-row pt-info-desc">
                      <span className="pt-info-label">說明</span>
                      <textarea
                        className="pt-info-textarea no-print"
                        placeholder="施工說明、查驗結果…"
                        value={cell.description}
                        rows={2}
                        onChange={e => updateCell(cell.id, 'description', e.target.value)}
                      />
                      <span className="pt-print-only pt-print-field" style={{ minHeight: 36 }}>{cell.description || '　'}</span>
                    </div>
                  </div>

                  {/* 刪除按鈕（非列印） */}
                  {cells.length > 1 && (
                    <button className="pt-cell-remove no-print" onClick={() => removeCell(cell.id)} title="移除此格">
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* 頁尾 */}
            <div className="pt-page-footer">
              <span>監造單位：______________________________</span>
              <span>簽章：______________</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
