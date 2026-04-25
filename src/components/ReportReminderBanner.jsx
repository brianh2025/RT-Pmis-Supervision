import React, { useEffect, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import './ReportReminderBanner.css';

/**
 * Displays a reminder banner when:
 *  - Days 1–5 of current month: urgent red banner (last month's report pending)
 *  - Days 25–31 of current month: yellow advisory banner (this month's report coming up)
 */
export function ReportReminderBanner({ projectId }) {
  const [banner, setBanner]   = useState(null); // { type: 'urgent'|'advisory', message, month }
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    const today = new Date();
    const day   = today.getDate();
    const year  = today.getFullYear();
    const month = today.getMonth(); // 0-indexed

    async function check() {
      if (day >= 1 && day <= 5) {
        // Check if LAST month's report has been submitted
        const lastMonth = new Date(year, month - 1, 1);
        const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

        const { data } = await supabase
          .from('supervision_reports')
          .select('status')
          .eq('project_id', projectId)
          .eq('report_month', lastMonthKey)
          .maybeSingle();

        const deadline = `${year}/${String(month + 1).padStart(2, '0')}/05`;

        if (!data || data.status === 'pending') {
          setBanner({
            type: 'urgent',
            month: lastMonthKey,
            message: `${lastMonthKey} 監造報表尚未提送！截止日期：${deadline}`,
          });
        }
      } else if (day >= 25) {
        // Advisory: next month's report is coming
        const nextDeadline = new Date(year, month + 1, 5);
        const nd = `${nextDeadline.getFullYear()}/${String(nextDeadline.getMonth() + 1).padStart(2, '0')}/05`;
        setBanner({
          type: 'advisory',
          message: `本月監造報表需於 ${nd} 前提送，請提前準備。`,
        });
      }
    }

    check();
  }, [projectId]);

  if (!banner || dismissed) return null;

  const isUrgent = banner.type === 'urgent';

  return (
    <div className={`report-reminder-banner ${isUrgent ? 'banner-urgent' : 'banner-advisory'}`}>
      <div className="banner-icon">
        {isUrgent ? <AlertTriangle size={18} /> : <Bell size={18} />}
      </div>
      <div className="banner-content">
        <span className="banner-label">
          {isUrgent ? '⚠️ 緊急提醒' : '📋 提前預警'}
        </span>
        <span className="banner-message">{banner.message}</span>
      </div>
      <button
        className="banner-dismiss"
        onClick={() => setDismissed(true)}
        title="關閉提醒"
      >
        <X size={16} />
      </button>
    </div>
  );
}
