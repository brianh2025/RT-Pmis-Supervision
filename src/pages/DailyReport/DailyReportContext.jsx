import React, { createContext, useState, useEffect } from 'react';

export const DailyReportContext = createContext();

// Mock Initial Data 
const INIT_DAILY_REPORTS = [
    {
        id: "mock-1", project_id: "mock-project", date: new Date().toISOString().split("T")[0], reportNo: "114-001", weather: "晴",
        tempHigh: 26, tempLow: 18, supervisor: "林工程師", contractor: "台灣營造股份有限公司",
        plannedProgress: 15.5, actualProgress: 16.2,
        progressNote: "本日進度正常，較預定進度超前0.7%，施工人員工作效率良好。",
        quantities: [
            { id: 1, item: "PC路面鋪設", unit: "m²", contractQty: 2500, todayQty: 80, cumQty: 520, note: "" },
            { id: 2, item: "側溝施作", unit: "m", contractQty: 800, todayQty: 25, cumQty: 210, note: "" },
        ],
        inspections: [
            { id: 1, no: "QC-001", item: "模板組立檢查", result: "合格", note: "尺寸符合設計圖說" }
        ],
        qualityTests: [
            { id: 1, material: "預拌混凝土", contractQty: "500m³", doneQty: "120m³", testItem: "坍度試驗", result: "合格", note: "坍度8cm" }
        ],
        documents: [
            { id: 1, type: "業主公文", no: "北工字第1130001234號", subject: "工程變更通知", date: "2026-03-04", note: "" }
        ],
        specialNote: "今日施工人數32人，機具運作正常。廠商申請第一期工程展延7天，已轉呈業主審核。",
    }
];

export function DailyReportProvider({ children, projectId }) {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function init() {
            const saved = localStorage.getItem(`daily_reports_${projectId}`);
            if (saved) {
                setReports(JSON.parse(saved));
            } else {
                setReports(INIT_DAILY_REPORTS.map(r => ({ ...r, project_id: projectId })));
            }
            setLoading(false);
        }
        init();
    }, [projectId]);

    const saveReport = (form) => {
        setReports(prev => {
            const exists = prev.find(r => r.id === form.id);
            const newList = exists ? prev.map(r => r.id === form.id ? form : r) : [...prev, form];
            localStorage.setItem(`daily_reports_${projectId}`, JSON.stringify(newList));
            return newList;
        });
    };

    return (
        <DailyReportContext.Provider value={{ reports, saveReport, loading, projectId }}>
            {children}
        </DailyReportContext.Provider>
    );
}
