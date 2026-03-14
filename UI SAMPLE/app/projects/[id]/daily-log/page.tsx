import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { getProject } from "@/lib/mock-data";

// Simulated imported log data (keyed by YYYY-MM-DD)
const importedData: Record<string, { weather: string; summary: string; tags: string[]; progress: number }> = {
    "2025-01-15": { weather: "晴", summary: "進行基礎開挖第一層，深度達 EL-3.0m。現場 12 人。", tags: ["基礎開挖"], progress: 30 },
    "2025-01-16": { weather: "晴時多雲", summary: "繼續基礎開挖，鋼筋進場檢驗合格。", tags: ["基礎開挖", "鋼筋進場"], progress: 32 },
    "2025-01-17": { weather: "多雲", summary: "基礎開挖第二層完成，開始放樣作業。", tags: ["開挖", "放樣"], progress: 34 },
    "2025-01-20": { weather: "晴", summary: "鋼筋綁紮第一區段，現場 15 人。", tags: ["鋼筋綁紮"], progress: 36 },
    "2025-01-21": { weather: "晴", summary: "鋼筋綁紮第二區段，隱蔽前會勘完成。", tags: ["鋼筋綁紮", "會勘"], progress: 38 },
    "2025-01-22": { weather: "晴", summary: "整地及環境整理。", tags: ["整地"], progress: 38 },
    "2025-01-23": { weather: "多雲", summary: "鋼筋綁紮持續，第三區段作業中。", tags: ["鋼筋綁紮"], progress: 41 },
    "2025-01-24": { weather: "晴時多雲", summary: "基礎開挖第三層完成，深度達 EL-9.5m。鋼筋綁紮同步進行。現場 18 人。", tags: ["基礎開挖", "鋼筋綁紮"], progress: 43 },
    "2025-02-03": { weather: "晴", summary: "收假復工，進行模板組立第一區段。", tags: ["模板組立"], progress: 44 },
    "2025-02-04": { weather: "陰", summary: "模板組立持續，鋼筋查核。", tags: ["模板組立"], progress: 45 },
    "2025-02-05": { weather: "晴", summary: "混凝土澆置基礎第一區段。", tags: ["混凝土澆置"], progress: 47 },
    "2025-03-03": { weather: "晴", summary: "二樓結構柱鋼筋綁紮。", tags: ["鋼筋綁紮"], progress: 52 },
    "2025-03-04": { weather: "多雲", summary: "二樓樑模板組立作業。", tags: ["模板組立"], progress: 53 },
    "2025-03-05": { weather: "晴", summary: "二樓版模板及鋼筋綁紮。現場 20 人，無安全事故。", tags: ["模板", "鋼筋"], progress: 54 },
};

