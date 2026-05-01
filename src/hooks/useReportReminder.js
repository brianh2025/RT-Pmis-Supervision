import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useReportReminder(projectId) {
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    if (!projectId) return;
    const today = new Date();
    const day   = today.getDate();
    const year  = today.getFullYear();
    const month = today.getMonth();

    async function check() {
      if (day >= 1 && day <= 5) {
        const lastMonth    = new Date(year, month - 1, 1);
        const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
        const { data } = await supabase
          .from('supervision_reports')
          .select('status')
          .eq('project_id', projectId)
          .eq('report_month', lastMonthKey)
          .maybeSingle();
        const deadline = `${year}/${String(month + 1).padStart(2, '0')}/05`;
        if (!data || data.status === 'pending') {
          setBanner({ type: 'urgent', message: `${lastMonthKey} 監造報表尚未提送！截止日期：${deadline}` });
        }
      } else if (day >= 25) {
        const nextDeadline = new Date(year, month + 1, 5);
        const nd = `${nextDeadline.getFullYear()}/${String(nextDeadline.getMonth() + 1).padStart(2, '0')}/05`;
        setBanner({ type: 'advisory', message: `本月監造報表需於 ${nd} 前提送，請提前準備。` });
      }
    }
    check();
  }, [projectId]);

  return banner;
}
