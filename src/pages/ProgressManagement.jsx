import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Plus, Upload, Download, Edit, Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ProgressFormModal } from '../components/ProgressFormModal';
import { ProgressExcelImportModal } from '../components/ProgressExcelImportModal';
import { ScheduleImportModal } from '../components/ScheduleImportModal';
import { fmtPct } from '../utils/format';

export function ProgressManagement() {
  const { id } = useParams();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [scheduleItems, setScheduleItems] = useState([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  const fetchRecords = async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await supabase
      .from('progress_records')
      .select('*')
      .eq('project_id', id)
      .order('report_date', { ascending: true });
    if (data) setRecords(data);
    setLoading(false);
  };

  const fetchScheduleItems = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('schedule_items')
      .select('*')
      .eq('project_id', id)
      .order('sort_order', { ascending: true });
    if (data) setScheduleItems(data);
  };

  useEffect(() => {
    async function init() {
      await fetchRecords();
      await fetchScheduleItems();
    }
    init();
  }, [id]);

  const handleDelete = async (recordId) => {
    if (!window.confirm('確定要刪除這筆進度紀錄嗎？')) return;
    await supabase.from('progress_records').delete().eq('id', recordId);
    fetchRecords();
  };

  const handleEdit = (record) => { setEditingRecord(record); setIsFormModalOpen(true); };
  const handleAdd = () => { setEditingRecord(null); setIsFormModalOpen(true); };

  const handleDeleteScheduleItem = async (itemId) => {
    if (!window.confirm('確定要刪除這筆工程計畫項目嗎？')) return;
    await supabase.from('schedule_items').delete().eq('id', itemId);
    fetchScheduleItems();
  };

  const handleClearSchedule = async () => {
    if (!window.confirm('確定要清空全部工程計畫項目嗎？此操作無法復原。')) return;
    await supabase.from('schedule_items').delete().eq('project_id', id);
    fetchScheduleItems();
  };

  const exportProgress = async () => {
    if (!records.length) return;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('歷史進度紀錄');
    ws.columns = [
      { header: '報告日期',    key: '報告日期',    width: 14 },
      { header: '預定進度(%)', key: '預定進度(%)', width: 12 },
      { header: '實際進度(%)', key: '實際進度(%)', width: 12 },
      { header: '差異(%)',     key: '差異(%)',     width: 10 },
      { header: '備註',        key: '備註',        width: 30 },
    ];
    records.forEach(r => {
      const planned = calcPlanned(r.report_date);
      ws.addRow({
        '報告日期':    r.report_date,
        '預定進度(%)': planned !== null ? parseFloat(planned.toFixed(2)) : '',
        '實際進度(%)': r.actual_progress,
        '差異(%)':     planned !== null ? parseFloat((r.actual_progress - planned).toFixed(2)) : '',
        '備註':        r.notes || '',
      });
    });
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `進度紀錄_${id?.slice(0,8)}.xlsx`);
  };

  const exportSchedule = async () => {
    if (!scheduleItems.length) return;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('工程計畫進度表');
    ws.columns = [
      { header: '工項名稱', key: '工項名稱', width: 20 },
      { header: '開始日期', key: '開始日期', width: 14 },
      { header: '結束日期', key: '結束日期', width: 14 },
      { header: '工期(天)', key: '工期(天)', width: 10 },
      { header: '權重(%)',  key: '權重(%)',  width: 10 },
    ];
    scheduleItems.forEach(r => {
      ws.addRow({
        '工項名稱': r.item_name,
        '開始日期': r.start_date,
        '結束日期': r.end_date,
        '工期(天)': (r.start_date && r.end_date) ? Math.round((new Date(r.end_date) - new Date(r.start_date)) / 86400000) + 1 : '',
        '權重(%)':  r.weight,
      });
    });
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `計畫進度表_${id?.slice(0,8)}.xlsx`);
  };

  // 從 schedule_items 推算任意日期的預定進度（線性插值，跳過無日期的工項）
  // weight 全為 0（如尚未匯入計畫）時回傳 null，讓呼叫端 fallback 到儲存值
  const calcPlanned = (dateStr) => {
    if (!scheduleItems.length) return null;
    const totalWeight = scheduleItems.reduce((s, i) => s + parseFloat(i.weight ?? 0), 0);
    if (totalWeight === 0) return null;
    const d = new Date(dateStr).getTime();
    return scheduleItems.reduce((sum, item) => {
      if (!item.start_date || !item.end_date) return sum;
      const s = new Date(item.start_date).getTime();
      const e = new Date(item.end_date).getTime();
      const ratio = e === s ? (d >= e ? 1 : 0) : Math.min(1, Math.max(0, (d - s) / (e - s)));
      return sum + parseFloat(item.weight ?? 0) * ratio;
    }, 0);
  };

  // S-Curve 日期：每月一點（從排程首日到末日）+ 實際紀錄日期
  const scheduleStart = scheduleItems.length > 0
    ? scheduleItems.map(i => i.start_date).filter(Boolean).sort()[0]
    : null;
  const scheduleEnd = scheduleItems.length > 0
    ? scheduleItems.map(i => i.end_date).filter(Boolean).sort().at(-1)
    : null;
  const monthlyDates = (() => {
    if (!scheduleStart || !scheduleEnd) return [];
    const dates = [];
    const d = new Date(scheduleStart);
    const end = new Date(scheduleEnd);
    while (d <= end) {
      dates.push(d.toISOString().slice(0, 10));
      d.setMonth(d.getMonth() + 1);
    }
    dates.push(scheduleEnd);
    return dates;
  })();
  const chartDates = [...new Set([
    ...monthlyDates,
    ...records.map(r => r.report_date),
  ])].sort();

  const actualMap = Object.fromEntries(records.map(r => [r.report_date, Number(r.actual_progress)]));
  const plannedMap = Object.fromEntries(records.map(r => [r.report_date, Number(r.planned_progress)]));

  const chartData = scheduleItems.length > 0
    ? chartDates.map(date => {
        const calcVal = calcPlanned(date);
        const stored = plannedMap[date];
        const planned = (calcVal !== null && calcVal > 0)
          ? parseFloat(calcVal.toFixed(2))
          : (stored > 0 ? parseFloat(Number(stored).toFixed(2)) : null);
        return {
          displayDate: date.slice(5),
          report_date: date,
          預定進度: planned,
          實際進度: actualMap[date] ?? null,
        };
      })
    : records.map(r => ({
        displayDate: r.report_date.slice(5),
        report_date: r.report_date,
        預定進度: null,
        實際進度: Number(r.actual_progress),
      }));

  // Latest record summary
  const latest = records[records.length - 1];
  const _calcLatest = latest ? calcPlanned(latest.report_date) : null;
  const latestPlanned = latest ? (
    (_calcLatest !== null && _calcLatest > 0)
      ? _calcLatest
      : (Number(latest.planned_progress) > 0 ? Number(latest.planned_progress) : _calcLatest)
  ) : null;
  const latestDiff = latest && latestPlanned !== null && latestPlanned > 0
    ? (Number(latest.actual_progress) - latestPlanned)
    : null;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--color-text-muted)' }}>
      載入進度資料中…
    </div>
  );

  return (
    <div style={{ padding: '8px 24px', width: '100%' }}>
      {/* Page Header */}
      <header className="page-section-header" style={{ marginBottom: '8px' }}>
        <div className="header-left">
          <span className="section-label">進度管理</span>
        </div>
        <div className="header-actions">
          {latest && (
            <span className="status-badge" style={{
              background: latestDiff !== null && latestDiff >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
              color: latestDiff !== null && latestDiff >= 0 ? 'var(--color-success)' : '#ef4444',
            }}>
              實際 {fmtPct(latest.actual_progress)}<br />
              {latestPlanned !== null && latestPlanned > 0 && <>預定 {fmtPct(latestPlanned)}{' '}</>}
              {latestDiff !== null && <>{latestDiff >= 0 ? '超前' : '落後'} {fmtPct(Math.abs(latestDiff))}</>}
            </span>
          )}
          <button className="btn-dash-action" onClick={handleAdd} style={{ background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }}>
            <Plus size={14} /><span>新增進度</span>
          </button>
        </div>
      </header>

      {/* S-Curve + Records — 合併區塊 */}
      <div className="b-content-panel" style={{ padding: 0, overflow: 'hidden', marginBottom: '8px' }}>
        {/* 區塊標題 */}
        <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--color-block-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '3px', height: '18px', background: 'var(--color-primary)', borderRadius: '2px', display: 'inline-block' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text1)' }}>進度曲線 &amp; 歷史紀錄</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{records.length} 筆</span>
            <button className="btn-dash-action" onClick={() => setIsExcelModalOpen(true)} style={{ padding: '3px 10px', fontSize: '11px' }}>
              <Upload size={12} /><span>匯入</span>
            </button>
            <button className="btn-dash-action" onClick={exportProgress} disabled={!records.length} style={{ padding: '3px 10px', fontSize: '11px' }}>
              <Download size={12} /><span>匯出</span>
            </button>
          </div>
        </div>

        {/* S-Curve 圖表 */}
        <div style={{ padding: '8px 4px' }}>
          {scheduleItems.length > 0 || records.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: chartDates.length > 12 ? 20 : 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-block-border)" />
                <XAxis
                  dataKey="displayDate"
                  stroke="var(--color-text-muted)"
                  tick={{ fontSize: 11 }}
                  interval={chartDates.length > 20 ? Math.ceil(chartDates.length / 10) - 1 : 'preserveStartEnd'}
                  angle={chartDates.length > 12 ? -35 : 0}
                  textAnchor={chartDates.length > 12 ? 'end' : 'middle'}
                  height={chartDates.length > 12 ? 45 : 30}
                />
                <YAxis stroke="var(--color-text-muted)" tick={{ fontSize: 11 }} domain={[0, dataMax => Math.max(10, Math.ceil(dataMax * 1.2))]} unit="%" />
                <Tooltip
                  contentStyle={{ background: 'var(--color-bg1)', border: '1px solid var(--color-block-border)', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(v) => v !== null ? fmtPct(v) : '—'}
                />
                <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="預定進度" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="實際進度" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '13px', border: '1px dashed var(--color-block-border)', borderRadius: '8px' }}>
              尚無資料，請先匯入工程計畫進度表
            </div>
          )}
        </div>

        {/* 分隔線 + 表格標題 */}
        <div style={{ padding: '10px 20px', borderTop: '1px solid var(--color-block-border)', borderBottom: '1px solid var(--color-block-border)', background: 'var(--color-bg2)', fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
          歷史進度紀錄
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg2)' }}>
                {['報告日期', '預定進度', '實際進度', '差異', '操作'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-block-border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.length > 0 ? records.map((r) => {
                const calcVal = calcPlanned(r.report_date);
                // calcPlanned=0 表示排程未開始，fallback 到資料庫儲存值
                const planned = (calcVal !== null && calcVal > 0)
                  ? calcVal
                  : (r.planned_progress > 0 ? r.planned_progress : calcVal);
                const diff = planned !== null
                  ? (Number(r.actual_progress) - planned)
                  : null;
                const ahead = diff !== null && diff >= 0;
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--color-block-border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg2)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td style={{ padding: '10px 16px', color: 'var(--color-text1)', fontWeight: 500, whiteSpace: 'nowrap' }}>{r.report_date}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--color-text2)' }}>{fmtPct(planned)}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--color-text2)' }}>{fmtPct(r.actual_progress)}</td>
                    <td style={{ padding: '10px 16px' }}>
                      {diff === null ? <span style={{ color: 'var(--color-text-muted)' }}>—</span> : (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                        background: ahead ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
                        color: ahead ? '#10b981' : '#ef4444',
                      }}>
                        {ahead ? <TrendingUp size={11} /> : diff === 0 ? <Minus size={11} /> : <TrendingDown size={11} />}
                        {diff > 0 ? '+' : ''}{fmtPct(Math.abs(diff))}
                      </span>
                      )}
                    </td>

                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleEdit(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '2px', borderRadius: '4px', transition: 'color 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--color-primary)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
                          title="編輯">
                          <Edit size={15} />
                        </button>
                        <button onClick={() => handleDelete(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '2px', borderRadius: '4px', transition: 'color 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
                          title="刪除">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                    尚無進度資料，請點擊「新增進度」或「匯入 Excel」
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 工程計畫項目 */}
      <div className="b-content-panel" style={{ padding: 0, overflow: 'hidden', marginTop: '16px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-block-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '3px', height: '18px', background: 'var(--color-primary)', borderRadius: '2px', display: 'inline-block' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text1)' }}>工程計畫項目</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {scheduleItems.length} 項
              {scheduleItems.length > 0 && `｜總權重 ${scheduleItems.reduce((s, r) => s + parseFloat(r.weight), 0).toFixed(2)}%`}
            </span>
            <button className="btn-dash-action" onClick={() => setIsScheduleModalOpen(true)} style={{ padding: '3px 10px', fontSize: '11px' }}>
              <Upload size={12} /><span>匯入</span>
            </button>
            <button className="btn-dash-action" onClick={exportSchedule} disabled={!scheduleItems.length} style={{ padding: '3px 10px', fontSize: '11px' }}>
              <Download size={12} /><span>匯出</span>
            </button>
            {scheduleItems.length > 0 && (
              <button onClick={handleClearSchedule} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: '1px solid #ef4444', borderRadius: '6px', padding: '3px 10px', fontSize: '11px', color: '#ef4444', cursor: 'pointer' }}>
                <Trash2 size={12} />清空
              </button>
            )}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg2)' }}>
                {['#','工項名稱','開始日期','結束日期','工期(天)','權重(%)','操作'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: h === '工期(天)' || h === '權重(%)' ? 'right' : 'left', fontWeight: 500, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-block-border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scheduleItems.length > 0 ? scheduleItems.map((item, idx) => {
                const days = Math.round((new Date(item.end_date) - new Date(item.start_date)) / 86400000) + 1;
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--color-block-border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg2)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '10px 16px', color: 'var(--color-text-muted)' }}>{idx + 1}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--color-text1)', fontWeight: 500 }}>{item.item_name}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--color-text2)' }}>{item.start_date}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--color-text2)' }}>{item.end_date}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--color-text2)', textAlign: 'right' }}>{days}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 600, textAlign: 'right', color: 'var(--color-primary)' }}>{parseFloat(item.weight).toFixed(2)}%</td>
                    <td style={{ padding: '10px 16px' }}>
                      <button onClick={() => handleDeleteScheduleItem(item.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '2px', borderRadius: '4px' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
                        title="刪除">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                    尚無工程計畫項目，請點擊「匯入計畫進度表」
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isFormModalOpen && (
        <ProgressFormModal
          projectId={id}
          initialData={editingRecord}
          onClose={() => setIsFormModalOpen(false)}
          onSuccess={() => { setIsFormModalOpen(false); fetchRecords(); }}
          plannedProgress={editingRecord ? calcPlanned(editingRecord.report_date) : null}
          calcPlannedFn={scheduleItems.length > 0 ? calcPlanned : null}
        />
      )}

      {isExcelModalOpen && (
        <ProgressExcelImportModal
          projectId={id}
          onClose={() => setIsExcelModalOpen(false)}
          onSuccess={() => { setIsExcelModalOpen(false); fetchRecords(); }}
        />
      )}

      {isScheduleModalOpen && (
        <ScheduleImportModal
          projectId={id}
          onClose={() => setIsScheduleModalOpen(false)}
          onSuccess={() => { setIsScheduleModalOpen(false); fetchScheduleItems(); }}
        />
      )}
    </div>
  );
}
