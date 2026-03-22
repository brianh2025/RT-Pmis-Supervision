import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Plus, Upload, Edit, Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ProgressFormModal } from '../components/ProgressFormModal';
import { ProgressExcelImportModal } from '../components/ProgressExcelImportModal';

export function ProgressManagement() {
  const { id } = useParams();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

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

  useEffect(() => { fetchRecords(); }, [id]);

  const handleDelete = async (recordId) => {
    if (!window.confirm('確定要刪除這筆進度紀錄嗎？')) return;
    await supabase.from('progress_records').delete().eq('id', recordId);
    fetchRecords();
  };

  const handleEdit = (record) => { setEditingRecord(record); setIsFormModalOpen(true); };
  const handleAdd = () => { setEditingRecord(null); setIsFormModalOpen(true); };

  // Chart data
  const chartData = records.map(r => ({
    ...r,
    displayDate: r.report_date.slice(5), // MM-DD
    預定進度: Number(r.planned_progress),
    實際進度: Number(r.actual_progress),
  }));

  // Latest record summary
  const latest = records[records.length - 1];
  const latestDiff = latest ? (latest.actual_progress - latest.planned_progress) : null;

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
            </span>
          )}
          <button className="btn-dash-action" onClick={() => setIsExcelModalOpen(true)}>
            <Upload size={14} /><span>匯入 Excel</span>
          </button>
          <button className="btn-dash-action" onClick={handleAdd} style={{ background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }}>
            <Plus size={14} /><span>新增進度</span>
          </button>
        </div>
      </header>

      {/* S-Curve Chart */}
      <div className="b-content-panel" style={{ padding: '20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <span style={{ width: '3px', height: '18px', background: 'var(--color-primary)', borderRadius: '2px', display: 'inline-block' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text1)' }}>S-Curve 進度曲線</span>
        </div>
        {records.length > 0 ? (
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
              <Line type="monotone" dataKey="預定進度" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="實際進度" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} strokeDasharray="none" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '13px', border: '1px dashed var(--color-block-border)', borderRadius: '8px' }}>
            尚無進度紀錄，請新增或匯入 Excel
          </div>
        )}
      </div>

      {/* Records Table */}
      <div className="b-content-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-block-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '3px', height: '18px', background: 'var(--color-primary)', borderRadius: '2px', display: 'inline-block' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text1)' }}>歷史進度紀錄</span>
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--color-text-muted)' }}>{records.length} 筆</span>
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
                const diff = (r.actual_progress - r.planned_progress).toFixed(2);
                const ahead = parseFloat(diff) >= 0;
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--color-block-border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg2)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td style={{ padding: '10px 16px', color: 'var(--color-text1)', fontWeight: 500 }}>{r.report_date}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--color-text2)' }}>{r.planned_progress}%</td>
                    <td style={{ padding: '10px 16px', color: 'var(--color-text2)' }}>{r.actual_progress}%</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                        background: ahead ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
                        color: ahead ? '#10b981' : '#ef4444',
                      }}>
                        {ahead ? <TrendingUp size={11} /> : parseFloat(diff) === 0 ? <Minus size={11} /> : <TrendingDown size={11} />}
                        {parseFloat(diff) > 0 ? '+' : ''}{diff}%
                      </span>
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

      {isFormModalOpen && (
        <ProgressFormModal
          projectId={id}
          initialData={editingRecord}
          onClose={() => setIsFormModalOpen(false)}
          onSuccess={() => { setIsFormModalOpen(false); fetchRecords(); }}
        />
      )}

      {isExcelModalOpen && (
        <ProgressExcelImportModal
          projectId={id}
          onClose={() => setIsExcelModalOpen(false)}
          onSuccess={() => { setIsExcelModalOpen(false); fetchRecords(); }}
        />
      )}
    </div>
  );
}
