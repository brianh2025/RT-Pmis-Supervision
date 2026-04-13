import React, { useContext } from 'react';
import { DailyReportContext } from './DailyReportContext';
import { Badge, Card, I, weatherIcon, thisMonth, C } from './utils';
import { FileSpreadsheet } from 'lucide-react';

export function DailyReportList({ onSelectReport, onNewReport, onImport }) {
    const { reports, loading } = useContext(DailyReportContext);
    const month = thisMonth();

    if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>載入中...</div>;

    const thisMonthReports = reports.filter(r => r.date.startsWith(month)).length;

    return (
        <div style={{ background: 'transparent' }}>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                {/* Quick Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                    {[
                        { label: "日報總數", value: reports.length, color: C.primary },
                        { label: "本月填報", value: thisMonthReports, color: C.success },
                        { label: "缺報天數", value: 0, color: C.textMuted },
                    ].map((s, idx) => (
                        <div key={s.label} style={{
                            background: "var(--color-surface)",
                            borderRadius: 16,
                            padding: "1.25rem",
                            textAlign: "center",
                            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                            border: "1px solid var(--color-surface-border)",
                            animation: `slide-up 0.6s cubic-bezier(0.16,1,0.3,1) ${idx * 0.07}s both`,
                            transition: "transform 0.35s cubic-bezier(0.16,1,0.3,1), box-shadow 0.35s",
                            cursor: "default",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.06)"; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.02)"; }}
                        >
                            <div style={{ fontSize: 28, fontWeight: 900, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
                            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Action Bar */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <button onClick={onNewReport} style={{
                        flex: 1, padding: "13px", borderRadius: 12, border: `2px dashed ${C.primary}55`,
                        background: C.primaryLight, color: C.primary, fontSize: 14, fontWeight: 700, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}>
                        {I.plus(C.primary)} 新增施工日誌
                    </button>
                    <button onClick={onImport} style={{
                        padding: "13px 18px", borderRadius: 12, border: `1.5px solid ${C.border}`,
                        background: "var(--color-surface)", color: C.textMid, fontSize: 13, fontWeight: 600, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 6, whiteSpace: 'nowrap',
                    }}>
                        <FileSpreadsheet size={15} color={C.textMid} /> Excel 匯入
                    </button>
                </div>

                {/* List */}
                {reports.length === 0 ? (
                    <div style={{ textAlign: "center", color: C.textMuted, padding: "50px 0", fontSize: 14 }}>
                        <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>尚無施工日誌，請新增
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                        {[...reports].reverse().map(r => (
                            <button key={r.id} onClick={() => onSelectReport(r)} style={{
                                width: "100%", background: "var(--color-surface)", border: `1px solid var(--color-surface-border)`, borderRadius: 14,
                                padding: "16px", textAlign: "left", boxShadow: "0 1px 5px rgba(0,0,0,0.1)", cursor: "pointer",
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
