"use client";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { getProject } from "@/lib/mock-data";

type Doc = {
    id: string;
    name: string;
    type: string;
    date: string;
    size: string;
    category: string;
};

const defaultDocs: Doc[] = [
    { id: "DOC-001", name: "施工計畫書 Rev.3", type: "pdf", date: "114.01.15", size: "12.5 MB", category: "施工計畫" },
    { id: "DOC-002", name: "品質計畫書", type: "pdf", date: "114.01.10", size: "8.2 MB", category: "品管文件" },
    { id: "DOC-003", name: "環安衛計畫書", type: "pdf", date: "114.01.08", size: "5.7 MB", category: "安衛文件" },
    { id: "DOC-004", name: "114A10089 契約書", type: "pdf", date: "113.12.20", size: "23.1 MB", category: "契約" },
    { id: "DOC-005", name: "地質鑽探報告", type: "pdf", date: "113.11.30", size: "45.3 MB", category: "調查報告" },
    { id: "DOC-006", name: "結構設計圖 (S-001~S-050)", type: "dwg", date: "113.12.15", size: "128 MB", category: "設計圖" },
];

const categories = ["全部", "施工計畫", "品管文件", "安衛文件", "契約", "調查報告", "設計圖"];
const typeIcons: Record<string, string> = { pdf: "picture_as_pdf", dwg: "architecture", doc: "description", xls: "table_chart" };

export default function ArchivePage({ params }: { params: { id: string } }) {
    const id = params.id;
    const p = getProject(id);
    const [activeCategory, setActiveCategory] = useState("全部");
    const [toast, setToast] = useState<string | null>(null);
    const filtered = activeCategory === "全部" ? defaultDocs : defaultDocs.filter((d) => d.category === activeCategory);
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
                <header className="h-14 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-40 flex-shrink-0 animate-slide-down">
                    <div className="flex items-center gap-3">
                        <Link href={`/projects/${id}/dashboard`} className="text-slate-300 hover:text-slate-500 transition-colors">
                            <span className="material-icons-round text-lg">arrow_back</span>
                        </Link>
                        <h1 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <span className="material-icons-round text-[#1565C0]">folder_open</span>
                            歸檔管理 - {p.title}
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded ml-2">{id}</span>
                        </h1>
                    </div>
                    <button onClick={() => showToast("請選擇要上傳的文件，支援 PDF / DWG / XLS 格式。")} className="flex items-center gap-1 px-3 py-1.5 bg-[#1565C0] text-white text-[10px] font-bold rounded-lg shadow-sm hover:opacity-90 transition-opacity">
                        <span className="material-icons-round text-sm">upload_file</span>
                        上傳文件
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {/* Category tabs */}
                    <div className="flex gap-2 mb-6 overflow-x-auto pb-2 animate-fade-in">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${activeCategory === cat
                                        ? "bg-[#1565C0] text-white shadow-md"
                                        : "bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800 hover:border-[#1565C0]/30"
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* File grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map((doc, i) => (
                            <div key={doc.id} className={`group bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:shadow-md hover:border-[#1565C0]/20 transition-all cursor-pointer animate-slide-up stagger-${i + 1}`}>
                                <div className="flex items-start gap-3">
                                    <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 group-hover:scale-110 transition-transform">
                                        <span className="material-icons-round text-xl">{typeIcons[doc.type] || "description"}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-bold text-slate-800 dark:text-white truncate group-hover:text-[#1565C0] transition-colors">{doc.name}</h3>
                                        <p className="text-[10px] text-slate-400 font-mono mt-1">{doc.id}</p>
                                    </div>
                                    <button onClick={() => showToast(`正在下載 ${doc.name}…`)} className="ml-2 flex-shrink-0 text-slate-300 hover:text-[#1565C0] transition-colors">
                                        <span className="material-icons-round text-lg">download</span>
                                    </button>
                                </div>
                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                        <span>{doc.date}</span>
                                        <span>{doc.size}</span>
                                    </div>
                                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[9px] font-bold text-slate-500">{doc.category}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
