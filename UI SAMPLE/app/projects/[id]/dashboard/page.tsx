"use client";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { use, useState } from "react";
import { getProject } from "@/lib/mock-data";

export default function ProjectDashboard({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const p = getProject(id);
    const [toast, setToast] = useState<string | null>(null);
    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const stats = [
        { label: "契約金額 (萬)", value: p.contractAmount, icon: "attach_money", accent: "text-sky-500 bg-sky-50" },
        { label: "工期天數", value: p.days, icon: "schedule", accent: "text-emerald-500 bg-emerald-50" },
        { label: "施工進度", value: `${p.progress}%`, icon: "trending_up", accent: "text-[#1565C0] bg-blue-50" },
        { label: "請款進度", value: `${p.payment}%`, icon: "payments", accent: "text-violet-500 bg-violet-50" },
    ];

    return (
        <div className="flex h-screen overflow-hidden bg-[#f8f9fb]">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                {toast && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg"
                        style={{ animation: "slide-up .25s ease both" }}>
                        {toast}
                    </div>
                )}
                <header className="bg-white/80 backdrop-blur-lg sticky top-0 z-40 border-b border-slate-100">
                    <div className="max-w-[1400px] mx-auto px-5 h-11 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Link href="/projects" className="text-slate-300 hover:text-slate-500 transition-colors">
                                <span className="material-icons-round text-lg">arrow_back</span>
                            </Link>
                            <span className="text-[13px] text-slate-700">{p.title}</span>
                            <span className="text-[10px] font-mono text-slate-400">系統編號 {id}</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => showToast("報告產出功能開發中，敬請期待。")} className="text-[11px] text-slate-400 px-2.5 py-1 rounded-md hover:bg-slate-50 transition-colors flex items-center gap-1">
                                <span className="material-icons-round text-sm">download</span>匯出報告
                            </button>
                            <Link href={`/projects/${id}/daily-log`} className="text-[11px] text-[#1565C0] px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-1">
                                <span className="material-icons-round text-sm">assignment</span>施工日誌
                            </Link>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="max-w-[1400px] mx-auto px-5 py-5">
                        {/* Stats */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                            {stats.map((s, i) => (
                                <div key={i} className="bg-white rounded-xl border border-slate-100 p-4 group hover:shadow-md hover:shadow-slate-100/60 transition-all duration-300"
                                    style={{ opacity: 0, animation: `slide-up .4s ease ${i * 0.07}s both` }}>
                                    <div className="flex items-start justify-between mb-3">
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">{s.label}</span>
                                        <div className={`size-7 rounded-lg ${s.accent} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                            <span className="material-icons-round text-base">{s.icon}</span>
                                        </div>
                                    </div>
                                    <span className="text-2xl text-slate-700">{s.value}</span>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                            {/* S-Curve */}
                            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-100 p-5" style={{ opacity: 0, animation: "slide-up .4s ease .3s both" }}>
                                <div className="flex items-center justify-between mb-5">
                                    <span className="text-[13px] text-slate-600 flex items-center gap-1.5">
                                        <span className="material-icons-round text-[#1565C0] text-base">trending_up</span>進度 S 曲線
                                    </span>
                                    <div className="flex gap-3 text-[10px] text-slate-400">
                                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-200" />預定</span>
                                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#1565C0]" />實際</span>
                                    </div>
                                </div>
                                <div className="flex items-end gap-2 h-40">
                                    {[{ m: "8月", p: 10, a: 12 }, { m: "9月", p: 20, a: 22 }, { m: "10月", p: 32, a: 30 }, { m: "11月", p: 45, a: 38 }, { m: "12月", p: 55, a: 43 }, { m: "1月", p: 60, a: 43 }].map((d, i) => (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-1 group/bar relative">
                                            <div className="w-full flex gap-[2px] items-end" style={{ height: "140px" }}>
                                                <div onClick={() => showToast(`${d.m} 預定: ${d.p}%`)} className="flex-1 bg-slate-100 rounded-t-sm transition-all duration-700 ease-out cursor-help" style={{ height: `${(d.p / 60) * 100}%`, transitionDelay: `${i * 80}ms` }} />
                                                <div onClick={() => showToast(`${d.m} 實際: ${d.a}%`)} className="flex-1 bg-[#1565C0] rounded-t-sm transition-all duration-700 ease-out cursor-help" style={{ height: `${(d.a / 60) * 100}%`, transitionDelay: `${i * 80 + 40}ms` }} />
                                            </div>
                                            <span className="text-[10px] text-slate-400">{d.m}</span>
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                                                實: {d.a}% / 預: {d.p}%
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Progress Summary */}
                            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-100 p-5" style={{ opacity: 0, animation: "slide-up .4s ease .35s both" }}>
                                <span className="text-[13px] text-slate-600 flex items-center gap-1.5 mb-5">
                                    <span className="material-icons-round text-[#1565C0] text-base">pie_chart</span>進度摘要
                                </span>
                                    <div className="space-y-6">
                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-[11px] text-slate-500">施工累計進度</span>
                                            <span className="text-[11px] text-[#1565C0]">實 {p.progress}% / 預 {p.planned}%</span>
                                        </div>
                                        <div className="relative h-3 w-full bg-slate-50 rounded-full overflow-hidden">
                                            <div className="absolute h-full bg-slate-200 rounded-full" style={{ width: `${p.planned}%` }} />
                                            <div className="absolute h-full bg-[#1565C0] rounded-full" style={{ width: `${p.progress}%` }} />
                                        </div>
                                        {p.progress < p.planned && (
                                            <p className="text-[10px] text-rose-500 mt-1.5 flex items-center gap-0.5">
                                                <span className="material-icons-round text-[11px]">warning</span>進度落後 {p.planned - p.progress}%
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-[11px] text-slate-500">請款進度</span>
                                            <span className="text-[11px] text-violet-500">{p.payment}%</span>
                                        </div>
                                        <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden">
                                            <div className="h-full bg-violet-400 rounded-full" style={{ width: `${p.payment}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
