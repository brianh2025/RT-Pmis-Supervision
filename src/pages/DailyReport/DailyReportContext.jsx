import React, { createContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

export const DailyReportContext = createContext();

// ---------------------------------------------------------------------------
// Build a DailyReportForm-compatible report object from DB records
// ---------------------------------------------------------------------------
function buildReport(date, log, items, progressRec, inspRecords, materialRecords) {
    // progress priority: progress_records > daily_logs > 0
    const planned = progressRec?.planned_progress ?? log?.planned_progress ?? 0;
    const actual  = progressRec?.actual_progress  ?? log?.actual_progress  ?? 0;

    const weatherStr = log?.weather_am
        ? (log.weather_pm && log.weather_pm !== log.weather_am
            ? `${log.weather_am}/${log.weather_pm}`
            : log.weather_am)
        : '晴';

    // Convert daily_report_items → quantities array
    const quantities = (items || []).map((it, i) => ({
        id: it.id || i + 1,
        item: it.item_name,
        unit: it.unit || '',
        contractQty: 0,
        todayQty: it.today_qty != null ? parseFloat(Number(it.today_qty).toFixed(3)) : 0,
        cumQty: it.cumulative_qty != null ? parseFloat(Number(it.cumulative_qty).toFixed(3)) : 0,
        note: it.note || '',
    }));

    // If no daily_report_items but daily_logs has work_items text, parse it
    if (quantities.length === 0 && log?.work_items) {
        log.work_items.split('\n')
            .map(line => line.trim()).filter(Boolean)
            .forEach((line, i) => {
                const m = line.match(/^(.+?)：([\d.]+)\s*(.*)$/);
                if (m) {
                    quantities.push({ id: i + 1, item: m[1].trim(), unit: m[3].trim(), contractQty: 0, todayQty: parseFloat(m[2]) || 0, cumQty: 0, note: '' });
                } else {
                    quantities.push({ id: i + 1, item: line, unit: '', contractQty: 0, todayQty: 0, cumQty: 0, note: '' });
                }
            });
    }

    // Parse form_data JSONB for extra fields saved from the form
    const fd = log?.form_data || {};

    return {
        id: log?.id || `db-${date}`,
        project_id: log?.project_id,
        date,
        reportNo: fd.reportNo || `Drive-${date}`,
        weather: weatherStr,
        tempHigh: fd.tempHigh ?? 0,
        tempLow: fd.tempLow ?? 0,
        supervisor: fd.supervisor || '',
        contractor: fd.contractor || '',
        plannedProgress: planned,
        actualProgress: actual,
        progressNote: log?.notes || '',
        quantities,
        inspections: fd.inspections || [],
        qualityTests: fd.qualityTests || [],
        documents: fd.documents || [],
        specialNote: fd.specialNote || '',
        inspRecords: inspRecords || [],
        materialRecords: materialRecords || [],
    };
}

export function DailyReportProvider({ children, projectId }) {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const { user } = useAuth();
    const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

    useEffect(() => {
        async function init() {
            setLoading(true);
            try {
                // Parallel fetch all relevant tables
                const [{ data: logsData }, { data: dbItems }, { data: progressData }, { data: inspData }, { data: matData }] = await Promise.all([
                    supabase.from('daily_logs')
                        .select('*')
                        .eq('project_id', projectId)
                        .order('log_date', { ascending: true }),
                    supabase.from('daily_report_items')
                        .select('*')
                        .eq('project_id', projectId)
                        .order('log_date', { ascending: false }),
                    supabase.from('progress_records')
                        .select('report_date, planned_progress, actual_progress')
                        .eq('project_id', projectId),
                    supabase.from('construction_inspections')
                        .select('*')
                        .eq('project_id', projectId)
                        .order('inspect_date', { ascending: true }),
                    supabase.from('material_entries')
                        .select('*')
                        .eq('project_id', projectId)
                        .order('entry_date', { ascending: true }),
                ]);

                // Group items by date
                const itemsByDate = {};
                (dbItems || []).forEach(it => {
                    if (!itemsByDate[it.log_date]) itemsByDate[it.log_date] = [];
                    itemsByDate[it.log_date].push(it);
                });

                // Group progress by date
                const progressByDate = {};
                (progressData || []).forEach(p => { progressByDate[p.report_date] = p; });

                // Group inspections by date
                const inspsByDate = {};
                (inspData || []).forEach(r => {
                    if (!inspsByDate[r.inspect_date]) inspsByDate[r.inspect_date] = [];
                    inspsByDate[r.inspect_date].push(r);
                });

                // Group material entries by date
                const materialsByDate = {};
                (matData || []).forEach(r => {
                    if (!materialsByDate[r.entry_date]) materialsByDate[r.entry_date] = [];
                    materialsByDate[r.entry_date].push(r);
                });

                // Collect all unique dates from logs + items
                const allDates = new Set([
                    ...(logsData || []).map(l => l.log_date),
                    ...Object.keys(itemsByDate),
                ]);

                // Build log lookup
                const logsByDate = {};
                (logsData || []).forEach(l => { logsByDate[l.log_date] = l; });

                // Build report objects
                const allReports = [...allDates]
                    .sort()
                    .map(date => buildReport(
                        date,
                        logsByDate[date] || null,
                        itemsByDate[date] || [],
                        progressByDate[date] || null,
                        inspsByDate[date] || [],
                        materialsByDate[date] || [],
                    ));

                setReports(allReports);
            } catch (err) {
                console.error('DailyReportContext init error:', err);
            }
            setLoading(false);
        }
        if (projectId) init();
    }, [projectId, refreshKey]);

    // ---------------------------------------------------------------------------
    // Save a report: write to all relevant Supabase tables (NO localStorage)
    // ---------------------------------------------------------------------------
    const saveReport = async (form) => {
        const writes = [];

        // 1. Upsert daily_logs — basic info + form_data JSONB for extra fields
        const logPayload = {
            project_id: projectId,
            log_date: form.date,
            weather_am: form.weather?.split('/')[0]?.trim() || form.weather || null,
            weather_pm: form.weather?.split('/')[1]?.trim() || form.weather?.split('/')[0]?.trim() || null,
            notes: form.progressNote || null,
            work_items: (form.quantities || [])
                .filter(q => q.item?.trim())
                .map(q => `${q.item}：${q.todayQty} ${q.unit || ''}`.trim())
                .join('\n') || null,
            planned_progress: form.plannedProgress || 0,
            actual_progress: form.actualProgress || 0,
            created_by: user?.id || null,
            form_data: {
                reportNo: form.reportNo,
                tempHigh: form.tempHigh,
                tempLow: form.tempLow,
                supervisor: form.supervisor,
                contractor: form.contractor,
                inspections: form.inspections || [],
                qualityTests: form.qualityTests || [],
                documents: form.documents || [],
                specialNote: form.specialNote || '',
            },
        };
        writes.push(
            supabase.from('daily_logs').upsert(logPayload, { onConflict: 'project_id,log_date' })
        );

        // 2. Sync quantities → daily_report_items
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
                // Delete old items for this date first, then insert fresh
                writes.push(
                    supabase.from('daily_report_items')
                        .delete()
                        .eq('project_id', projectId)
                        .eq('log_date', form.date)
                        .then(() =>
                            supabase.from('daily_report_items').insert(payload)
                        )
                );
            }
        }

        // 3. Sync progress → progress_records
        if (form.actualProgress > 0 || form.plannedProgress > 0) {
            writes.push(
                supabase.from('progress_records').upsert({
                    project_id: projectId,
                    report_date: form.date,
                    planned_progress: form.plannedProgress || 0,
                    actual_progress: form.actualProgress || 0,
                }, { onConflict: 'project_id,report_date' })
            );
        }

        const results = await Promise.allSettled(writes);
        const errors = results.filter(r => r.status === 'rejected' || r.value?.error);
        if (errors.length) {
            console.error('saveReport errors:', errors);
            alert(`儲存部分失敗，請檢查主控台。(${errors.length} 錯誤)`);
        }

        // Refresh local state
        refresh();
    };

    // ---------------------------------------------------------------------------
    // Delete a report by date (NO localStorage)
    // ---------------------------------------------------------------------------
    const deleteReport = async (date) => {
        await Promise.all([
            supabase.from('daily_report_items').delete().eq('project_id', projectId).eq('log_date', date),
            supabase.from('daily_logs').delete().eq('project_id', projectId).eq('log_date', date),
            supabase.from('progress_records').delete().eq('project_id', projectId).eq('report_date', date),
        ]);
        // Refresh local state
        refresh();
    };

    return (
        <DailyReportContext.Provider value={{ reports, saveReport, deleteReport, loading, refresh, projectId }}>
            {children}
        </DailyReportContext.Provider>
    );
}
