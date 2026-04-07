import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { DailyReportProvider } from './DailyReportContext';
import { DailyReportList } from './DailyReportList';
import { DailyReportView } from './DailyReportView';
import { DailyReportForm } from './DailyReportForm';

function DailyReportContainer() {
    const { id: projectId } = useParams();
    const [viewMode, setViewMode] = useState("list"); // list | view | form
    const [selectedReport, setSelectedReport] = useState(null);
    const [editReport, setEditReport] = useState(null);

    const mockProject = {
        name: "測試工程專案",
        contractor: "睿泰營造",
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
            </div>

            {viewMode === "list" && (
                <DailyReportList 
                    onSelectReport={handleSelectReport} 
                    onNewReport={handleNewReport} 
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
                    onSave={(form) => {
                        handleSave(form);
                    }}
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
