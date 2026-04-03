"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";

type Project = {
    id: string;
    title: string;
    client: string;
    status: string;
    prog: number;
    targetProg: number;
    pay: number;
    color: string;
    isNew?: boolean;
};

const defaultProjects: Project[] = [
    { id: "114A10089", title: "某市正北路橋樑工程標段維護", client: "交通部公路局", status: "準備中", prog: 0, targetProg: 0, pay: 0, color: "gray" },
    { id: "114A10092", title: "濱海大道橋樑 A - 基樁及承台工程", client: "縣政府工務局", status: "施工中", prog: 85, targetProg: 80, pay: 70, color: "green" },
    { id: "113B20155", title: "北港商業大樓 - 地下室開挖工程", client: "私人業主", status: "落後中", prog: 45, targetProg: 60, pay: 30, color: "orange" },
    { id: "114A10101", title: "行政中心新建工程 - 主體結構施工", client: "私人業主", status: "施工中", prog: 62, targetProg: 60, pay: 55, color: "green" },
    { id: "114C30055", title: "東大路道路排水 - 疏浚工程", client: "市政府工務局", status: "嚴重落後", prog: 20, targetProg: 45, pay: 15, color: "red" },
    { id: "114D50012", title: "科技園區污水截流管工程 - 管線移位", client: "科技園區管委", status: "待開工", prog: 12, targetProg: 15, pay: 5, color: "blue" },
];

const statusStyle: Record<string, { bg: string; text: string; dot: string }> = {
    green: { bg: "bg-emerald-50", text: "text-emerald-600", dot: "bg-emerald-400" },
    orange: { bg: "bg-amber-50", text: "text-amber-600", dot: "bg-amber-400" },
    red: { bg: "bg-rose-50", text: "text-rose-600", dot: "bg-rose-400" },
    blue: { bg: "bg-sky-50", text: "text-sky-600", dot: "bg-sky-400" },
    gray: { bg: "bg-slate-50", text: "text-slate-500", dot: "bg-slate-300" },
};

const accentLine: Record<string, string> = {
    green: "from-emerald-400 to-emerald-300", orange: "from-amber-400 to-amber-300",
    red: "from-rose-400 to-rose-300", blue: "from-sky-400 to-sky-300", gray: "from-slate-300 to-slate-200",
};

function generateId() {
    const l = "ABCDE"[Math.floor(Math.random() * 5)];
    return `114${l}${Math.floor(10000 + Math.random() * 90000)}`;
}

