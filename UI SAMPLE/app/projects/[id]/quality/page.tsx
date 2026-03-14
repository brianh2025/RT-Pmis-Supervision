"use client";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { getProject } from "@/lib/mock-data";

const stats = [
    { label: "累計試驗次數", val: "128", icon: "assignment_turned_in", color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20", trend: "+12%" },
    { label: "試驗合格率", val: "98.5%", icon: "science", color: "text-blue-500 bg-blue-50 dark:bg-blue-900/20" },
    { label: "進行中檢驗停留點", val: "3", icon: "warning", color: "text-orange-500 bg-orange-50 dark:bg-orange-900/20" },
    { label: "最近抽驗日距今", val: "14 天", icon: "event", color: "text-purple-500 bg-purple-50 dark:bg-purple-900/20" },
];

const testRecords = [
    { date: "今天 10:30", code: "QC-20250124-01", name: "混凝土坍度試驗", status: "ok", type: "材料" },
    { date: "昨天 14:20", code: "QC-20250123-05", name: "鋼筋拉力試驗", status: "ok", type: "材料" },
    { date: "排定 01/25", code: "QC-20250125-01", name: "基礎承載力檢測", status: "pending", type: "施工" },
    { date: "缺失 01/22", code: "QC-20250122-03", name: "鋼筋保護層厚度不足", status: "fail", type: "施工" },
];

const alerts = [
    { text: "缺失尚未改善", sub: "編號 QC-20250115-04 已逾期未改善完成" },
];

const schedule = [
    { time: "09:00", text: "基礎承載力現場測試" },
    { time: "13:30", text: "鋼筋隱蔽前會勘" },
];

export default function QualityPage({ params }: { params: { id: string } }) {
    const id = params.id;
    const p = getProject(id);
    const [filter, setFilter] = useState("全部");
    const [toast, setToast] = useState<string | null>(null);
    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };
    const filtered = filter === "全部" ? testRecords : testRecords.filter(r => r.type === filter);

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
                            <span className="material-icons-round text-[#1565C0]">verified_user</span>
                            品質管制中心 - {p.title}
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded ml-2">{id}</span>
                        </h1>
                    </div>
                    <div className="flex gap-2">
                        {["全部", "材料", "施工"].map((f) => (
                            <button key={f} onClick={() => setFilter(f)}
                                className={`text-xs px-3 py-1.5 font-bold rounded-lg transition-colors ${ filter === f ? "bg-[#1565C0] text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" }`}>
                                {f}
                            </button>
                        ))}
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                        {stats.map((stat, i) => (
                            <div key={i} className={`bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm group hover:border-[#1565C0]/30 transition-all animate-slide-up stagger-${i + 1}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-sm font-medium text-slate-500">{stat.label}</span>
                                    <div className={`p-1.5 rounded-lg ${stat.color} group-hover:scale-110 transition-transform`}>
                                        <span className="material-icons-round text-lg">{stat.icon}</span>
                                    </div>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold dark:text-white">{stat.val}</span>
                                    {stat.trend && <span className="text-xs font-bold text-emerald-600">↑{stat.trend}</span>}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-slide-up stagger-5">
                        {/* Test records table */}
                        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                                <h2 className="font-bold flex items-center gap-2">
                                    <span className="material-icons-round text-[#1565C0] text-base">history</span>
                                    近期試驗紀錄
                                </h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-800/20 text-[11px] font-bold text-slate-400 text-left border-b border-slate-100 dark:border-slate-800 uppercase">
                                            <th className="px-4 py-2">時間/狀態</th>
                                            <th className="px-4 py-2">編號</th>
                                            <th className="px-4 py-2">項目</th>
                                            <th className="px-4 py-2 text-right">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {filtered.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${row.status === 'ok' ? 'bg-emerald-500' :
                                                                row.status === 'fail' ? 'bg-red-500' :
                                                                    'bg-slate-300 animate-pulse'
                                                            }`} />
                                                        <span className="font-medium">{row.date}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{row.code}</td>
                                                <td className="px-4 py-3 font-bold text-slate-800 dark:text-white text-xs">{row.name}</td>
                                                <td className="px-4 py-3 text-right text-xs">
                                                    <button onClick={() => showToast(`正在開啟 ${row.code} 試驗報告…`)} className="text-[#1565C0] font-bold hover:underline">查看報告</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Right column */}
                        <div className="space-y-4">
                            {/* Alert */}
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 animate-slide-up stagger-6">
                                <h3 className="font-bold mb-3 flex items-center gap-2 text-orange-500 text-sm">
                                    <span className="material-icons-round text-lg">priority_high</span>
                                    待處理警示
                                </h3>
                                {alerts.map((alert, i) => (
                                    <div key={i} className="bg-orange-50 dark:bg-orange-900/10 p-3 rounded-lg border border-orange-100 dark:border-orange-900/30">
                                        <p className="text-xs font-bold text-orange-800 dark:text-orange-200">{alert.text}</p>
                                        <p className="text-[10px] text-orange-600 mt-1">{alert.sub}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Schedule */}
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 animate-slide-up stagger-7">
                                <h3 className="font-bold mb-3 flex items-center gap-2 text-purple-500 text-sm">
                                    <span className="material-icons-round text-lg">calendar_month</span>
                                    今日排程
                                </h3>
                                <div className="space-y-3">
                                    {schedule.map((item, i) => (
                                        <div key={i} onClick={() => showToast(`查看行程詳情：${item.text} (${item.time})`)} className="flex gap-3 text-sm group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors">
                                            <span className="text-slate-400 font-mono text-xs pt-0.5">{item.time}</span>
                                            <p className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-[#1565C0] transition-colors">{item.text}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
