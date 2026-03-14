"use client";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { getProject } from "@/lib/mock-data";

const chartData = [
    { month: "8月", planned: 10, actual: 12 },
    { month: "9月", planned: 20, actual: 22 },
    { month: "10月", planned: 32, actual: 30 },
    { month: "11月", planned: 45, actual: 38 },
    { month: "12月", planned: 55, actual: 43 },
    { month: "1月", planned: 60, actual: 43 },
];

const stats = [
    { label: "契約金額", value: "256,980,000", sub: "新台幣 (NTD)", icon: "attach_money", color: "bg-blue-500/10 text-blue-500" },
    { label: "工期天數", value: "841", sub: "日曆天計算", icon: "schedule", color: "bg-emerald-500/10 text-emerald-500" },
    { label: "施工狀態", value: "施工中", sub: "進度: 偏慢中", icon: "construction", color: "bg-amber-500/10 text-amber-500" },
    { label: "請款進度", value: "35%", sub: "累計請款: 3 期", icon: "payments", color: "bg-violet-500/10 text-violet-500" },
];

export default function AnalyticsPage({ params }: { params: { id: string } }) {
    const id = params.id;
    const p = getProject(id);
    const [toast, setToast] = useState<string | null>(null);
    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };
    return (
        <div className="flex h-screen overflow-hidden">
            <Sidebar />
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg"
                    style={{ animation: "slide-up .25s ease both" }}>
                    {toast}
                </div>
            )}
            <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 animate-slide-down">
                        <div className="flex items-center gap-3">
                            <Link href={`/projects/${id}/dashboard`} className="text-slate-300 hover:text-slate-500 transition-colors">
                                <span className="material-icons-round text-lg">arrow_back</span>
                            </Link>
                            <div>
                                <h1 className="text-lg font-bold dark:text-white flex items-center gap-2">
                                    <span className="material-icons-round text-[#1565C0] hidden lg:inline">analytics</span>
                                    進度分析
                                    <span className="text-[10px] font-mono text-slate-400 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded ml-2">{id}</span>
                                </h1>
                                <p className="text-[11px] text-slate-400">{p.title}</p>
                            </div>
                        </div>
                        <button onClick={() => showToast("正在產出 Excel 報表，請稍候…")} className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            匯出報表
                        </button>
                    </div>

                    {/* Stat cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {stats.map((card, idx) => (
                            <div key={idx} className={`bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-[#1565C0]/20 transition-all animate-slide-up stagger-${idx + 1}`}>
                                <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <span className="material-icons-round text-6xl">{card.icon}</span>
                                </div>
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <h3 className="text-sm font-medium text-slate-500">{card.label}</h3>
                                    <div className={`p-2 rounded-lg ${card.color}`}>
                                        <span className="material-icons-outlined text-lg">{card.icon}</span>
                                    </div>
                                </div>
                                <div className="relative z-10">
                                    <p className="text-2xl font-bold dark:text-white">{card.value}</p>
                                    <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Charts area */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-slide-up stagger-5">
                        {/* S-Curve Chart (simulated) */}
                        <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h3 className="text-[13px] font-bold mb-4 flex items-center gap-2">
                                <span className="material-icons-round text-[#1565C0] text-base">trending_up</span>
                                進度 S 曲線
                            </h3>
                            {/* Bar chart simulation */}
                            <div className="flex items-end gap-2 h-40 mb-3">
                                {chartData.map((d, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group/bar relative">
                                        <div className="w-full flex gap-1 items-end" style={{ height: '180px' }}>
                                            <div
                                                onClick={() => showToast(`${d.month} 預定進度: ${d.planned}%`)}
                                                className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-t-sm animate-progress cursor-help"
                                                style={{ height: `${(d.planned / 60) * 100}%`, animationDelay: `${i * 0.1}s` }}
                                            />
                                            <div
                                                onClick={() => showToast(`${d.month} 實際進度: ${d.actual}%`)}
                                                className="flex-1 bg-[#1565C0] rounded-t-sm animate-progress cursor-help"
                                                style={{ height: `${(d.actual / 60) * 100}%`, animationDelay: `${i * 0.1 + 0.05}s` }}
                                            />
                                        </div>
                                        <span className="text-[10px] text-slate-400">{d.month}</span>
                                        {/* Simple Tooltip on hover */}
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                                            實: {d.actual}% / 預: {d.planned}%
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-6 text-[10px]">
                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-slate-200 dark:bg-slate-700" />預定進度</div>
                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#1565C0]" />實際進度</div>
                            </div>
                        </div>

                        {/* Progress summary */}
                        <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h3 className="text-[13px] font-bold mb-4 flex items-center gap-2">
                                <span className="material-icons-round text-[#1565C0] text-base">pie_chart</span>
                                進度摘要
                            </h3>
                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between mb-1.5">
                                        <span className="text-[11px] font-bold">施工累計進度</span>
                                        <span className="text-[11px] font-bold text-[#1565C0]">實際 43% / 預定 60%</span>
                                    </div>
                                    <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
                                        <div className="absolute inset-0 bg-slate-200 dark:bg-slate-700 rounded-full animate-progress" style={{ width: "60%" }} />
                                        <div className="absolute inset-0 bg-[#1565C0] rounded-full animate-progress" style={{ width: "43%", animationDelay: "0.2s" }} />
                                    </div>
                                    <p className="text-[10px] text-red-500 font-bold mt-2 flex items-center gap-1">
                                        <span className="material-icons-round text-xs">warning</span>
                                        進度落後 17%，需加速趕工
                                    </p>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <span className="text-sm font-bold">請款進度</span>
                                        <span className="text-sm font-bold text-violet-500">35%</span>
                                    </div>
                                    <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-violet-500 rounded-full animate-progress" style={{ width: "35%" }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
