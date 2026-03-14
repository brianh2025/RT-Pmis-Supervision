import React, { useContext } from 'react';
import { DailyReportContext } from './DailyReportContext';
import { Badge, Card, I, weatherIcon, thisMonth, C } from './utils';

export function DailyReportList({ onSelectReport, onNewReport }) {
    const { reports, loading } = useContext(DailyReportContext);
    const month = thisMonth();

    if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>載入中...</div>;

    const thisMonthReports = reports.filter(r => r.date.startsWith(month)).length;

    return (
        <div style={{ padding: '20px 0', background: C.bg, minHeight: "100vh" }}>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                {/* Quick Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                    {[
                        { label: "日報總數", value: reports.length, color: C.primary },
                        { label: "本月填報", value: thisMonthReports, color: C.success },
                        { label: "缺報天數", value: 0, color: C.textMuted },
                    ].map(s => (
                        <div key={s.label} style={{ background: "#fff", borderRadius: 12, padding: "14px 10px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Action Bar */}
                <button onClick={onNewReport} style={{
                    width: "100%", padding: "13px", borderRadius: 12, border: `2px dashed ${C.primary}55`,
                    background: C.primaryLight, color: C.primary, fontSize: 14, fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14,
                }}>
                    {I.plus(C.primary)} 新增日報表
                </button>

                {/* List */}
                {reports.length === 0 ? (
                    <div style={{ textAlign: "center", color: C.textMuted, padding: "50px 0", fontSize: 14 }}>
                        <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>尚無日報表，請新增
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                        {[...reports].reverse().map(r => (
                            <button key={r.id} onClick={() => onSelectReport(r)} style={{
                                width: "100%", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14,
                                padding: "16px", textAlign: "left", boxShadow: "0 1px 5px rgba(0,0,0,0.05)", cursor: "pointer",
                                transition: "all 0.15s"
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 1px 5px rgba(0,0,0,0.05)"; }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div style={{ width: 40, height: 40, borderRadius: 10, background: C.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                                            {weatherIcon[r.weather] || "🌤️"}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.date}</div>
                                            <div style={{ fontSize: 11, color: C.textMuted }}>編號：{r.reportNo}</div>
                                        </div>
                                    </div>
                                    <Badge label={r.weather} variant="blue" />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                                    {[
                                        ["實際進度", `${r.actualProgress}%`], 
                                        ["抽查項目", `${r.inspections?.length || 0}項`], 
                                        ["文件紀錄", `${r.documents?.length || 0}件`]
                                    ].map(([k, v]) => (
                                        <div key={k} style={{ background: C.bg, borderRadius: 8, padding: "7px 8px" }}>
                                            <div style={{ fontSize: 10, color: C.textMuted }}>{k}</div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{v}</div>
                                        </div>
                                    ))}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
