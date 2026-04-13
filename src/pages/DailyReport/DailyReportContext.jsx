import React, { createContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export const DailyReportContext = createContext();

// 將 daily_report_items（Supabase）合併進對應的 report
function mergeItems(reports, itemsByDate) {
    return reports.map(r => {
        const dbItems = itemsByDate[r.date] || [];
        if (!dbItems.length) return r;
        // 轉換成 DailyReportForm 的 quantities 格式
        const quantities = dbItems.map((it, i) => ({
            id: it.id || i + 1,
            item: it.item_name,
            unit: it.unit || '',
            contractQty: 0,
            todayQty: it.today_qty || 0,
            cumQty: it.cumulative_qty || 0,
            note: it.note || '',
        }));
        return { ...r, quantities };
    });
}

export function DailyReportProvider({ children, projectId }) {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

    useEffect(() => {
        async function init() {
            // 1. 從 localStorage 讀取手動建立的報表
            let localReports = [];
            try {
                const saved = localStorage.getItem(`daily_reports_${projectId}`);
                if (saved) localReports = JSON.parse(saved);
            } catch {}

            // 2. 從 Supabase 並行讀取工項明細 + progress_records + daily_logs（進度來源三選一）
            const [{ data: dbItems }, { data: progressData }, { data: logsData }] = await Promise.all([
                supabase.from('daily_report_items').select('*').eq('project_id', projectId).order('log_date', { ascending: false }),
                supabase.from('progress_records').select('report_date, planned_progress, actual_progress').eq('project_id', projectId),
                supabase.from('daily_logs').select('log_date, planned_progress, actual_progress').eq('project_id', projectId),
            ]);

            // 按日期分組
            const itemsByDate = {};
            (dbItems || []).forEach(it => {
                if (!itemsByDate[it.log_date]) itemsByDate[it.log_date] = [];
                itemsByDate[it.log_date].push(it);
            });
            // progress_records 優先，daily_logs 為 fallback
            const progressByDate = {};
            (logsData || []).forEach(l => {
                if (l.actual_progress != null || l.planned_progress != null)
                    progressByDate[l.log_date] = { planned_progress: l.planned_progress, actual_progress: l.actual_progress };
            });
            (progressData || []).forEach(p => { progressByDate[p.report_date] = p; }); // 覆寫

            // 3. 合併：local 報表 + DB 工項；DB 有但 local 沒有的日期，建立骨架
            const localDates = new Set(localReports.map(r => r.date));
            const dbOnlyDates = Object.keys(itemsByDate).filter(d => !localDates.has(d));
            const dbOnlyReports = dbOnlyDates.map(date => ({
                id: `db-${date}`,
                project_id: projectId,
                date,
                reportNo: `Drive-${date}`,
                weather: '晴',
                tempHigh: 0, tempLow: 0,
                supervisor: '', contractor: '',
                plannedProgress: progressByDate[date]?.planned_progress || 0,
                actualProgress:  progressByDate[date]?.actual_progress  || 0,
                progressNote: '', quantities: [],
                inspections: [], qualityTests: [], documents: [],
                specialNote: '',
            }));

            // 4. 對 local 報表：若本身沒有進度，也從 progress_records 回填
            const localWithProgress = localReports.map(r => {
                const prog = progressByDate[r.date];
                if (!prog) return r;
                return {
                    ...r,
                    plannedProgress: r.plannedProgress || prog.planned_progress || 0,
                    actualProgress:  r.actualProgress  || prog.actual_progress  || 0,
                };
            });

            const allReports = mergeItems(
                [...localWithProgress, ...dbOnlyReports],
                itemsByDate
            ).sort((a, b) => a.date.localeCompare(b.date));

            setReports(allReports);
            setLoading(false);
        }
        if (projectId) init();
    }, [projectId, refreshKey]);

    const saveReport = async (form) => {
        // 更新 localStorage
        setReports(prev => {
            const exists = prev.find(r => r.id === form.id);
            const newList = exists ? prev.map(r => r.id === form.id ? form : r) : [...prev, form];
            // 只存 local（非 DB 骨架）記錄
            const toStore = newList.filter(r => !r.id.startsWith('db-'));
            localStorage.setItem(`daily_reports_${projectId}`, JSON.stringify(toStore));
            return newList;
        });

        const writes = [];

        // 同步工項至 Supabase daily_report_items
        if (form.quantities?.length > 0) {
            const payload = form.quantities
                .filter(q => q.item?.trim())
                .map(q => ({
                    project_id: projectId,
                    log_date: form.date,
                    item_name: q.item,
                    unit: q.unit || null,
                    today_qty: q.todayQty || 0,
                    cumulative_qty: q.cumQty || 0,
                    note: q.note || null,
                }));
            if (payload.length) {
                writes.push(
                    supabase.from('daily_report_items').upsert(payload, { onConflict: 'project_id,log_date,item_name' })
                );
            }
        }

        // 同步進度至 progress_records（儀表板與進度管理共用）
        if (form.actualProgress > 0 || form.plannedProgress > 0) {
            writes.push(
                supabase.from('progress_records').upsert({
                    project_id: projectId,
                    report_date: form.date,
                    planned_progress: form.plannedProgress || 0,
                    actual_progress:  form.actualProgress  || 0,
                }, { onConflict: 'project_id,report_date' })
            );
        }

        if (writes.length) await Promise.all(writes);
    };

    return (
        <DailyReportContext.Provider value={{ reports, saveReport, loading, refresh, projectId }}>
            {children}
        </DailyReportContext.Provider>
    );
}
