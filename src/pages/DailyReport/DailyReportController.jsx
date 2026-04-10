import React, { useState, useEffect, useContext } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { RefreshCcw } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { DailyReportProvider, DailyReportContext } from './DailyReportContext';
import { DailyReportList } from './DailyReportList';
import { DailyReportView } from './DailyReportView';
import { DailyReportForm } from './DailyReportForm';
import { DiaryExcelImportModal } from '../../components/DiaryExcelImportModal';
import { DriveSyncModal } from '../../components/DriveSyncModal';

function DailyReportContainer() {
    const { id: projectId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initDate = searchParams.get('date');

    const { reports, loading: reportsLoading } = useContext(DailyReportContext);

    const [viewMode, setViewMode] = useState(initDate ? "loading" : "list"); // list | view | form | loading
    const [selectedReport, setSelectedReport] = useState(null);
    const [editReport, setEditReport] = useState(null);
    const [showImport, setShowImport] = useState(false);
    const [showDriveSync, setShowDriveSync] = useState(false);
    const [project, setProject] = useState(null);

    useEffect(() => {
        supabase.from('projects')
            .select('name, contractor, start_date, drive_folder_id')
            .eq('id', projectId).single()
            .then(({ data }) => { if (data) setProject(data); });
    }, [projectId]);

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
                {project?.drive_folder_id && (viewMode === 'list' || (initDate && viewMode !== 'loading')) && (
                    <button
                        onClick={() => setShowDriveSync(true)}
                        className="btn-dash-action"
                        style={{ background: 'rgba(59,130,246,0.1)', color: '#2563eb', borderColor: 'rgba(59,130,246,0.3)' }}
                    >
                        <RefreshCcw size={13} />
                        <span>Drive 回朔同步</span>
                    </button>
                )}
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
            {showDriveSync && (
                <DriveSyncModal
                    projectId={projectId}
                    startDate={project?.start_date || ''}
                    onClose={() => setShowDriveSync(false)}
                    onSuccess={() => setShowDriveSync(false)}
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
