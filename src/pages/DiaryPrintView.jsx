import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import './DiaryPrintView.css';

export function DiaryPrintView() {
  const { id: projectId, logDate } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      
      const { data: proj, error: projErr } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
        
      if (projErr) { setError('讀取工程資料失敗'); return; }
      setProject(proj);

      const { data: logData, error: logErr } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('project_id', projectId)
        .eq('log_date', logDate)
        .single();
        
      if (logErr) { setError('讀取日誌資料失敗'); return; }
      setLog(logData);
      
      setLoading(false);
    }
    
    if (projectId && logDate) loadData();
  }, [projectId, logDate]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="print-loading">載入表單中...</div>;
  if (error) return <div className="print-error">{error}</div>;

  // Formatting date to ROC year (ex: 114 / 2 / 28)
  const d = new Date(log.log_date);
  const rocYear = d.getFullYear() - 1911;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rocDateStr = `${rocYear} / ${mm} / ${dd}`;

  // Progress calculations
  const planned = log.planned_progress || 0;
  const actual = log.actual_progress || 0;
  const diff = (actual - planned).toFixed(2);

  // Split work_items back into rows for the table
  const workRows = log.work_items ? log.work_items.split('\n').filter(Boolean) : [];

  return (
    <div className="print-page-wrapper">
      {/* Non-printable screen controls */}
      <div className="print-screen-controls no-print">
        <button className="btn-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> 返回列表
        </button>
        <button className="btn-print-action" onClick={handlePrint}>
          <Printer size={16} /> 列印 / 儲存為 PDF
        </button>
        <div className="print-hint">提示：建議列印設定「背景圖形」以獲得正確表格顏色。</div>
      </div>

      {/* A4 Printable Sheet */}
      <div className="a4-sheet a4-portrait">
        <div className="diary-sheet-content">
          <h1 className="sheet-title">公共工程監造報表</h1>
          
          {/* Top Meta Info */}
          <div className="meta-info-grid">
            <div className="meta-item meta-label">工程名稱</div>
            <div className="meta-item">{project.name}</div>
            <div className="meta-item meta-label">工程編號</div>
            <div className="meta-item">（尚未編號）</div>
          </div>

          <table className="sheet-table border-top-none">
            <tbody>
              <tr>
                <th className="th-label">開工日期</th>
                <td className="td-center" style={{ width: '20%' }}>{project.start_date ? project.start_date.replace(/-/g, '/') : '—'}</td>
                <th className="th-label">填表日期</th>
                <td className="td-center" style={{ width: '20%' }}>{rocDateStr}</td>
                <th className="th-label">預計完工</th>
                <td className="td-center">{project.end_date ? project.end_date.replace(/-/g, '/') : '—'}</td>
              </tr>
              <tr>
               <th className="th-label">本日天氣</th>
               <td colSpan={5}>
                 <div style={{ display: 'flex', gap: '30px' }}>
                   <span>上午：<strong>{log.weather_am || '—'}</strong></span>
                   <span>下午：<strong>{log.weather_pm || '—'}</strong></span>
                 </div>
               </td>
              </tr>
            </tbody>
          </table>

          {/* Progress Grid */}
          <div className="progress-grid">
            <div className="progress-cell progress-label">契約工期</div>
            <div className="progress-cell progress-label">累計工期</div>
            <div className="progress-cell progress-label">剩餘工期</div>
            <div className="progress-cell progress-label">預定進度(%)</div>
            <div className="progress-cell progress-label">實際進度(%)</div>
            <div className="progress-cell progress-label">進度差異(%)</div>
            
            <div className="progress-cell">（日曆天）</div>
            <div className="progress-cell">（依契約）</div>
            <div className="progress-cell">（依實計）</div>
            <div className="progress-cell">{planned}%</div>
            <div className="progress-cell">{actual}%</div>
            <div className="progress-cell" style={{ color: diff < 0 ? 'red' : 'inherit' }}>{diff}%</div>
          </div>

          {/* Table Sections I to IV */}
          <table className="sheet-table" style={{ borderTop: 'none' }}>
            <tbody>
              {/* Section 1: Work Table */}
              <tr>
                <th className="th-narrow">一<br/>、<br/>施<br/>工<br/>項<br/>目<br/>數<br/>量</th>
                <td colSpan={5} style={{ padding: 0 }}>
                  <table className="work-table">
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', paddingLeft: '8px' }}>工程項目名稱</th>
                        <th style={{ width: '80px' }}>單位</th>
                        <th style={{ width: '100px' }}>今日完成</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workRows.length > 0 ? workRows.map((line, idx) => {
                        const parts = line.split(/[： ]/);
                        const name = parts[0] || line;
                        const qty = parts[1] || '—';
                        const unit = parts[2] || '';
                        return (
                          <tr key={idx}>
                            <td style={{ paddingLeft: '8px' }}>{name}</td>
                            <td className="td-center">{unit}</td>
                            <td className="td-center">{qty}</td>
                          </tr>
                        );
                      }) : (
                        <tr><td colSpan={3} className="td-center" style={{ height: '60px', color: '#999' }}>本日無施工數據</td></tr>
                      )}
                    </tbody>
                  </table>
                </td>
              </tr>

              {/* Section 2 */}
              <tr>
                <th className="th-narrow">二<br/>、<br/>監<br/>督<br/>施<br/>工</th>
                <td colSpan={5} className="td-content">
                  <div className="content-preserve-lines">
                    {log.notes || '（按核定施工圖施工）'}
                  </div>
                </td>
              </tr>

              {/* Section 3 */}
              <tr>
                <th className="th-narrow">三<br/>、<br/>查<br/>核<br/>品<br/>質</th>
                <td colSpan={5} className="td-content" style={{ minHeight: '60px' }}>
                  <div className="content-preserve-lines">
                    材料規格及品質抽查合格。
                  </div>
                </td>
              </tr>

              {/* Section 4 */}
              <tr>
                <th className="th-narrow">四<br/>、<br/>職<br/>安<br/>衛<br/>生</th>
                <td colSpan={5} className="td-content" style={{ minHeight: '60px' }}>
                  <div className="content-preserve-lines">
                    ■ 完成施工前檢查。
                    其他：工地整潔及人員防護具配戴正常。
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Signatures */}
          <div className="sheet-signatures">
            <div className="sig-box">
              <div className="sig-title">承攬廠商 (工地負責人)</div>
              <div className="sig-space"></div>
            </div>
            <div className="sig-box">
              <div className="sig-title">監造單位 (現場人員)</div>
              <div className="sig-space"></div>
            </div>
            <div className="sig-box">
              <div className="sig-title">主辦機關 (查核人員)</div>
              <div className="sig-space"></div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
