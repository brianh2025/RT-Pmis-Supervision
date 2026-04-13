import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

const EDGE_FN_URL = 'https://xbdchvmxgmypcyawavju.supabase.co/functions/v1/sync-diary';

async function runBackgroundSync(projectId, startDate) {
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    const syncSecret = import.meta.env.VITE_SYNC_SECRET || '';
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? anonKey;
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    const listRes = await fetch(EDGE_FN_URL, {
        method: 'POST', headers,
        body: JSON.stringify({ mode: 'list', projectId, startDate, secret: syncSecret }),
    });
    if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);
    const { files = [] } = await listRes.json();

    for (const f of files) {
        await fetch(EDGE_FN_URL, {
            method: 'POST', headers,
            body: JSON.stringify({ mode: 'sync_one', projectId, fileId: f.id, fileName: f.name, secret: syncSecret }),
        }).catch(() => {});
    }
    return files.length;
}
import { DailyReportProvider, DailyReportContext } from './DailyReportContext';
import { DailyReportList } from './DailyReportList';
import { DailyReportView } from './DailyReportView';
import { DailyReportForm } from './DailyReportForm';
import { DiaryExcelImportModal } from '../../components/DiaryExcelImportModal';

function DailyReportContainer() {
    const { id: projectId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initDate = searchParams.get('date');

    const { reports, loading: reportsLoading, refresh } = useContext(DailyReportContext);

    const [viewMode, setViewMode] = useState(initDate ? "loading" : "list"); // list | view | form | loading
    const [selectedReport, setSelectedReport] = useState(null);
    const [editReport, setEditReport] = useState(null);
    const [showImport, setShowImport] = useState(false);
    const [project, setProject] = useState(null);
    const autoSyncedRef = useRef(false);

    useEffect(() => {
        supabase.from('projects')
            .select('name, contractor, start_date, drive_folder_id')
            .eq('id', projectId).single()
            .then(({ data }) => { if (data) setProject(data); });
    }, [projectId]);

    // 進頁自動背景同步（每次進入頁面執行一次）
    useEffect(() => {
        if (!project?.drive_folder_id || autoSyncedRef.current) return;
        autoSyncedRef.current = true;
        runBackgroundSync(projectId, project.start_date)
            .then(count => { if (count > 0) refresh(); })
            .catch(() => {});
    }, [project?.drive_folder_id, projectId, refresh]);

    // 若帶入指定日期，報表載入後自動跳至該日
    useEffect(() => {
        if (!initDate || reportsLoading) return;
        const r = reports.find(rep => rep.date === initDate);
        if (r) {
            setSelectedReport(r);
            setViewMode('view');
        } else {
            // 尚未建立 → 直接開新增表單並帶入日期
            setEditReport({ date: initDate });
            setViewMode('form');
        }
    }, [initDate, reportsLoading, reports]);

    const mockProject = {
        name: project?.name || "測試工程專案",
        contractor: project?.contractor || "睿泰營造",
        supervisorName: "王工程師"
    };

    const handleSelectReport = (r) => {
        setSelectedReport(r);
        setViewMode("view");
    };

    const handleNewReport = () => {
        setEditReport(null);
        setViewMode("form");
    };

    const handleBack = () => {
        if (initDate) {
            navigate(`/projects/${projectId}/journal`);
        } else if (editReport && selectedReport) {
            setViewMode("view");
        } else {
            setViewMode("list");
        }
    };

    const handleEditReport = () => {
        setEditReport(selectedReport);
        setViewMode("form");
    };

    const handleSave = (form) => {
        setSelectedReport(form);
        setViewMode("view");
    };

    return (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="dash-page-header">
                <h1 className="dash-title">施工日誌</h1>
            </div>

            {viewMode === "list" && (
                <DailyReportList
                    onSelectReport={handleSelectReport}
                    onNewReport={handleNewReport}
                    onImport={() => setShowImport(true)}
                />
            )}

            {viewMode === "loading" && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>載入中…</div>
            )}

            {viewMode === "view" && selectedReport && (
                <DailyReportView
                    report={selectedReport}
                    onBack={handleBack}
                    onEdit={handleEditReport}
                />
            )}

            {viewMode === "form" && (
                <DailyReportForm
                    existing={editReport}
                    projectId={projectId}
                    project={mockProject}
                    onBack={handleBack}
                    onSave={(form) => { handleSave(form); }}
                />
            )}
            {showImport && (
                <DiaryExcelImportModal
                    projectId={projectId}
                    onClose={() => setShowImport(false)}
                    onSuccess={() => { setShowImport(false); window.location.reload(); }}
                />
            )}

        </div>
    );
}

export function DailyReportController() {
    const { id: projectId } = useParams();
    return (
        <DailyReportProvider projectId={projectId}>
            <DailyReportContainer />
        </DailyReportProvider>
    );
}
