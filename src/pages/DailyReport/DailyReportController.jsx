import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
        <div style={{ height: '100%', overflowY: 'auto', background: "#f1f5f9" }}>
            <header style={{ padding: '24px 24px 16px', background: "#fff", borderBottom: '1px solid #e2e8f0' }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "#0f172a" }}>監造日報系統</h1>
                <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0 0" }}>專案代碼: {projectId}</p>
            </header>

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
