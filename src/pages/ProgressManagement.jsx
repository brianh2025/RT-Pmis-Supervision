import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Plus, Upload, Download, Edit, Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ProgressFormModal } from '../components/ProgressFormModal';
import { ProgressExcelImportModal } from '../components/ProgressExcelImportModal';
import { ScheduleImportModal } from '../components/ScheduleImportModal';

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

  const exportProgress = () => {
    if (!records.length) return;
    const data = records.map(r => {
      const planned = calcPlanned(r.report_date);
      return {
        '報告日期': r.report_date,
        '預定進度(%)': planned !== null ? parseFloat(planned.toFixed(2)) : '',
        '實際進度(%)': r.actual_progress,
        '差異(%)': planned !== null ? (r.actual_progress - planned).toFixed(2) : '',
        '備註': r.notes || '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '歷史進度紀錄');
    XLSX.writeFile(wb, `進度紀錄_${id?.slice(0,8)}.xlsx`);
  };

  const exportSchedule = () => {
    if (!scheduleItems.length) return;
    const data = scheduleItems.map(r => ({
      '工項名稱': r.item_name,
      '開始日期': r.start_date,
      '結束日期': r.end_date,
      '工期(天)': (r.start_date && r.end_date) ? Math.round((new Date(r.end_date) - new Date(r.start_date)) / 86400000) + 1 : '',
      '權重(%)': r.weight,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '工程計畫進度表');
    XLSX.writeFile(wb, `計畫進度表_${id?.slice(0,8)}.xlsx`);
  };

  // 從 schedule_items 推算任意日期的預定進度（線性插值，跳過無日期的工項）
  const calcPlanned = (dateStr) => {
    if (!scheduleItems.length) return null;
    const d = new Date(dateStr).getTime();
    return scheduleItems.reduce((sum, item) => {
      if (!item.start_date || !item.end_date) return sum;
      const s = new Date(item.start_date).getTime();
      const e = new Date(item.end_date).getTime();
      const ratio = e === s ? (d >= e ? 1 : 0) : Math.min(1, Math.max(0, (d - s) / (e - s)));
      return sum + parseFloat(item.weight ?? 0) * ratio;
    }, 0);
  };

  // Chart data：合併 schedule 關鍵日期 + 實際紀錄日期（過濾 null）
  const chartDates = [...new Set([
    ...scheduleItems.flatMap(i => [i.start_date, i.end_date]).filter(Boolean),
    ...records.map(r => r.report_date),
  ])].sort();

  const actualMap = Object.fromEntries(records.map(r => [r.report_date, Number(r.actual_progress)]));

  const chartData = scheduleItems.length > 0
    ? chartDates.map(date => ({
        displayDate: date.slice(5),
        report_date: date,
        預定進度: parseFloat(calcPlanned(date).toFixed(2)),
        實際進度: actualMap[date] ?? null,
      }))
    : records.map(r => ({
        displayDate: r.report_date.slice(5),
        report_date: r.report_date,
        預定進度: null,
        實際進度: Number(r.actual_progress),
      }));

  // Latest record summary
  const latest = records[records.length - 1];
  const latestPlanned = latest ? calcPlanned(latest.report_date) : null;
  const latestDiff = latest && latestPlanned !== null ? (latest.actual_progress - latestPlanned) : null;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--color-text-muted)' }}>
      載入進度資料中…
    </div>
  );

  return (
    <div style={{ padding: '24px', width: '100%' }}>
      {/* Page Header */}
      <header className="page-section-header" style={{ marginBottom: '20px' }}>
        <div className="header-left">
          <span className="section-label">進度管理</span>
          <span className="section-sub-label">S-CURVE &amp; PROGRESS TRACKING</span>
        </div>
        <div className="header-actions">
          {latest && (
            <span className="status-badge" style={{
              background: latestDiff >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
              color: latestDiff >= 0 ? 'var(--color-success)' : '#ef4444',
            }}>
              {latestDiff >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              實際 {latest.actual_progress}% {latestDiff >= 0 ? '超前' : '落後'} {Math.abs(latestDiff).toFixed(1)}%
              {latestPlanned !== null && <span style={{ fontWeight: 400, marginLeft: '4px' }}>（預定 {latestPlanned.toFixed(1)}%）</span>}
            </span>
          )}
          <button className="btn-dash-action" onClick={handleAdd} style={{ background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }}>
            <Plus size={14} /><span>新增進度</span>
          </button>
        </div>
      </header>

      {/* S-Curve + Records — 合併區塊 */}
      <div className="b-content-panel" style={{ padding: 0, overflow: 'hidden', marginBottom: '16px' }}>
        {/* 區塊標題 */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-block-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '3px', height: '18px', background: 'var(--color-primary)', borderRadius: '2px', display: 'inline-block' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text1)' }}>S-Curve 進度曲線 &amp; 歷史紀錄</span>
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
        <div style={{ padding: '20px' }}>
          {scheduleItems.length > 0 || records.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-block-border)" />
                <XAxis dataKey="displayDate" stroke="var(--color-text-muted)" tick={{ fontSize: 11 }} />
                <YAxis stroke="var(--color-text-muted)" tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                <Tooltip
                  contentStyle={{ background: 'var(--color-bg1)', border: '1px solid var(--color-block-border)', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(v) => `${v}%`}
                />
                <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="預定進度" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 5 }} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="實際進度" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} />
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
                {['報告日期', '預定進度', '實際進度', '差異', '備註', '操作'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-block-border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.length > 0 ? records.map((r) => {
                const planned = calcPlanned(r.report_date);
                const diff = planned !== null
                  ? (Number(r.actual_progress) - planned).toFixed(3)
                  : '—';
                const ahead = diff !== '—' && parseFloat(diff) >= 0;
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--color-block-border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg2)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td style={{ padding: '10px 16px', color: 'var(--color-text1)', fontWeight: 500 }}>{r.report_date}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--color-text2)' }}>{planned !== null ? parseFloat(planned.toFixed(3)) + '%' : '—'}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--color-text2)' }}>{parseFloat(Number(r.actual_progress).toFixed(3))}%</td>
                    <td style={{ padding: '10px 16px' }}>
                      {diff === '—' ? <span style={{ color: 'var(--color-text-muted)' }}>—</span> : (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                        background: ahead ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
                        color: ahead ? '#10b981' : '#ef4444',
                      }}>
                        {ahead ? <TrendingUp size={11} /> : parseFloat(diff) === 0 ? <Minus size={11} /> : <TrendingDown size={11} />}
                        {parseFloat(diff) > 0 ? '+' : ''}{diff}%
                      </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--color-text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.notes || '—'}
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
                  <td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
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