function AnimatedBar({ value, color, delay = 0 }: { value: number; color: string; delay?: number }) {
    const [w, setW] = useState(0);
    useEffect(() => {
        const t = setTimeout(() => setW(value), 80 + delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return (
        <div className="h-[5px] w-full bg-slate-100 rounded-full overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-[800ms] ease-out ${color}`}
                style={{ width: `${w}%` }}
            />
        </div>
    );
}

export default function ProjectsPage() {
    const [projects, setProjects] = useState<Project[]>(defaultProjects);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ title: "", client: "" });
    const [search, setSearch] = useState("");
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const filtered = projects.filter(
        (p) => p.title.includes(search) || p.id.includes(search) || p.client.includes(search)
    );

    const handleAdd = () => {
        if (!form.title.trim()) return;
        const newId = generateId();
        setProjects([{
            id: newId, title: form.title.trim(), client: form.client.trim() || "未指定",
            status: "準備中", prog: 0, targetProg: 0, pay: 0, color: "gray", isNew: true,
        }, ...projects]);
        setForm({ title: "", client: "" });
        setShowModal(false);
    };

    return (
        <div className="flex h-screen overflow-hidden bg-[#f8f9fb]">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* Topbar — very compact */}
                <header className="bg-white/80 backdrop-blur-lg sticky top-0 z-40 border-b border-slate-100"
                    style={{ animation: mounted ? "slide-down .3s ease-out both" : "none" }}>
                    <div className="max-w-[1600px] mx-auto px-4 h-10 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="material-icons-round text-[#1565C0] text-lg">grid_view</span>
                            <span className="text-[13px] text-slate-700 tracking-tight">工程專案總覽</span>
                            <span className="text-[11px] text-slate-400">{filtered.length} 件</span>
                        </div>
                        <div className="flex-1 max-w-sm relative hidden md:block">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-icons-round text-slate-300 text-base">search</span>
                            <input value={search} onChange={(e) => setSearch(e.target.value)}
                                className="w-full h-7 pl-8 pr-3 bg-slate-50 rounded-md text-[12px] outline-none border border-transparent focus:border-[#1565C0]/20 focus:bg-white text-slate-600 placeholder:text-slate-300 transition-all"
                                placeholder="搜尋編號、案名或機關…" />
                        </div>
                        <button onClick={() => setShowModal(true)}
                            className="flex items-center gap-1 h-7 px-3 rounded-md bg-[#1565C0] text-white text-[11px] font-medium shadow-sm shadow-[#1565C0]/20 hover:shadow-md hover:shadow-[#1565C0]/30 hover:-translate-y-px active:translate-y-0 transition-all">
                            <span className="material-icons-round text-sm">add</span>新增工程
                        </button>
                    </div>
                </header>

                {/* Card Grid */}
                <main className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="max-w-[1600px] mx-auto px-4 py-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5">
                            {filtered.map((p, i) => {
                                const s = statusStyle[p.color] || statusStyle.gray;
                                const diff = p.prog - p.targetProg;
                                const href = p.isNew ? `/projects/${p.id}/setup` : `/projects/${p.id}/dashboard`;

                                return (
                                    <Link key={p.id} href={href}
                                        className="group relative bg-white rounded-xl border border-slate-100 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-0.5 hover:border-slate-200"
                                        style={{
                                            opacity: mounted ? 1 : 0,
                                            transform: mounted ? "translateY(0)" : "translateY(12px)",
                                            transition: `opacity .4s ease ${i * 0.06}s, transform .4s ease ${i * 0.06}s, box-shadow .3s, border-color .3s`,
                                        }}>

                                        {/* Accent line */}
                                        <div className={`h-[3px] w-full bg-gradient-to-r ${accentLine[p.color] || accentLine.gray}`} />

                                        <div className="px-3.5 pt-2 pb-2.5">

                                            {/* === TOP: ID + Name === */}
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-[10px] font-mono text-slate-400 tracking-wide">{p.id}</span>
                                            </div>
                                            <h3 className="text-[13px] text-slate-700 font-medium leading-snug line-clamp-1 group-hover:text-[#1565C0] transition-colors duration-200">{p.title}</h3>

                                            {/* === MIDDLE: Progress bars === */}
                                            <div className="mt-2.5 mb-2 space-y-1.5">
                                                {/* Construction progress */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-[3px]">
                                                        <span className="text-[9px] text-slate-400 uppercase tracking-wider">施工進度</span>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[10px] text-slate-300">預{p.targetProg}%</span>
                                                            <span className="text-[10px] text-slate-300">·</span>
                                                            <span className="text-[10px] text-[#1565C0]">實{p.prog}%</span>
                                                            {p.targetProg > 0 && (
                                                                <span className={`text-[9px] px-1 py-px rounded ${diff >= 0 ? "bg-emerald-50 text-emerald-500" : "bg-rose-50 text-rose-500"}`}>
                                                                    {diff >= 0 ? "+" : ""}{diff}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Layered bar: target=lighter, actual=solid */}
                                                    <div className="relative h-[5px] w-full bg-slate-100 rounded-full overflow-hidden">
                                                        {p.targetProg > 0 && (
                                                            <div className="absolute top-0 h-full bg-slate-200 rounded-full transition-all duration-1000 ease-out"
                                                                style={{ width: mounted ? `${p.targetProg}%` : 0 }} />
                                                        )}
                                                        <div className="absolute top-0 h-full bg-[#1565C0] rounded-full transition-all duration-1000 ease-out"
                                                            style={{ width: mounted ? `${p.prog}%` : 0, transitionDelay: '0.2s' }} />
                                                    </div>
                                                </div>

                                                {/* Payment progress */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-[3px]">
                                                        <span className="text-[9px] text-slate-400 uppercase tracking-wider">請款進度</span>
                                                        <span className="text-[10px] text-slate-400">{p.pay}%</span>
                                                    </div>
                                                    <AnimatedBar value={p.pay} color="bg-slate-300" delay={300} />
                                                </div>
                                            </div>

                                            {/* === BOTTOM: Client + Status === */}
                                            <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-slate-50/80">
                                                <div className="flex items-center gap-1">
                                                    <span className="material-icons-outlined text-[13px] text-slate-300">domain</span>
                                                    <span className="text-[10px] text-slate-400">{p.client}</span>
                                                </div>
                                                <div className={`flex items-center gap-1 px-1.5 py-[2px] rounded ${s.bg}`}>
                                                    <div className={`w-[5px] h-[5px] rounded-full ${s.dot}`} />
                                                    <span className={`text-[9px] ${s.text}`}>{p.status}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Hover glow */}
                                        <div className="absolute inset-0 bg-gradient-to-b from-[#1565C0]/0 to-[#1565C0]/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </main>
            </div>

            {/* Add Project Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] animate-backdrop" onClick={() => setShowModal(false)} />
                    <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl shadow-slate-300/40 animate-modal overflow-hidden border border-slate-100">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-50">
                            <span className="text-[13px] text-slate-600 flex items-center gap-1.5">
                                <span className="material-icons-round text-[#1565C0] text-lg">add_circle</span>新增工程專案
                            </span>
                            <button onClick={() => setShowModal(false)} className="text-slate-300 hover:text-slate-500 transition-colors">
                                <span className="material-icons-round text-lg">close</span>
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">工程名稱</label>
                                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[13px] outline-none focus:border-[#1565C0]/30 focus:bg-white text-slate-600 placeholder:text-slate-300 transition-all"
                                    placeholder="北區污水下水道工程第三標" autoFocus />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">業主 / 機關</label>
                                <input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[13px] outline-none focus:border-[#1565C0]/30 focus:bg-white text-slate-600 placeholder:text-slate-300 transition-all"
                                    placeholder="台北市政府工務局" />
                            </div>
                        </div>
                        <div className="flex gap-2 px-5 py-3 border-t border-slate-50 bg-slate-50/50">
                            <button onClick={() => setShowModal(false)} className="flex-1 px-3 py-2 rounded-lg border border-slate-100 text-[12px] text-slate-400 hover:bg-white transition-colors">取消</button>
                            <button onClick={handleAdd} disabled={!form.title.trim()}
                                className="flex-1 px-3 py-2 rounded-lg bg-[#1565C0] text-white text-[12px] shadow-sm shadow-[#1565C0]/20 disabled:opacity-30 hover:shadow-md transition-all">建立專案</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
