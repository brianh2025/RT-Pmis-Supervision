import React, { useState } from 'react';
import { Card, SH, I, ProgressBar, WEATHER_OPTIONS, DOC_TYPES, today, C } from './utils';

const inpStyle = {
    width: "100%", padding: "8px 16px", borderRadius: 8, border: `1.5px solid ${C.border}`,
    fontSize: 13, color: C.text, outline: "none", boxSizing: "border-box",
    background: "var(--color-bg2)", fontFamily: "inherit", transition: "border-color .15s"
};
const tisStyle = { ...inpStyle, padding: "8px 16px", fontSize: 12 };
const lblStyle = { fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 8, display: "block" };
const Field = ({ label, children }) => <div style={{ marginBottom: 16 }}><label style={lblStyle}>{label}</label>{children}</div>;
export function DailyReportForm({ existing, onSave, onBack, projectId, project }) {
    const [form, setForm] = useState(() => {
        if (existing) return existing;
        return {
            id: `dr-${Date.now()}`, project_id: projectId, date: today(),
            reportNo: `114-${String(Math.floor(Math.random()*100)).padStart(3, "0")}`,
            weather: "晴", tempHigh: 28, tempLow: 18,
            supervisor: project?.supervisorName || "測試監造人員", contractor: project?.contractor || "測試營造公司",
            plannedProgress: 0, actualProgress: 0,
            progressNote: "",
            quantities: [],
            inspections: [],
            qualityTests: [],
            documents: [],
            specialNote: "",
        };
    });
    const [activeTab, setActiveTab] = useState("basic");
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const updArr = (key, idx, field, val) => setForm(f => { const arr = [...f[key]]; arr[idx] = { ...arr[idx], [field]: val }; return { ...f, [key]: arr }; });
    const addRow = (key, tmpl) => setForm(f => ({ ...f, [key]: [...f[key], { ...tmpl, id: Date.now() + Math.random() }] }));
    const delRow = (key, idx) => setForm(f => ({ ...f, [key]: f[key].filter((_, i) => i !== idx) }));

    const tabs = ["基本資料", "工程進度", "數量計算", "施工抽查", "品質試驗", "文件管理"];
    const tabKeys = ["basic", "progress", "qty", "inspect", "quality", "docs"];
    const tabIdx = tabKeys.indexOf(activeTab);

    return (
        <div style={{ background: C.bg, minHeight: "100vh", paddingBottom: 90, paddingTop: 20 }}>
            <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 20px' }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <button onClick={onBack} style={{ padding: 6, background: "none", border: "none", cursor: "pointer", color: C.text }}>
                        {I.back(C.text)}
                    </button>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: C.text }}>
                        {existing ? "編輯施工日誌" : "新增施工日誌"}
                    </h2>
                </div>

                {/* Tab bar */}
                <div style={{ background: "var(--color-surface)", borderBottom: `1px solid ${C.border}`, padding: "0 12px", display: "flex", gap: 0, overflowX: "auto", scrollbarWidth: "none", borderRadius: "12px 12px 0 0" }}>
                    {tabs.map((t, i) => (
                        <button key={i} onClick={() => setActiveTab(tabKeys[i])} style={{
                            padding: "13px 14px", border: "none", background: "none", whiteSpace: "nowrap", flexShrink: 0,
                            fontSize: 13, fontWeight: activeTab === tabKeys[i] ? 700 : 400,
                            color: activeTab === tabKeys[i] ? C.primary : C.textMuted,
                            borderBottom: activeTab === tabKeys[i] ? `2.5px solid ${C.primary}` : "2.5px solid transparent",
                            cursor: "pointer", transition: "all 0.2s"
                        }}>{t}</button>
                    ))}
                </div>

                {/* Progress dots */}
                <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "10px 0", background: "var(--color-surface)", borderBottom: `1px solid ${C.bg}`, borderLeft: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}` }}>
                    {tabKeys.map((k, i) => (
                        <div key={k} style={{ width: i === tabIdx ? 20 : 8, height: 8, borderRadius: 99, background: i < tabIdx ? C.success : i === tabIdx ? C.primary : C.border, transition: "all .3s" }} />
                    ))}
                </div>

                <div style={{ padding: "16px 0" }}>
                    {/* ── 基本資料 ── */}
                    {activeTab === "basic" && (
                        <Card>
                            <SH icon={I.doc} title="基本資料" />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <Field label="報表編號">
                                    <input style={tisStyle} value={form.reportNo} onChange={e => set("reportNo", e.target.value)} />
                                </Field>
                                <Field label="日期">
                                    <input type="date" style={tisStyle} value={form.date} onChange={e => set("date", e.target.value)} />
                                </Field>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <Field label="天氣">
                                    <select style={tisStyle} value={form.weather} onChange={e => set("weather", e.target.value)}>
                                        {WEATHER_OPTIONS.map(w => <option key={w}>{w}</option>)}
                                    </select>
                                </Field>
                                <Field label="氣溫 (°C)">
                                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                        <input type="number" style={{ ...tisStyle, width: "100%" }} placeholder="最低" value={form.tempLow} onChange={e => set("tempLow", e.target.value)} />
                                        <span style={{ color: C.textMuted, flexShrink: 0 }}>~</span>
                                        <input type="number" style={{ ...tisStyle, width: "100%" }} placeholder="最高" value={form.tempHigh} onChange={e => set("tempHigh", e.target.value)} />
                                    </div>
                                </Field>
                            </div>
                            <Field label="監造人員">
                                <input style={inpStyle} value={form.supervisor} onChange={e => set("supervisor", e.target.value)} />
                            </Field>
                            <Field label="承攬廠商">
                                <input style={inpStyle} value={form.contractor} onChange={e => set("contractor", e.target.value)} />
                            </Field>
                        </Card>
                    )}

                    {/* ── 工程進度 ── */}
                    {activeTab === "progress" && (
                        <Card>
                            <SH icon={I.chart} title="工程進度" />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <Field label="預定進度 (%)">
                                    <input type="number" style={tisStyle} value={form.plannedProgress} onChange={e => set("plannedProgress", parseFloat(e.target.value) || 0)} />
                                </Field>
                                <Field label="實際進度 (%)">
                                    <input type="number" style={tisStyle} value={form.actualProgress} onChange={e => set("actualProgress", parseFloat(e.target.value) || 0)} />
                                </Field>
                            </div>
                            <div style={{ marginBottom: 14 }}>
                                <ProgressBar value={form.actualProgress} planned={form.plannedProgress} color={form.actualProgress >= form.plannedProgress ? "#10b981" : "#f43f5e"} height={10} />
                                <div style={{ textAlign: "center", marginTop: 6, fontSize: 12, fontWeight: 700, color: form.actualProgress >= form.plannedProgress ? C.success : C.danger }}>
                                    {form.actualProgress >= form.plannedProgress ? "▲ 超前" : "▼ 落後"} {Math.abs(form.actualProgress - form.plannedProgress).toFixed(1)}%
                                </div>
                            </div>
                            <Field label="突發情形說明">
                                <textarea style={{ ...inpStyle, resize: "vertical", height: 90 }} value={form.progressNote} onChange={e => set("progressNote", e.target.value)} placeholder="說明當日施工狀況、突發事件..." />
                            </Field>
                        </Card>
                    )}

                    {/* ── 數量計算 ── */}
                    {activeTab === "qty" && (
                        <Card>
                            <SH icon={I.chart} title="數量計算" action={() => addRow("quantities", { item: "", unit: "m²", contractQty: 0, todayQty: 0, cumQty: 0, note: "" })} actionLabel="新增項目" />
                            {form.quantities.map((q, i) => (
                                <div key={i} style={{ background: C.bg, borderRadius: 10, padding: "12px", marginBottom: 10 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: C.textMid }}>項目 {i + 1}</span>
                                        <button onClick={() => delRow("quantities", i)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{I.trash()}</button>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 6 }}>
                                        <div>
                                            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>施工項目</div>
                                            <input style={tisStyle} placeholder="項目名稱" value={q.item} onChange={e => updArr("quantities", i, "item", e.target.value)} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>單位</div>
                                            <input style={tisStyle} placeholder="m²" value={q.unit} onChange={e => updArr("quantities", i, "unit", e.target.value)} />
                                        </div>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 6 }}>
                                        {[["契約數量", "contractQty"], ["本日數量", "todayQty"], ["累計數量", "cumQty"]].map(([label, key]) => (
                                            <div key={key}>
                                                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>{label}</div>
                                                <input type="number" step="0.01" style={tisStyle} value={q[key]} onChange={e => { const v = parseFloat(e.target.value); updArr("quantities", i, key, isNaN(v) ? 0 : parseFloat(v.toFixed(2))); }} />
                                            </div>
                                        ))}
                                        <div>
                                            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>備註</div>
                                            <input style={tisStyle} value={q.note} onChange={e => updArr("quantities", i, "note", e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {form.quantities.length === 0 && <div style={{ textAlign: "center", padding: "24px 0", color: C.textMuted, fontSize: 13 }}>點擊「新增項目」開始填寫</div>}
                        </Card>
                    )}

                    {/* ── 施工抽查 ── */}
                    {activeTab === "inspect" && (
                        <Card>
                            <SH icon={I.shield} title="施工抽查" action={() => addRow("inspections", { no: "", item: "", result: "合格", note: "" })} actionLabel="新增抽查" />
                            {form.inspections.map((ins, i) => (
                                <div key={i} style={{ background: C.bg, borderRadius: 10, padding: "12px", marginBottom: 10 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: C.textMid }}>抽查 {i + 1}</span>
                                        <button onClick={() => delRow("inspections", i)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{I.trash()}</button>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 6 }}>
                                        <div>
                                            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>抽查編號</div>
                                            <input style={tisStyle} placeholder="QC-001" value={ins.no} onChange={e => updArr("inspections", i, "no", e.target.value)} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>結果</div>
                                            <select style={tisStyle} value={ins.result} onChange={e => updArr("inspections", i, "result", e.target.value)}>
                                                <option>合格</option><option>不合格</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div style={{ marginBottom: 6 }}>
                                        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>抽查項目</div>
                                        <input style={tisStyle} placeholder="項目說明" value={ins.item} onChange={e => updArr("inspections", i, "item", e.target.value)} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>備註</div>
                                        <input style={tisStyle} placeholder="備註說明" value={ins.note} onChange={e => updArr("inspections", i, "note", e.target.value)} />
                                    </div>
                                </div>
                            ))}
                            {form.inspections.length === 0 && <div style={{ textAlign: "center", padding: "24px 0", color: C.textMuted, fontSize: 13 }}>點擊「新增抽查」開始填寫</div>}
                        </Card>
                    )}

                    {/* ── 品質試驗 ── */}
                    {activeTab === "quality" && (
                        <Card>
                            <SH icon={I.flask} title="品質試驗" action={() => addRow("qualityTests", { material: "", contractQty: "", doneQty: "", testItem: "", result: "合格", note: "" })} actionLabel="新增試驗" />
                            {form.qualityTests.map((qt, i) => (
                                <div key={i} style={{ background: C.bg, borderRadius: 10, padding: "12px", marginBottom: 10 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: C.textMid }}>試驗 {i + 1}</span>
                                        <button onClick={() => delRow("qualityTests", i)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{I.trash()}</button>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 6 }}>
                                        <div>
                                            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>材料/設備</div>
                                            <input style={tisStyle} placeholder="材料名稱" value={qt.material} onChange={e => updArr("qualityTests", i, "material", e.target.value)} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>試驗結果</div>
                                            <select style={tisStyle} value={qt.result} onChange={e => updArr("qualityTests", i, "result", e.target.value)}>
                                                <option>合格</option><option>不合格</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 6 }}>
                                        {[["試驗項目", "testItem", "坍度試驗"], ["契約數量", "contractQty", "500m³"], ["已作數量", "doneQty", "120m³"]].map(([label, key, ph]) => (
                                            <div key={key}>
                                                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>{label}</div>
                                                <input style={tisStyle} placeholder={ph} value={qt[key]} onChange={e => updArr("qualityTests", i, key, e.target.value)} />
                                            </div>
                                        ))}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>備註</div>
                                        <input style={tisStyle} placeholder="備註說明" value={qt.note} onChange={e => updArr("qualityTests", i, "note", e.target.value)} />
                                    </div>
                                </div>
                            ))}
                            {form.qualityTests.length === 0 && <div style={{ textAlign: "center", padding: "24px 0", color: C.textMuted, fontSize: 13 }}>點擊「新增試驗」開始填寫</div>}
                        </Card>
                    )}

                    {/* ── 文件管理 ── */}
                    {activeTab === "docs" && (
                        <>
                            <Card>
                                <SH icon={I.doc} title="文件管理" action={() => addRow("documents", { type: "業主公文", no: "", subject: "", date: today(), note: "" })} actionLabel="新增文件" />
                                {form.documents.map((d, i) => (
                                    <div key={i} style={{ background: C.bg, borderRadius: 10, padding: "12px", marginBottom: 10 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: C.textMid }}>文件 {i + 1}</span>
                                            <button onClick={() => delRow("documents", i)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{I.trash()}</button>
                                        </div>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 6 }}>
                                            <div>
                                                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>文件類型</div>
                                                <select style={tisStyle} value={d.type} onChange={e => updArr("documents", i, "type", e.target.value)}>
                                                    {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>日期</div>
                                                <input type="date" style={tisStyle} value={d.date} onChange={e => updArr("documents", i, "date", e.target.value)} />
                                            </div>
                                        </div>
                                        <div style={{ marginBottom: 6 }}>
                                            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>文號</div>
                                            <input style={tisStyle} placeholder="文件編號" value={d.no} onChange={e => updArr("documents", i, "no", e.target.value)} />
                                        </div>
                                        <div style={{ marginBottom: 6 }}>
                                            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>主旨</div>
                                            <input style={tisStyle} placeholder="文件主旨" value={d.subject} onChange={e => updArr("documents", i, "subject", e.target.value)} />
                                        </div>
                                        <input style={tisStyle} placeholder="備註" value={d.note} onChange={e => updArr("documents", i, "note", e.target.value)} />
                                    </div>
                                ))}
                                {form.documents.length === 0 && <div style={{ textAlign: "center", padding: "24px 0", color: C.textMuted, fontSize: 13 }}>點擊「新增文件」開始填寫</div>}
                            </Card>
                            <Card mb={0}>
                                <SH icon={I.doc} title="特別記載事項" />
                                <textarea style={{ ...inpStyle, resize: "vertical", height: 100, width: "100%" }}
                                    value={form.specialNote} onChange={e => set("specialNote", e.target.value)}
                                    placeholder="特別事項、人員安全、機具異常、業主指示等記載..." />
                            </Card>
                        </>
                    )}
                </div>
            </div>

            {/* Bottom nav */}
            <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--color-background-base)", borderTop: `1px solid ${C.border}`, padding: "8px 16px", display: "flex", gap: 8, zIndex: 50, boxShadow: "0 -2px 8px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 800, margin: "0 auto" }}>
                    {tabIdx > 0 && (
                        <button onClick={() => setActiveTab(tabKeys[tabIdx - 1])} style={{ flex: 1, padding: "7px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: "var(--color-surface)", color: C.textMid, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                            ← 上一頁
                        </button>
                    )}
                    {tabIdx < tabKeys.length - 1 ? (
                        <button onClick={() => setActiveTab(tabKeys[tabIdx + 1])} style={{ flex: 2, padding: "7px 12px", borderRadius: 8, border: "none", background: C.primary, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                            下一頁 →
                        </button>
                    ) : (
                        <button onClick={() => { onSave(form); }} style={{ flex: 2, padding: "7px 12px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#059669,#10b981)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                            {I.check("#fff")} 儲存施工日誌
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
