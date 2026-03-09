import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import './DiaryPrintView.css';

export function DiaryPrintView() {
  const { projectId, logDate } = useParams();
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

  // Formatting date to ROC year (ex: 113年05月12日)
  const d = new Date(log.log_date);
  const rocYear = d.getFullYear() - 1911;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dateStr = `${rocYear} 年 ${mm} 月 ${dd} 日`;

  const weatherAm = log.weather_am || '—';
  const weatherPm = log.weather_pm || '—';

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
        <div className="print-hint">提示：請在列印設定中將「邊界」設為「無」或「預設」，並勾選「背景圖形」以獲得最佳輸出效果。</div>
      </div>

      {/* A4 Printable Sheet */}
      <div className="a4-sheet a4-portrait">
        <div className="diary-sheet-content">
          <h1 className="sheet-title">公共工程施工日誌</h1>
          
          <div className="sheet-meta-row">
            <div className="meta-item"><strong>工程名稱：</strong>{project.name}</div>
            <div className="meta-item"><strong>日期：</strong>{dateStr}</div>
          </div>
          
          <table className="sheet-table">
            <tbody>
              {/* 天氣 */}
              <tr>
                <th className="th-narrow" rowSpan={2}>天<br/>氣</th>
                <th className="th-sub">上午</th>
                <td className="td-weather">{weatherAm}</td>
                <th className="th-sub">下午</th>
                <td className="td-weather">{weatherPm}</td>
              </tr>
              <tr>
                <td colSpan={4} className="td-hint">
                  （氣溫、降雨量等詳細氣象資料，請依契約規定填寫或另附報表）
                </td>
              </tr>

              {/* 施工項目 */}
              <tr>
                <th className="th-narrow">施<br/>工<br/>項<br/>目</th>
                <td colSpan={4} className="td-content td-tall">
                  <div className="content-preserve-lines">
                    {log.work_items || '本日無施工項目紀錄'}
                  </div>
                </td>
              </tr>

              {/* 出工人數 / 機具 (Placeholder for now since table was deferred) */}
              <tr>
                <th className="th-narrow">出<br/>工<br/>人<br/>數</th>
                <td colSpan={4} className="td-content td-medium">
                  <div className="no-data-hint">（本版系統暫未啟用每日出工自動統計，請依現場實際狀況填列或留白）</div>
                </td>
              </tr>
              <tr>
                <th className="th-narrow">機<br/>具<br/>使<br/>用</th>
                <td colSpan={4} className="td-content td-medium">
                  <div className="no-data-hint">（本版系統暫未啟用每日機具自動統計，請依現場實際狀況填列或留白）</div>
                </td>
              </tr>

              {/* 重要記事 */}
              <tr>
                <th className="th-narrow">重<br/>要<br/>記<br/>事</th>
                <td colSpan={4} className="td-content td-tall">
                  <div className="content-preserve-lines">
                    {log.notes || '無'}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* 簽名欄 */}
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
