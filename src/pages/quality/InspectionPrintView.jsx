import React from 'react';
import { Printer, X } from 'lucide-react';
import { INSPECT_RESULT, RESOLVE_STATUS } from './qualityConfig';

/* ── 施工抽查記錄表列印元件 ── */
export function InspectionPrintView({ row, project, issue, onClose }) {
  const resCfg = INSPECT_RESULT[row.result] || INSPECT_RESULT['待複驗'];
  const issueCfg = issue ? (RESOLVE_STATUS[issue.status] || RESOLVE_STATUS.open) : null;
  const docNo = `Q-${(row.inspect_date || '').replace(/-/g, '')}-${String(row.id).slice(-4).padStart(4, '0')}`;

  function doPrint() { window.print(); }

  return (
    <div className="insp-print-overlay">
      <div className="insp-print-toolbar">
        <span style={{ fontWeight: 600, fontSize: '14px' }}>施工抽查記錄表預覽</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="mcs-btn mcs-btn-add" onClick={doPrint}><Printer size={13} /> 列印 / 存 PDF</button>
          <button className="mcs-btn" onClick={onClose}><X size={13} /> 關閉</button>
        </div>
      </div>

      <div className="insp-print-page">
        {/* 表頭 */}
        <table className="insp-pt-header-tbl">
          <tbody>
            <tr>
              <td colSpan={4} className="insp-pt-title">施工抽查記錄表</td>
            </tr>
            <tr>
              <td className="insp-pt-label">工程名稱</td>
              <td colSpan={3} className="insp-pt-val">{project?.name || '—'}</td>
            </tr>
            <tr>
              <td className="insp-pt-label">承包廠商</td>
              <td className="insp-pt-val">{project?.contractor || '—'}</td>
              <td className="insp-pt-label">記錄編號</td>
              <td className="insp-pt-val insp-pt-mono">{docNo}</td>
            </tr>
          </tbody>
        </table>

        {/* 抽查內容 */}
        <table className="insp-pt-body-tbl">
          <tbody>
            <tr>
              <td className="insp-pt-label">檢驗日期</td>
              <td className="insp-pt-val">{row.inspect_date || '—'}</td>
              <td className="insp-pt-label">檢驗類型</td>
              <td className="insp-pt-val">{row.inspect_type || '—'}</td>
            </tr>
            <tr>
              <td className="insp-pt-label">工程項目</td>
              <td colSpan={3} className="insp-pt-val">{row.work_item || '—'}</td>
            </tr>
            <tr>
              <td className="insp-pt-label">部位 / 位置</td>
              <td colSpan={3} className="insp-pt-val">{row.location || '—'}</td>
            </tr>
            <tr>
              <td className="insp-pt-label">檢驗人員</td>
              <td className="insp-pt-val">{row.inspector || '—'}</td>
              <td className="insp-pt-label">檢驗結果</td>
              <td className="insp-pt-val">
                <span style={{ fontWeight: 700, color: resCfg.color }}>{row.result || '待複驗'}</span>
              </td>
            </tr>
            <tr>
              <td className="insp-pt-label">備註說明</td>
              <td colSpan={3} className="insp-pt-val insp-pt-remark">{row.remark || '—'}</td>
            </tr>
            {issue && (
              <tr>
                <td className="insp-pt-label">缺失改善</td>
                <td colSpan={3} className="insp-pt-val">
                  <span style={{ fontWeight: 600, color: issueCfg?.color }}>{issueCfg?.label}</span>
                  {issue.deadline ? `  ／  改善期限：${issue.deadline}` : ''}
                  {issue.responsible ? `  ／  責任廠商：${issue.responsible}` : ''}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* 簽名欄 */}
        <table className="insp-pt-sign-tbl">
          <tbody>
            <tr>
              <td className="insp-pt-sign-label">監造人員</td>
              <td className="insp-pt-sign-field"></td>
              <td className="insp-pt-sign-label">承包廠商</td>
              <td className="insp-pt-sign-field"></td>
              <td className="insp-pt-sign-label">業主代表</td>
              <td className="insp-pt-sign-field"></td>
            </tr>
            <tr>
              <td className="insp-pt-sign-label">簽章日期</td>
              <td className="insp-pt-sign-field"></td>
              <td className="insp-pt-sign-label">簽章日期</td>
              <td className="insp-pt-sign-field"></td>
              <td className="insp-pt-sign-label">簽章日期</td>
              <td className="insp-pt-sign-field"></td>
            </tr>
          </tbody>
        </table>

        <div className="insp-pt-footer">本表單由 RT-PMIS 監造管理系統自動產生 · 列印日期：{new Date().toLocaleDateString('zh-TW')}</div>
      </div>
    </div>
  );
}
