import React, { useState } from 'react';
import { Card, SH, I, Badge, ProgressBar, weatherIcon, C } from './utils';

function cleanNotes(raw) {
    if (!raw) return '';
    const lines = raw.split('\n');
    const cut = lines.findIndex(l => /^[一二三四五六七八九十]+[、]/.test(l.trim()));
    return (cut === -1 ? lines : lines.slice(0, cut)).join('\n').trim();
}
function fmtNum(v) {
    if (v == null || v === '') return '—';
    const n = parseFloat(v);
    return isNaN(n) ? String(v) : String(parseFloat(n.toFixed(2)));
}
function fmtPct(v) {
    if (v == null) return '—';
    const n = parseFloat(v);
    return isNaN(n) ? '—' : parseFloat(n.toFixed(2)) + '%';
}

export function DailyReportView({ report, onBack, onEdit, supervision = false }) {
    const [tab, setTab] = useState("progress");
    const diff = parseFloat(((report.actualProgress ?? 0) - (report.plannedProgress ?? 0)).toFixed(2));
    const ahead = diff >= 0;
    const docTitle  = supervision ? '監造報表' : '施工日誌';
    const editLabel = supervision ? '前往施工日誌編輯' : '編輯此施工日誌';

    const tabs = [
        { key: "progress", label: "工程進度" },
        { key: "qty",      label: "數量計算" },
        { key: "inspect",  label: "施工抽查" },
        { key: "quality",  label: "品質試驗" },
        { key: "docs",     label: "文件管理" },
        ...(supervision ? [{ key: "chk", label: "抽查驗" }] : []),
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8 }}>

            {/* 標題列 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
                <button onClick={onBack} style={{ padding: '4px 6px', background: 'none', border: 'none', cursor: 'pointer', color: C.textMid }}>
                    {I.back(C.textMid)}
                </button>
                <div>
                    <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: C.text }}>{docTitle}　{report.date}</h2>
                    <div style={{ fontSize: '0.68rem', color: C.textMuted }}>編號：{report.reportNo}</div>
                </div>
            </div>

            {/* 基本資訊 */}
            <Card mb={0} p="10px 14px">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '7px 16px' }}>
                    {[
                        ['報表編號', report.reportNo],
                        ['日期',     report.date],
                        ['天氣',     `${weatherIcon[report.weather] || ''} ${report.weather}`],
                        ['氣溫',     `${report.tempLow}°C ～ ${report.tempHigh}°C`],
                        ['監造人員', report.supervisor],
                        ['承攬廠商', report.contractor],
                    ].map(([k, v]) => (
                        <div key={k}>
                            <div style={{ fontSize: '0.62rem', color: C.textMuted, marginBottom: 1 }}>{k}</div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: C.text }}>{v}</div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* 編輯按鈕 */}
            <button onClick={onEdit} style={{
                width: '100%', padding: '7px', borderRadius: 8,
                border: `1px solid var(--color-border)`,
                background: 'var(--color-surface)',
                color: C.textMid, fontSize: '0.78rem', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 6, transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-surface)'; }}>
                {I.edit(C.textMid)} {editLabel}
            </button>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 5, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{
                        padding: '5px 12px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0,
                        border: `1.5px solid ${tab === t.key ? C.primary : 'var(--color-border)'}`,
                        background: tab === t.key ? C.primary : 'var(--color-surface)',
                        color: tab === t.key ? '#fff' : C.textMid,
                        fontSize: '0.75rem', fontWeight: tab === t.key ? 700 : 400,
                        cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab 內容 */}
            {tab === 'progress' && (
                <Card mb={0} p="12px 14px">
                    <SH icon={I.chart} title="工程進度" />
                    <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.78rem' }}>
                            <span style={{ color: C.textMid }}>整體施工進度</span>
                            <span style={{ fontWeight: 700, color: ahead ? C.success : C.danger }}>
                                {fmtPct(report.actualProgress)} / {fmtPct(report.plannedProgress)} 計畫
                            </span>
                        </div>
                        <ProgressBar value={report.actualProgress} planned={report.plannedProgress} color={ahead ? '#10b981' : '#f43f5e'} height={7} />
                        <div style={{ textAlign: 'center', marginTop: 6, fontSize: '0.78rem', fontWeight: 700, color: ahead ? C.success : C.danger }}>
                            {ahead ? '▲' : '▼'} 進度差異 {ahead ? '+' : ''}{diff}%
                        </div>
                    </div>
                    {cleanNotes(report.progressNote) && (
                        <div style={{ background: 'var(--color-bg2)', borderRadius: 8, padding: '9px 12px', fontSize: '0.78rem', color: C.textMid, lineHeight: 1.7, borderLeft: `3px solid ${C.primary}`, whiteSpace: 'pre-wrap' }}>
                            {cleanNotes(report.progressNote)}
                        </div>
                    )}
                </Card>
            )}

            {tab === 'qty' && (
                <Card mb={0} p="12px 14px">
                    <SH icon={I.chart} title="數量計算" />
                    {report.quantities.length === 0
                        ? <div style={{ textAlign: 'center', color: C.textMuted, padding: '16px 0', fontSize: '0.78rem' }}>無數量計算資料</div>
                        : report.quantities.map((q, i) => (
                            <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: i < report.quantities.length - 1 ? `1px solid var(--color-border)` : 'none' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: C.text, marginBottom: 6 }}>{q.item}</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                                    {[['單位', q.unit], ['契約數量', fmtNum(q.contractQty)], ['本日數量', fmtNum(q.todayQty)], ['累計數量', fmtNum(q.cumQty)]].map(([k, v]) => (
                                        <div key={k} style={{ background: 'var(--color-bg2)', borderRadius: 7, padding: '5px 7px' }}>
                                            <div style={{ fontSize: '0.6rem', color: C.textMuted }}>{k}</div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: C.text }}>{v}</div>
                                        </div>
                                    ))}
                                </div>
                                {q.note && <div style={{ fontSize: '0.7rem', color: C.textMuted, marginTop: 4 }}>備註：{q.note}</div>}
                            </div>
                        ))
                    }
                </Card>
            )}

            {tab === 'inspect' && (
                <Card mb={0} p="12px 14px">
                    <SH icon={I.shield} title="施工抽查" />
                    {report.inspections.length === 0
                        ? <div style={{ textAlign: 'center', color: C.textMuted, padding: '16px 0', fontSize: '0.78rem' }}>無抽查紀錄</div>
                        : report.inspections.map((ins, i) => (
                            <div key={i} style={{ marginBottom: 8, background: 'var(--color-bg2)', borderRadius: 8, padding: '9px 12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <div>
                                        <span style={{ fontSize: '0.68rem', color: C.textMuted, marginRight: 7 }}>{ins.no}</span>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: C.text }}>{ins.item}</span>
                                    </div>
                                    <Badge label={ins.result} variant={ins.result === '合格' ? 'success' : 'danger'} />
                                </div>
                                {ins.note && <div style={{ fontSize: '0.73rem', color: C.textMid }}>📌 {ins.note}</div>}
                            </div>
                        ))
                    }
                </Card>
            )}

            {tab === 'quality' && (
                <Card mb={0} p="12px 14px">
                    <SH icon={I.flask} title="品質試驗" />
                    {report.qualityTests.length === 0
                        ? <div style={{ textAlign: 'center', color: C.textMuted, padding: '16px 0', fontSize: '0.78rem' }}>無試驗紀錄</div>
                        : report.qualityTests.map((qt, i) => (
                            <div key={i} style={{ marginBottom: 8, background: 'var(--color-bg2)', borderRadius: 8, padding: '9px 12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: C.text }}>{qt.material}</span>
                                    <Badge label={qt.result} variant={qt.result === '合格' ? 'success' : 'danger'} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, marginBottom: qt.note ? 5 : 0 }}>
                                    {[['契約數量', qt.contractQty], ['已作數量', qt.doneQty], ['試驗項目', qt.testItem]].map(([k, v]) => (
                                        <div key={k}>
                                            <div style={{ fontSize: '0.6rem', color: C.textMuted }}>{k}</div>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: C.text }}>{v}</div>
                                        </div>
                                    ))}
                                </div>
                                {qt.note && <div style={{ fontSize: '0.7rem', color: C.textMid }}>📌 {qt.note}</div>}
                            </div>
                        ))
                    }
                </Card>
            )}

            {tab === 'docs' && (
                <>
                    <Card mb={0} p="12px 14px">
                        <SH icon={I.doc} title="文件管理" />
                        {report.documents.length === 0
                            ? <div style={{ textAlign: 'center', color: C.textMuted, padding: '16px 0', fontSize: '0.78rem' }}>無文件紀錄</div>
                            : report.documents.map((d, i) => (
                                <div key={i} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: i < report.documents.length - 1 ? `1px solid var(--color-border)` : 'none' }}>
                                    <div style={{ marginBottom: 4 }}><Badge label={d.type} variant="blue" /></div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: C.text, marginBottom: 2 }}>{d.subject}</div>
                                    <div style={{ fontSize: '0.7rem', color: C.textMuted }}>文號：{d.no} · {d.date}</div>
                                    {d.note && <div style={{ fontSize: '0.7rem', color: C.textMid, background: 'var(--color-bg2)', borderRadius: 6, padding: '5px 9px', marginTop: 5 }}>📌 {d.note}</div>}
                                </div>
                            ))
                        }
                    </Card>
                    {cleanNotes(report.specialNote) && (
                        <Card mb={0} p="12px 14px">
                            <SH icon={I.doc} title="特別記載事項" />
                            <div style={{ fontSize: '0.78rem', color: C.textMid, lineHeight: 1.8, background: 'var(--color-bg2)', borderRadius: 8, padding: '9px 12px', borderLeft: '3px solid var(--color-warning, #f59e0b)', whiteSpace: 'pre-wrap' }}>
                                {cleanNotes(report.specialNote)}
                            </div>
                        </Card>
                    )}
                </>
            )}

            {tab === 'chk' && (
                <Card mb={0} p="12px 14px">
                    <SH icon={I.shield} title="抽查驗" />
                    {(report.inspections?.length > 0 || report.qualityTests?.length > 0) ? (
                        <>
                            {report.inspections?.map((ins, i) => (
                                <div key={i} style={{ marginBottom: 8, background: 'var(--color-bg2)', borderRadius: 8, padding: '9px 12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <div>
                                            <span style={{ fontSize: '0.68rem', color: C.textMuted, marginRight: 7 }}>{ins.no}</span>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: C.text }}>{ins.item}</span>
                                        </div>
                                        <Badge label={ins.result} variant={ins.result === '合格' ? 'success' : 'danger'} />
                                    </div>
                                    {ins.note && <div style={{ fontSize: '0.73rem', color: C.textMid }}>📌 {ins.note}</div>}
                                </div>
                            ))}
                            {report.qualityTests?.map((qt, i) => (
                                <div key={i} style={{ marginBottom: 8, background: 'var(--color-bg2)', borderRadius: 8, padding: '9px 12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: C.text }}>{qt.material}</span>
                                        <Badge label={qt.result} variant={qt.result === '合格' ? 'success' : 'danger'} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, marginBottom: qt.note ? 5 : 0 }}>
                                        {[['契約數量', fmtNum(qt.contractQty)], ['已作數量', fmtNum(qt.doneQty)], ['試驗項目', qt.testItem]].map(([k, v]) => (
                                            <div key={k}>
                                                <div style={{ fontSize: '0.6rem', color: C.textMuted }}>{k}</div>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: C.text }}>{v}</div>
                                            </div>
                                        ))}
                                    </div>
                                    {qt.note && <div style={{ fontSize: '0.7rem', color: C.textMid }}>📌 {qt.note}</div>}
                                </div>
                            ))}
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', color: C.textMuted, padding: '16px 0', fontSize: '0.78rem' }}>尚無抽查驗紀錄</div>
                    )}
                </Card>
            )}
        </div>
    );
}