const dowHeaders = ["日", "一", "二", "三", "四", "五", "六"];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDow(y: number, m: number) { return new Date(y, m, 1).getDay(); }
function toKey(y: number, m: number, d: number) {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function toRoc(y: number, m: number, d: number) {
    return `${y - 1911}.${String(m + 1).padStart(2, "0")}.${String(d).padStart(2, "0")}`;
}

export default function ProjectDailyLog({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const p = getProject(id);
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2500);
    };

    const daysInMonth = useMemo(() => getDaysInMonth(year, month), [year, month]);
    const firstDow = useMemo(() => getFirstDow(year, month), [year, month]);
    const todayKey = toKey(today.getFullYear(), today.getMonth(), today.getDate());

    const prevMonth = () => { if (month === 0) { setYear(year - 1); setMonth(11); } else setMonth(month - 1); setSelectedDay(null); };
    const nextMonth = () => { if (month === 11) { setYear(year + 1); setMonth(0); } else setMonth(month + 1); setSelectedDay(null); };

    const selectedKey = selectedDay ? toKey(year, month, selectedDay) : null;
    const selectedData = selectedKey ? importedData[selectedKey] : null;
    const importedCount = Array.from({ length: daysInMonth }, (_, i) => toKey(year, month, i + 1)).filter(k => importedData[k]).length;

    return (
        <div className="flex h-screen overflow-hidden bg-[#f8f9fb]">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* Header */}
                <header className="bg-white/80 backdrop-blur-lg sticky top-0 z-40 border-b border-slate-100"
                    style={{ animation: "slide-down .3s ease both" }}>
                    <div className="max-w-[1200px] mx-auto px-5 h-11 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Link href={`/projects/${id}/dashboard`}
                                className="text-slate-300 hover:text-slate-500 transition-colors">
                                <span className="material-icons-round text-lg">arrow_back</span>
                            </Link>
                            <span className="text-[13px] text-slate-700 flex items-center gap-1.5">
                                <span className="material-icons-round text-[#1565C0] text-base">assignment</span>
                                {p.title} - 施工日誌
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded ml-2">{id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-md">{importedCount} 筆已匯入</span>
                            <button
                                onClick={() => showToast("匯入功能將透過 Google Drive 同步，請確認共用資料夾設定。")}
                                className="flex items-center gap-1 h-7 px-3 rounded-md bg-[#1565C0] text-white text-[11px] font-medium shadow-sm hover:shadow-md hover:-translate-y-px transition-all"
                            >
                                <span className="material-icons-round text-sm">cloud_download</span>
                                同步匯入
                            </button>
                        </div>
                    </div>
                </header>

                {/* Toast */}
                {toast && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg"
                        style={{ animation: "slide-up .25s ease both" }}>
                        {toast}
                    </div>
                )}

                <main className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="max-w-[1200px] mx-auto px-5 py-5">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                            {/* Left: Calendar */}
                            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-100 p-5" style={{ animation: "slide-up .4s ease both" }}>
                                <div className="flex items-center justify-between mb-4">
                                    <button onClick={prevMonth} className="size-7 rounded-lg hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                                        <span className="material-icons-round text-lg">chevron_left</span>
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <select value={year} onChange={e => { setYear(Number(e.target.value)); setSelectedDay(null); }}
                                            className="text-[13px] text-slate-600 bg-transparent outline-none cursor-pointer px-1 border-b border-transparent hover:border-slate-200 transition-colors">
                                            {Array.from({ length: 10 }, (_, i) => 2020 + i).map(y => <option key={y} value={y}>{y - 1911} 年 ({y})</option>)}
                                        </select>
                                        <select value={month} onChange={e => { setMonth(Number(e.target.value)); setSelectedDay(null); }}
                                            className="text-[13px] text-slate-600 bg-transparent outline-none cursor-pointer px-1 border-b border-transparent hover:border-slate-200 transition-colors">
                                            {Array.from({ length: 12 }, (_, i) => i).map(m => <option key={m} value={m}>{m + 1} 月</option>)}
                                        </select>
                                    </div>
                                    <button onClick={nextMonth} className="size-7 rounded-lg hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                                        <span className="material-icons-round text-lg">chevron_right</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-7 mb-1">
                                    {dowHeaders.map(d => (<div key={d} className="text-center text-[10px] text-slate-400 py-1">{d}</div>))}
                                </div>

                                <div className="grid grid-cols-7 gap-[2px]">
                                    {Array.from({ length: firstDow }).map((_, i) => <div key={`b${i}`} className="aspect-square" />)}
                                    {Array.from({ length: daysInMonth }, (_, i) => {
                                        const day = i + 1;
                                        const key = toKey(year, month, day);
                                        const isToday = key === todayKey;
                                        const isFuture = new Date(year, month, day) > today;
                                        const hasData = !!importedData[key];
                                        const isSelected = selectedDay === day;
                                        const isSun = new Date(year, month, day).getDay() === 0;
                                        const isSat = new Date(year, month, day).getDay() === 6;
                                        return (
                                            <button key={day} disabled={isFuture} onClick={() => setSelectedDay(isSelected ? null : day)}
                                                className={`aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all duration-200 text-[12px] group
                          ${isFuture ? "text-slate-200 cursor-not-allowed" : "cursor-pointer hover:bg-slate-50"}
                          ${isSelected ? "ring-1 ring-[#1565C0]/40 bg-blue-50/30" : ""}
                          ${isToday && !isSelected ? "bg-slate-50" : ""}
                          ${isSun ? "text-rose-400" : isSat ? "text-sky-400" : "text-slate-500"}
                        `}
                                                style={{ animation: `fade-in .2s ease ${(firstDow + i) * 0.01}s both` }}
                                            >
                                                <span className={isToday ? "text-[#1565C0]" : ""}>{day}</span>
                                                {!isFuture && (<div className={`w-[5px] h-[5px] rounded-full mt-0.5 transition-colors ${hasData ? "bg-emerald-400" : "bg-slate-200"}`} />)}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-50 text-[10px] text-slate-400">
                                    <span className="flex items-center gap-1"><span className="w-[6px] h-[6px] rounded-full bg-emerald-400" />已匯入</span>
                                    <span className="flex items-center gap-1"><span className="w-[6px] h-[6px] rounded-full bg-slate-200" />未匯入</span>
                                    <span className="flex items-center gap-1"><span className="w-[6px] h-[6px] rounded-full bg-[#1565C0]" />今天</span>
                                </div>
                            </div>

                            {/* Right: Detail panel */}
                            <div className="lg:col-span-5" style={{ animation: "slide-up .4s ease .1s both" }}>
                                {selectedDay && selectedKey ? (
                                    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden" style={{ animation: "scale-in .3s ease both" }}>
                                        <div className="px-5 py-3 border-b border-slate-50 flex items-center justify-between">
                                            <span className="text-[13px] text-slate-600">{toRoc(year, month, selectedDay)}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-md ${selectedData ? "bg-emerald-50 text-emerald-500" : "bg-slate-50 text-slate-400"}`}>
                                                {selectedData ? "已匯入" : "廠商尚未提送"}
                                            </span>
                                        </div>
                                        {selectedData ? (
                                            <div className="p-5 space-y-4">
                                                <div className="flex items-center gap-3 text-[12px]">
                                                    <span className="material-icons-round text-amber-400 text-base">sunny</span>
                                                    <span className="text-slate-500">{selectedData.weather}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {selectedData.tags.map((t, j) => (
                                                        <span key={j} className="px-1.5 py-0.5 bg-blue-50 text-[#1565C0] rounded text-[10px] border border-blue-100">{t}</span>
                                                    ))}
                                                </div>
                                                <p className="text-[12px] text-slate-500 leading-relaxed">{selectedData.summary}</p>
                                                <div>
                                                    <div className="flex justify-between mb-1 text-[10px]">
                                                        <span className="text-slate-400">累計施工進度</span>
                                                        <span className="text-emerald-500">{selectedData.progress}%</span>
                                                    </div>
                                                    <div className="h-[5px] bg-slate-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-emerald-400 rounded-full transition-all duration-700" style={{ width: `${selectedData.progress}%` }} />
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 pt-3 border-t border-slate-50">
                                                    <button
                                                        onClick={() => showToast("PDF 報告產出功能開發中，請稍後。")}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 rounded-md text-[10px] text-slate-500 hover:bg-slate-100 active:scale-95 transition-all">
                                                        <span className="material-icons-round text-sm">picture_as_pdf</span>產出報告
                                                    </button>
                                                    <button
                                                        onClick={() => showToast(`正在開啟 ${toRoc(year, month, selectedDay)} 日誌編輯介面…`)}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 rounded-md text-[10px] text-slate-500 hover:bg-slate-100 active:scale-95 transition-all">
                                                        <span className="material-icons-round text-sm">edit</span>編輯
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-8 text-center">
                                                <span className="material-icons-round text-slate-200 text-4xl mb-2 block">cloud_off</span>
                                                <p className="text-[12px] text-slate-400 mb-1">廠商尚未提送</p>
                                                <p className="text-[10px] text-slate-300">系統將自動從共用雲端硬碟抓取包含此日期的 Excel 檔案</p>
                                                <button
                                                    onClick={() => showToast("已手動觸發同步，請稍候…")}
                                                    className="mt-4 flex items-center gap-1 mx-auto px-3 py-1.5 bg-[#1565C0]/10 text-[#1565C0] rounded-md text-[10px] hover:bg-[#1565C0]/20 transition-colors">
                                                    <span className="material-icons-round text-sm">refresh</span>手動同步
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-xl border border-slate-100 p-8 text-center" style={{ animation: "fade-in .3s ease both" }}>
                                        <span className="material-icons-round text-slate-200 text-4xl mb-2 block">calendar_month</span>
                                        <p className="text-[12px] text-slate-400">點選左方日期查看日誌內容</p>
                                    </div>
                                )}

                                {/* Month summary */}
                                <div className="bg-white rounded-xl border border-slate-100 p-4 mt-3" style={{ animation: "slide-up .4s ease .15s both" }}>
                                    <span className="text-[11px] text-slate-500 block mb-3">本月匯入統計</span>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="text-center">
                                            <span className="text-xl text-emerald-500">{importedCount}</span>
                                            <span className="block text-[9px] text-slate-400 mt-0.5">已匯入</span>
                                        </div>
                                        <div className="text-center">
                                            <span className="text-xl text-slate-400">
                                                {(() => {
                                                    let c = 0;
                                                    for (let d = 1; d <= daysInMonth; d++) {
                                                        const dt = new Date(year, month, d);
                                                        if (dt <= today && !importedData[toKey(year, month, d)] && dt.getDay() !== 0 && dt.getDay() !== 6) c++;
                                                    }
                                                    return c;
                                                })()}
                                            </span>
                                            <span className="block text-[9px] text-slate-400 mt-0.5">未匯入</span>
                                        </div>
                                        <div className="text-center">
                                            <span className="text-xl text-slate-300">
                                                {(() => { let c = 0; for (let d = 1; d <= daysInMonth; d++) { if (new Date(year, month, d) > today) c++; } return c; })()}
                                            </span>
                                            <span className="block text-[9px] text-slate-400 mt-0.5">未到日期</span>
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
