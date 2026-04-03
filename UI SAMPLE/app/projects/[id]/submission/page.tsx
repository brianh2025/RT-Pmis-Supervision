"use client";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { getProject } from "@/lib/mock-data";

type Submission = {
    name: string;
    id: string;
    vendor: string;
    date: string;
    status: string;
    statusColor: string;
    spec?: string;
    rev?: string;
    note?: string;
};

const submissions: Submission[] = [
    { name: "預拌混凝土 3500psi", id: "MAT-2023-0089", vendor: "亞東預拌混凝土", date: "114.01.24", status: "審核中", statusColor: "amber", spec: "03300 混凝土工程", rev: "Rev. 1", note: "第28天抗壓試體已送檢驗" },
    { name: "鋼筋材料 (SD420)", id: "MAT-2023-0042", vendor: "中鴻鋼鐵公司", date: "114.01.15", status: "已核准", statusColor: "emerald", spec: "03200 鋼筋工程", rev: "Rev. 2" },
    { name: "模板材料 (組裝式)", id: "MAT-2023-0092", vendor: "台灣模板公司", date: "缺審", status: "退件補正", statusColor: "red", spec: "03100 模板工程", rev: "待補", note: "材料證明文件不齊全" },
    { name: "防水膜 (PVC 1.5mm)", id: "MAT-2023-0101", vendor: "長興防水材料", date: "114.01.20", status: "已核准", statusColor: "emerald", spec: "07100 防水工程", rev: "Rev. 1" },
    { name: "鋼構件 H型鋼", id: "MAT-2023-0110", vendor: "東和鋼鐵", date: "114.01.22", status: "審核中", statusColor: "amber", spec: "05100 鋼構工程", rev: "Rev. 1" },
];

const statCards = [
    { label: "待送審", val: 12, icon: "pending_actions", color: "text-blue-500 bg-blue-50 dark:bg-blue-900/20" },
    { label: "審核中", val: 5, icon: "hourglass_top", color: "text-amber-500 bg-amber-50 dark:bg-amber-900/20" },
    { label: "已核准", val: 48, icon: "check_circle", color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" },
    { label: "退件補正", val: 2, icon: "warning", color: "text-red-500 bg-red-50 dark:bg-red-900/20" },
];

export default function SubmissionPage({ params }: { params: { id: string } }) {
    const id = params.id;
    const p = getProject(id);
    const [expandedIdx, setExpandedIdx] = useState(0);
    const [toast, setToast] = useState<string | null>(null);
    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    return (
        <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950">
                {toast && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg"
                        style={{ animation: "slide-up .25s ease both" }}>
                        {toast}
                    </div>
                )}
                <header className="h-10 flex items-center justify-between px-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-40 flex-shrink-0 animate-slide-down">
                    <div className="flex items-center gap-3">
                        <Link href={`/projects/${id}/dashboard`} className="text-slate-300 hover:text-slate-500 transition-colors">
                            <span className="material-icons-round text-lg">arrow_back</span>
                        </Link>
                        <h1 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <span className="material-icons-round text-[#1565C0]">fact_check</span>
                            材料設備送審管理 - {p.title}
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded ml-2">{id}</span>
                        </h1>
                    </div>
                    <button onClick={() => showToast("請填寫送審資料表單，包括材料名稱、規範章節、供應商等資訊。")} className="flex items-center gap-1 px-3 py-1.5 bg-[#1565C0] text-white text-[10px] font-bold rounded-lg shadow-sm hover:opacity-90 transition-opacity">
                        <span className="material-icons-round text-sm">add</span>
                        新增送審
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        {statCards.map((stat, i) => (
                            <div key={i} className={`bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between animate-slide-up stagger-${i + 1}`}>
                                <div>
                                    <p className="text-xs text-slate-500 mb-1">{stat.label}</p>
                                    <p className={`text-2xl font-bold ${stat.label === '退件補正' ? 'text-red-500' : 'dark:text-white'}`}>{stat.val}</p>
                                </div>
                                <div className={`p-2 rounded-lg ${stat.color}`}>
                                    <span className="material-icons-round">{stat.icon}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Table */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-slide-up stagger-5">
                        <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            <div className="col-span-4">材料名稱 / 編號</div>
                            <div className="col-span-3">供應商</div>
                            <div className="col-span-3">日期</div>
                            <div className="col-span-2 text-right">狀態</div>
                        </div>
                        {submissions.map((sub, i) => (
                            <div key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                                <div
                                    className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-4 py-3 items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                                    onClick={() => setExpandedIdx(expandedIdx === i ? -1 : i)}
                                >
                                    <div className="col-span-4 flex items-center gap-2">
                                        <span className={`material-icons-round text-slate-400 transition-transform duration-200 ${expandedIdx === i ? 'rotate-180' : ''}`}>expand_more</span>
                                        <div>
                                            <h3 className="text-sm font-bold dark:text-white">{sub.name}</h3>
                                            <p className="text-xs text-slate-400 font-mono">{sub.id}</p>
                                        </div>
                                    </div>
                                    <div className="col-span-3 text-sm text-slate-600 dark:text-slate-400 hidden md:block">{sub.vendor}</div>
                                    <div className="col-span-3 text-sm text-slate-600 dark:text-slate-400 hidden md:block">{sub.date}</div>
                                    <div className="col-span-2 text-right">
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border ${sub.statusColor === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' :
                                                sub.statusColor === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' :
                                                    'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                                            }`}>{sub.status}</span>
                                    </div>
                                </div>
                                {/* Expanded detail */}
                                <div className={`overflow-hidden transition-all duration-300 ${expandedIdx === i ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                                    <div className="px-14 py-4 bg-slate-50 dark:bg-slate-800/20 border-t border-dashed border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                                        <div className="space-y-2">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase">送審細項</h4>
                                            {sub.spec && <p className="text-sm"><span className="text-slate-500">規範章節:</span> {sub.spec}</p>}
                                            {sub.rev && <p className="text-sm"><span className="text-slate-500">版次:</span> {sub.rev}</p>}
                                        </div>
                                        {sub.note && (
                                            <div className="space-y-2">
                                                <h4 className="text-xs font-bold text-slate-400 uppercase">審查意見/備註</h4>
                                                <div className="p-3 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
                                                    {sub.note}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
