/* ============================================================
   PhotoTable.jsx — 工程照片報告產生器
   參考：brianh2025.github.io/photo-table/
   流程：① 上傳照片 → ② 逐張填資料 → ③ 預覽/列印
   ============================================================ */
import React, { useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Camera, Upload, ChevronLeft, ChevronRight,
  Printer, RotateCcw, X, Check, FileImage,
} from 'lucide-react';
import { useProject } from '../hooks/useProject';
import './PhotoTable.css';

const PHOTOS_PER_PAGE = 3;

function toRocDate(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate + 'T00:00:00');
  return `${d.getFullYear() - 1911}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

/* ── 步驟一：上傳照片 ── */
function StepUpload({ onPhotosReady }) {
  const [previews, setPreviews] = useState([]);
  const inputRef = useRef(null);

  const handleFiles = useCallback((files) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    arr.forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        setPreviews(prev => [...prev, {
          id: crypto.randomUUID(),
          src: e.target.result,
          file,
        }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  function handleDrop(e) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  function removePhoto(id) {
    setPreviews(prev => prev.filter(p => p.id !== id));
  }

  return (
    <div className="pt-step-upload">
      <div className="pt-upload-zone"
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
        <div>點擊或拖曳照片至此</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 4 }}>支援 JPG、PNG、HEIC，可一次多選</div>
        <input ref={inputRef} type="file" multiple accept="image/*" style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)} />
      </div>

      {previews.length > 0 && (
        <>
          <div className="pt-thumb-grid">
            {previews.map(p => (
              <div key={p.id} className="pt-thumb-cell">
                <img src={p.src} alt="" className="pt-thumb-img" />
                <button className="pt-thumb-remove" onClick={() => removePhoto(p.id)}><X size={11} /></button>
              </div>
            ))}
          </div>
          <div className="pt-upload-actions">
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>已選 {previews.length} 張照片</span>
            <button className="pt-btn pt-btn-primary" onClick={() => onPhotosReady(previews)}>
              <Check size={14} />開始填寫資料
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── 步驟二：逐張填寫資料 ── */
function StepEntry({ photos, onComplete, onBack }) {
  const [index, setIndex] = useState(0);
  const [data, setData] = useState(() => photos.map(() => ({
    date: todayISO(),
    location: '',
    description: '',
  })));

  function update(field, val) {
    setData(prev => prev.map((d, i) => i === index ? { ...d, [field]: val } : d));
  }

  const current = photos[index];
  const currentData = data[index];

  return (
    <div className="pt-step-entry">
      <div className="pt-entry-header">
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text1)' }}>
          填寫照片資料
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
          {index + 1} / {photos.length}
        </span>
      </div>

      <div className="pt-entry-body">
        {/* 照片預覽 */}
        <div className="pt-entry-preview">
          <img src={current.src} alt="" style={{ maxWidth: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 6 }} />
        </div>

        {/* 欄位 */}
        <div className="pt-entry-fields">
          <div>
            <label className="form-label">拍攝日期</label>
            <input className="form-input" type="date" value={currentData.date}
              onChange={e => update('date', e.target.value)} style={{ marginTop: 4 }} />
          </div>
          <div>
            <label className="form-label">拍攝位置</label>
            <input className="form-input" placeholder="例：B棟1F柱位 A3 / 3號排水溝上游"
              value={currentData.location} onChange={e => update('location', e.target.value)} style={{ marginTop: 4 }} />
          </div>
          <div>
            <label className="form-label">說明</label>
            <textarea className="form-input" rows={4}
              placeholder="施工說明、查驗結果、缺失描述…"
              value={currentData.description} onChange={e => update('description', e.target.value)}
              style={{ marginTop: 4, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
        </div>
      </div>

      <div className="pt-entry-nav">
        <button className="pt-btn" onClick={onBack}><RotateCcw size={13} />重新上傳</button>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button className="pt-btn" disabled={index === 0} onClick={() => setIndex(i => i - 1)}>
            <ChevronLeft size={14} />上一張
          </button>
          {index < photos.length - 1 ? (
            <button className="pt-btn pt-btn-primary" onClick={() => setIndex(i => i + 1)}>
              下一張<ChevronRight size={14} />
            </button>
          ) : (
            <button className="pt-btn pt-btn-primary" onClick={() => onComplete(data)}>
              <Check size={14} />產生報告
            </button>
          )}
        </div>
      </div>

      {/* 進度點 */}
      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 8 }}>
        {photos.map((_, i) => (
          <div key={i} onClick={() => setIndex(i)} style={{
            width: 8, height: 8, borderRadius: '50%', cursor: 'pointer',
            background: i === index ? 'var(--color-primary)' : 'var(--color-border)',
            transition: 'background 0.15s',
          }} />
        ))}
      </div>
    </div>
  );
}

/* ── 步驟三：報告預覽 ── */
function StepReport({ photos, data, projectName, reportNo, onBack }) {
  // 分頁
  const pages = [];
  for (let i = 0; i < photos.length; i += PHOTOS_PER_PAGE) {
    pages.push(photos.slice(i, i + PHOTOS_PER_PAGE).map((p, j) => ({ photo: p, info: data[i + j] })));
  }

  return (
    <div className="pt-step-report">
      {/* 列印工具列 */}
      <div className="pt-report-toolbar no-print">
        <button className="pt-btn" onClick={onBack}><RotateCcw size={13} />返回編輯</button>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: 8 }}>
          共 {photos.length} 張照片 / {pages.length} 頁
        </span>
        <button className="pt-btn pt-btn-primary" style={{ marginLeft: 'auto' }} onClick={() => window.print()}>
          <Printer size={13} />列印 / 另存 PDF
        </button>
      </div>

      {/* A4 報告頁 */}
      {pages.map((page, pi) => (
        <div key={pi} className="report-page">
          {/* 頁首 */}
          <div className="report-header">
            <div className="report-header-left" />
            <div className="report-header-center">
              <h1>{projectName || '工程名稱'}</h1>
              <h2>施工 / 材料抽查照片</h2>
            </div>
            <div className="report-header-right">
              {reportNo && <div>編號：{reportNo}</div>}
              <div>第 {pi + 1} 頁</div>
            </div>
          </div>

          {/* 照片區塊 */}
          <table className="report-table-b">
            <tbody>
              {page.map((item, ci) => (
                <React.Fragment key={ci}>
                  {/* 照片列 */}
                  <tr className="report-block-b">
                    <td className="photo-cell-b">
                      <img src={item.photo.src} alt={`照片 ${pi * PHOTOS_PER_PAGE + ci + 1}`} />
                    </td>
                    <td className="info-cell-b">
                      <div className="info-location">{item.info.location || '（無位置說明）'}</div>
                      <div className="info-date">{toRocDate(item.info.date)}</div>
                    </td>
                  </tr>
                  {/* 說明列 */}
                  <tr className="description-row-b">
                    <td colSpan={2} className="desc-cell-b">
                      說明：{item.info.description || ''}
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

/* ── 主元件 ── */
export function PhotoTable() {
  const { id: projectId } = useParams();
  const { project } = useProject(projectId);
  const [step, setStep] = useState(1); // 1=上傳 2=填資料 3=報告
  const [photos, setPhotos] = useState([]);
  const [photoData, setPhotoData] = useState([]);
  const [reportNo, setReportNo] = useState('');

  function handlePhotosReady(ps) {
    setPhotos(ps);
    setStep(2);
  }

  function handleEntryComplete(data) {
    setPhotoData(data);
    setStep(3);
  }

  return (
    <div className="photo-table-root">
      {/* 工具列（步驟1、2時顯示設定欄） */}
      {step < 3 && (
        <div className="photo-table-toolbar no-print">
          <FileImage size={15} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text1)' }}>工程照片報告產生器</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              placeholder="編號（選填）"
              value={reportNo}
              onChange={e => setReportNo(e.target.value)}
              style={{ padding: '4px 8px', background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 5, fontSize: '0.75rem', color: 'var(--color-text1)', width: 120 }}
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <StepUpload onPhotosReady={handlePhotosReady} />
      )}
      {step === 2 && (
        <StepEntry
          photos={photos}
          onComplete={handleEntryComplete}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <StepReport
          photos={photos}
          data={photoData}
          projectName={project?.name}
          reportNo={reportNo}
          onBack={() => setStep(2)}
        />
      )}
    </div>
  );
}
