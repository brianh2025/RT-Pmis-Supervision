import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCcw } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { DailyReportProvider } from './DailyReportContext';
import { DailyReportList } from './DailyReportList';
import { DailyReportView } from './DailyReportView';
import { DailyReportForm } from './DailyReportForm';
import { DiaryExcelImportModal } from '../../components/DiaryExcelImportModal';
import { DriveSyncModal } from '../../components/DriveSyncModal';

function DailyReportContainer() {
    const { id: projectId } = useParams();
    const [viewMode, setViewMode] = useState("list"); // list | view | form
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
                {project?.drive_folder_id && viewMode === 'list' && (
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

            {viewMode === "view" && selectedReport && (
                <DailyReportView 
                    report={selectedReport} 
                    onBack={() => setViewMode("list")} 
                    onEdit={handleEditReport} 
                />
            )}

            {viewMode === "form" && (
                <DailyReportForm
                    existing={editReport}
                    projectId={projectId}
                    project={mockProject}
                    onBack={() => setViewMode(editReport && selectedReport ? "view" : "list")}
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
