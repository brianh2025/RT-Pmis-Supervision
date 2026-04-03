import React, { useState } from 'react';
import { Card, SH, I, Badge, ProgressBar, weatherIcon, C } from './utils';

export function DailyReportView({ report, onBack, onEdit }) {
    const [tab, setTab] = useState("progress");
    const diff = (report.actualProgress - report.plannedProgress).toFixed(1);
    const ahead = diff >= 0;

    const tabs = [
        { key: "progress", label: "工程進度" },
        { key: "qty", label: "數量計算" },
        { key: "inspect", label: "施工抽查" },
        { key: "quality", label: "品質試驗" },
        { key: "docs", label: "文件管理" },
    ];

    return (
        <div style={{ background: C.bg, minHeight: "100vh", paddingBottom: 40, paddingTop: 20 }}>
            <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 20px' }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                    <button onClick={onBack} style={{ padding: 6, background: "none", border: "none", cursor: "pointer", color: C.text }}>
                        {I.back(C.text)}
                    </button>
                    <div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: C.text }}>施工日誌 {report.date}</h2>
                        <div style={{ fontSize: 12, color: C.textMuted }}>編號：{report.reportNo}</div>
                    </div>
                </div>

                {/* Basic info */}
                <Card mb={10}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        {[
                            ["報表編號", report.reportNo],
                            ["日期", report.date],
                            ["天氣", `${weatherIcon[report.weather] || ""} ${report.weather}`],
                            ["氣溫", `${report.tempLow}°C ～ ${report.tempHigh}°C`],
                            ["監造人員", report.supervisor],
                            ["承攬廠商", report.contractor],
                        ].map(([k, v]) => (
                            <div key={k}>
                                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>{k}</div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{v}</div>
                            </div>
                        ))}
                    </div>
                </Card>

                <button onClick={onEdit} style={{ 
                    width: "100%", padding: "10px", borderRadius: 10, border: `1.5px solid ${C.border}`, 
                    background: "#fff", color: C.textMid, fontSize: 13, fontWeight: 600, cursor: "pointer", 
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 14,
                    transition: "all 0.15s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = C.bg}
                onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                    {I.edit(C.textMid)} 編輯此施工日誌
                </button>

                {/* Tab pills */}
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 12, scrollbarWidth: "none" }}>
                    {tabs.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)} style={{
                            padding: "7px 14px", borderRadius: 20, 
                            border: `1.5px solid ${tab === t.key ? C.primary : C.border}`,
                            background: tab === t.key ? C.primary : "#fff",
                            color: tab === t.key ? "#fff" : C.textMid,
                            fontSize: 12, fontWeight: tab === t.key ? 700 : 400, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                            transition: "all 0.2s"
                        }}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === "progress" && (
                    <Card>
                        <SH icon={I.chart} title="工程進度" />
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                <span style={{ fontSize: 13, color: C.textMid }}>整體施工進度</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: ahead ? C.success : C.danger }}>
                                    {report.actualProgress}% / {report.plannedProgress}% 計畫
                                </span>
                            </div>
                            <ProgressBar value={report.actualProgress} planned={report.plannedProgress} color={ahead ? "#10b981" : "#f43f5e"} height={8} />
                            <div style={{ textAlign: "center", marginTop: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: ahead ? C.success : C.danger }}>
                                    {ahead ? "▲" : "▼"} 進度差異 {ahead ? "+" : ""}{diff}%
                                </span>
                            </div>
                        </div>
                        {report.progressNote && (
                            <div style={{ background: C.bg, borderRadius: 10, padding: "12px", fontSize: 13, color: C.textMid, lineHeight: 1.7, borderLeft: `3px solid ${C.primary}` }}>
                                📝 {report.progressNote}
                            </div>
                        )}
                    </Card>
                )}

                {tab === "qty" && (
                    <Card>
                        <SH icon={I.chart} title="數量計算" />
                        {report.quantities.map((q, i) => (
                            <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < report.quantities.length - 1 ? `1px solid ${C.bg}` : "none" }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 8 }}>{q.item}</div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                                    {[["單位", q.unit], ["契約數量", q.contractQty], ["本日數量", q.todayQty], ["累計數量", q.cumQty]].map(([k, v]) => (
                                        <div key={k} style={{ background: C.bg, borderRadius: 8, padding: "7px 8px" }}>
                                            <div style={{ fontSize: 9, color: C.textMuted }}>{k}</div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{v}</div>
                                        </div>
                                    ))}
                                </div>
                                {q.note && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 5 }}>備註：{q.note}</div>}
                            </div>
                        ))}
                        {report.quantities.length === 0 && <div style={{ textAlign: "center", color: C.textMuted, padding: "20px 0" }}>無數量計算資料</div>}
                    </Card>
                )}

                {tab === "inspect" && (
                    <Card>
                        <SH icon={I.shield} title="施工抽查" />
                        {report.inspections.map((ins, i) => (
                            <div key={i} style={{ marginBottom: 10, background: C.bg, borderRadius: 10, padding: "12px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <div>
                                        <span style={{ fontSize: 11, color: C.textMuted, marginRight: 8 }}>{ins.no}</span>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{ins.item}</span>
                                    </div>
                                    <Badge label={ins.result} variant={ins.result === "合格" ? "success" : "danger"} />
                                </div>
                                {ins.note && <div style={{ fontSize: 12, color: C.textMid }}>📌 {ins.note}</div>}
                            </div>
                        ))}
                        {report.inspections.length === 0 && <div style={{ textAlign: "center", color: C.textMuted, padding: "20px 0" }}>無抽查紀錄</div>}
                    </Card>
                )}

                {tab === "quality" && (
                    <Card>
                        <SH icon={I.flask} title="品質試驗" />
                        {report.qualityTests.map((qt, i) => (
                            <div key={i} style={{ marginBottom: 10, background: C.bg, borderRadius: 10, padding: "12px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{qt.material}</span>
                                    <Badge label={qt.result} variant={qt.result === "合格" ? "success" : "danger"} />
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: qt.note ? 6 : 0 }}>
                                    {[["契約數量", qt.contractQty], ["已作數量", qt.doneQty], ["試驗項目", qt.testItem]].map(([k, v]) => (
                                        <div key={k}>
                                            <div style={{ fontSize: 9, color: C.textMuted }}>{k}</div>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{v}</div>
                                        </div>
                                    ))}
                                </div>
                                {qt.note && <div style={{ fontSize: 11, color: C.textMid }}>📌 {qt.note}</div>}
                            </div>
                        ))}
                        {report.qualityTests.length === 0 && <div style={{ textAlign: "center", color: C.textMuted, padding: "20px 0" }}>無試驗紀錄</div>}
                    </Card>
                )}

                {tab === "docs" && (
                    <>
                        <Card>
                            <SH icon={I.doc} title="文件管理" />
                            {report.documents.map((d, i) => (
                                <div key={i} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: i < report.documents.length - 1 ? `1px solid ${C.bg}` : "none" }}>
                                    <div style={{ marginBottom: 5 }}><Badge label={d.type} variant="blue" /></div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 3 }}>{d.subject}</div>
                                    <div style={{ fontSize: 11, color: C.textMuted }}>文號：{d.no} · {d.date}</div>
                                    {d.note && <div style={{ fontSize: 11, color: C.textMid, background: C.bg, borderRadius: 7, padding: "6px 10px", marginTop: 6 }}>📌 {d.note}</div>}
                                </div>
                            ))}
                            {report.documents.length === 0 && <div style={{ textAlign: "center", color: C.textMuted, padding: "20px 0" }}>無文件紀錄</div>}
                        </Card>
                        {report.specialNote && (
                            <Card mb={0}>
                                <SH icon={I.doc} title="特別記載事項" />
                                <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.8, background: "#fffbeb", borderRadius: 10, padding: "12px 14px", borderLeft: `3px solid ${C.warn}` }}>
                                    {report.specialNote}
                                </div>
                            </Card>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
