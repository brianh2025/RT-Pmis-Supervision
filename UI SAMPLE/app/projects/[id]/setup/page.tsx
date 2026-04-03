"use client";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { use } from "react";

export default function ProjectSetup({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);

    const [form, setForm] = useState({
        name: "", client: "", contractor: "", contractAmount: "", startDate: "", endDate: "",
        address: "", manager: "", phone: "",
    });

    const fields = [
        { key: "name", label: "工程名稱", placeholder: "例: 北區污水下水道工程第三標", span: 2 },
        { key: "client", label: "業主 / 機關", placeholder: "台北市政府工務局" },
        { key: "contractor", label: "承攬廠商", placeholder: "XX營造有限公司" },
        { key: "contractAmount", label: "契約金額 (元)", placeholder: "256,980,000", type: "text" },
        { key: "address", label: "工地地址", placeholder: "台北市中山區…" },
        { key: "startDate", label: "開工日期", type: "date" },
        { key: "endDate", label: "預定竣工日", type: "date" },
        { key: "manager", label: "工地主任", placeholder: "王大明" },
        { key: "phone", label: "聯絡電話", placeholder: "02-2345-6789" },
    ];

    return (
        <div className="flex h-screen overflow-hidden bg-[#f8f9fb]">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white/80 backdrop-blur-lg sticky top-0 z-40 border-b border-slate-100">
                    <div className="max-w-[900px] mx-auto px-5 h-11 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Link href="/projects" className="text-slate-300 hover:text-slate-500 transition-colors">
                                <span className="material-icons-round text-lg">arrow_back</span>
                            </Link>
                            <span className="text-[13px] text-slate-700">基本資料維護</span>
                            <span className="text-[10px] font-mono text-slate-400">{id}</span>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="max-w-[900px] mx-auto px-5 py-6">
                        <div className="bg-white rounded-xl border border-slate-100 p-6" style={{ animation: "slide-up .4s ease both" }}>
                            <div className="flex items-center gap-2 mb-5">
                                <span className="material-icons-round text-[#1565C0] text-lg">edit_note</span>
                                <span className="text-[13px] text-slate-600">請填寫工程基本資料</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                                {fields.map((f, i) => (
                                    <div key={f.key} className={f.span === 2 ? "md:col-span-2" : ""}
                                        style={{ opacity: 0, animation: `slide-up .3s ease ${i * 0.04}s both` }}>
                                        <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">{f.label}</label>
                                        <input
                                            type={f.type || "text"}
                                            value={form[f.key as keyof typeof form]}
                                            onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[13px] outline-none focus:border-[#1565C0]/30 focus:bg-white text-slate-600 placeholder:text-slate-300 transition-all"
                                            placeholder={f.placeholder || ""}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-50">
                                <Link href="/projects" className="px-4 py-2 rounded-lg border border-slate-100 text-[12px] text-slate-400 hover:bg-slate-50 transition-colors">取消</Link>
                                <Link href={`/projects/${id}/dashboard`}
                                    className="px-4 py-2 rounded-lg bg-[#1565C0] text-white text-[12px] shadow-sm shadow-[#1565C0]/20 hover:shadow-md transition-all">
                                    儲存並進入儀表板
                                </Link>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
