import React, { createContext, useState, useEffect } from 'react';
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

    useEffect(() => {
        async function init() {
            // 1. 從 localStorage 讀取手動建立的報表
            let localReports = [];
            try {
                const saved = localStorage.getItem(`daily_reports_${projectId}`);
                if (saved) localReports = JSON.parse(saved);
            } catch {}

            // 2. 從 Supabase 讀取 Drive 同步的工項明細
            const { data: dbItems } = await supabase
                .from('daily_report_items')
                .select('*')
                .eq('project_id', projectId)
                .order('log_date', { ascending: false });

            // 按日期分組
            const itemsByDate = {};
            (dbItems || []).forEach(it => {
                if (!itemsByDate[it.log_date]) itemsByDate[it.log_date] = [];
                itemsByDate[it.log_date].push(it);
            });

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
                plannedProgress: 0, actualProgress: 0,
                progressNote: '', quantities: [],
                inspections: [], qualityTests: [], documents: [],
                specialNote: '',
            }));

            const allReports = mergeItems(
                [...localReports, ...dbOnlyReports],
                itemsByDate
            ).sort((a, b) => a.date.localeCompare(b.date));

            setReports(allReports);
            setLoading(false);
        }
        if (projectId) init();
    }, [projectId]);

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
                await supabase.from('daily_report_items').upsert(
                    payload, { onConflict: 'project_id,log_date,item_name' }
                );
            }
        }
    };

    return (
        <DailyReportContext.Provider value={{ reports, saveReport, loading, projectId }}>
            {children}
        </DailyReportContext.Provider>
    );
}
