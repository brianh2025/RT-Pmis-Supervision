import { useState, useEffect } from "react";

// ─── FONTS ────────────────────────────────────────────────────────────────────
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap";

// ─── GLOBAL RESPONSIVE CSS ────────────────────────────────────────────────────
const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; font-family: 'Noto Sans TC','Microsoft JhengHei',sans-serif; background: #f1f5f9; }
  input, select, textarea, button { font-family: inherit; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
  ::-webkit-scrollbar-track { background: transparent; }

  /* ── Layout ── */
  .pmis-app         { display: flex; min-height: 100vh; }
  .pmis-sidebar-col { width: 265px; flex-shrink: 0; position: fixed; top: 0; left: 0; bottom: 0; z-index: 100; }
  .pmis-main        { margin-left: 265px; flex: 1; min-width: 0; min-height: 100vh; background: #f1f5f9; }
  .pmis-main-full   { flex: 1; min-width: 0; min-height: 100vh; background: #f1f5f9; }

  /* ── Content container ── */
  .pmis-container { max-width: 1200px; margin: 0 auto; padding: 20px 28px; }
  .pmis-container-sm { max-width: 760px; margin: 0 auto; padding: 20px 28px; }

  /* ── Grids ── */
  .g-3col     { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .g-4col     { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .g-2col     { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .g-2col-sm  { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .g-dash     { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .g-qty      { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .g-qty3     { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .g-form2    { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

  /* ── TopBar title ── */
  .topbar-title { font-size: 14px; font-weight: 700; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60vw; }

  /* ── Daily form bottom nav ── */
  .daily-bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top: 1px solid #e2e8f0; padding: 12px 16px; display: flex; gap: 10px; z-index: 50; }

  /* ═══════════════ TABLET 768–1199px ═══════════════ */
  @media (min-width: 768px) and (max-width: 1199px) {
    .pmis-container    { padding: 18px 24px; }
    .pmis-container-sm { padding: 18px 24px; }
    .topbar-title { max-width: 50vw; font-size: 15px; }
    .g-4col  { grid-template-columns: 1fr 1fr; }
  }

  /* ═══════════════ DESKTOP ≥1200px ═══════════════ */
  @media (min-width: 1200px) {
    .pmis-container    { padding: 24px 36px; }
    .pmis-container-sm { padding: 24px 36px; }
    .topbar-title { max-width: 500px; font-size: 16px; }
    .g-dash  { grid-template-columns: 1fr 1fr; gap: 18px; }
    .daily-bottom-nav { left: 265px; padding: 14px 36px; }
    .g-4col  { grid-template-columns: repeat(4, 1fr); }
  }

  /* ═══════════════ MOBILE <768px ═══════════════ */
  @media (max-width: 767px) {
    .pmis-container    { padding: 14px 16px; }
    .pmis-container-sm { padding: 14px 16px; }
    .topbar-title { max-width: 55vw; font-size: 14px; }
    .g-3col     { grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    .g-4col     { grid-template-columns: 1fr 1fr; gap: 8px; }
    .g-2col     { grid-template-columns: 1fr 1fr; gap: 10px; }
    .g-2col-sm  { grid-template-columns: 1fr 1fr; gap: 6px; }
    .g-dash     { grid-template-columns: 1fr; gap: 12px; }
    .g-qty      { grid-template-columns: repeat(4, 1fr); gap: 5px; }
    .g-qty3     { grid-template-columns: repeat(3, 1fr); gap: 5px; }
    .g-form2    { grid-template-columns: 1fr 1fr; gap: 8px; }
  }

  /* ═══════════════ VERY SMALL <380px ═══════════════ */
  @media (max-width: 379px) {
    .g-3col     { grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .g-4col     { grid-template-columns: 1fr 1fr; gap: 6px; }
    .g-qty      { grid-template-columns: 1fr 1fr; gap: 5px; }
    .g-qty3     { grid-template-columns: 1fr 1fr; gap: 5px; }
    .g-form2    { grid-template-columns: 1fr; gap: 8px; }
  }

  /* Projects list: 2-col on md+ */
  @media (min-width: 640px) {
    .g-proj-list  { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .g-daily-list { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  }
  @media (max-width: 639px) {
    .g-proj-list  { display: grid; grid-template-columns: 1fr; gap: 12px; }
    .g-daily-list { display: grid; grid-template-columns: 1fr; gap: 10px; }
  }
  @media (min-width: 1200px) {
    .g-proj-list  { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .g-daily-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  }

  /* Tablet KPI: 4-col */
  @media (min-width: 768px) {
    .g-kpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  }
  @media (max-width: 767px) {
    .g-kpi { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  }

  /* Animations */
  @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  .fade-up { animation: fadeUp .3s ease both; }

  /* Tab scroll */
  .tab-scroll { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
  .tab-scroll::-webkit-scrollbar { display: none; }

  /* Hover states */
  .card-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.1) !important; }
  .card-btn { transition: transform .15s, box-shadow .15s; }

  /* Form inputs focus */
  .pmis-input:focus { border-color: #1a56db !important; box-shadow: 0 0 0 3px rgba(26,86,219,0.12); outline: none; }
`;

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
    primary: "#1a56db", primaryDark: "#1340a8", primaryLight: "#e8f0fd",
    success: "#059669", successLight: "#d1fae5",
    danger: "#dc2626", dangerLight: "#fee2e2",
    warn: "#d97706", warnLight: "#fef3c7",
    blue: "#2563eb", blueLight: "#eff6ff",
    text: "#0f172a", textMid: "#475569", textMuted: "#94a3b8",
    border: "#e2e8f0", bg: "#f1f5f9", card: "#ffffff",
    sidebar: "#0f172a",
};

// ─── HOOKS ────────────────────────────────────────────────────────────────────
function useWindowWidth() {
    const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
    useEffect(() => {
        const fn = () => setW(window.innerWidth);
        window.addEventListener("resize", fn);
        return () => window.removeEventListener("resize", fn);
    }, []);
    return w;
}

// ─── INITIAL DATA ─────────────────────────────────────────────────────────────
const INIT_PROJECTS = [
    {
        id: 1, name: "台北市北投區石牌路施工工程", shortName: "石牌路施工工程",
        location: "台北市北投區", contractNo: "1141A10089", contractAmount: 215.5,
        actualProgress: 16.2, plannedProgress: 15.5, billingProgress: 12.5,
        startDate: "2024-06-01", endDate: "2025-05-30", remainDays: 79,
        status: "施工中", anomalies: 1, owner: "台北市政府工務局", supervisorName: "林工程師",
        submissions: {
            construction: { total: 8, approved: 5, reviewing: 2, pending: 1 },
            material: { total: 18, approved: 12, reviewing: 4, pending: 2 },
        },
        tests: [
            { name: "混凝土抗壓試驗", date: "03/01", result: "合格" },
            { name: "鋼筋拉伸試驗", date: "03/05", result: "合格" },
            { name: "瀝青混凝土密度試驗", date: "03/08", result: "合格" },
        ],
        ncr: [{ id: 1, desc: "模板支撐不足，需補強", status: "待處理", date: "03/02" }],
        billing: [
            { period: "第1期", amount: 15.2, date: "2024-08-01", status: "已核准" },
            { period: "第2期", amount: 12.5, date: "2024-10-01", status: "審查中" },
        ],
        dailyReports: [
            {
                id: 1, date: "2026-03-05", reportNo: "114-001", weather: "晴",
                tempHigh: 26, tempLow: 18, supervisor: "林工程師", contractor: "台灣營造股份有限公司",
                plannedProgress: 15.5, actualProgress: 16.2,
                progressNote: "本日進度正常，較預定進度超前0.7%，施工人員工作效率良好。",
                quantities: [
                    { item: "PC路面鋪設", unit: "m²", contractQty: 2500, todayQty: 80, cumQty: 520, note: "" },
                    { item: "側溝施作", unit: "m", contractQty: 800, todayQty: 25, cumQty: 210, note: "" },
                    { item: "人孔蓋安裝", unit: "座", contractQty: 12, todayQty: 0, cumQty: 5, note: "待材料到場" },
                ],
                inspections: [
                    { no: "QC-001", item: "模板組立檢查", result: "合格", note: "尺寸符合設計圖說" },
                    { no: "QC-002", item: "鋼筋排列檢查", result: "合格", note: "間距符合規定" },
                ],
                qualityTests: [
                    { material: "預拌混凝土", contractQty: "500m³", doneQty: "120m³", testItem: "坍度試驗", result: "合格", note: "坍度8cm" },
                    { material: "鋼筋", contractQty: "50t", doneQty: "15t", testItem: "拉伸試驗", result: "合格", note: "" },
                ],
                documents: [
                    { type: "業主公文", no: "北工字第1130001234號", subject: "工程變更通知", date: "2026-03-04", note: "" },
                    { type: "會議紀錄", no: "工程會議-003", subject: "第三次工程協調會議", date: "2026-03-05", note: "廠商提出展延申請" },
                ],
                specialNote: "今日施工人數32人，機具運作正常。廠商申請第一期工程展延7天，已轉呈業主審核。",
            },
            {
                id: 2, date: "2026-03-10", reportNo: "114-002", weather: "多雲",
                tempHigh: 23, tempLow: 16, supervisor: "林工程師", contractor: "台灣營造股份有限公司",
                plannedProgress: 15.8, actualProgress: 16.5,
                progressNote: "持續超前進度，混凝土澆置作業順利完成。",
                quantities: [{ item: "PC路面鋪設", unit: "m²", contractQty: 2500, todayQty: 95, cumQty: 615, note: "" }],
                inspections: [{ no: "QC-003", item: "混凝土澆置品質", result: "合格", note: "坍度符合規定" }],
                qualityTests: [{ material: "預拌混凝土", contractQty: "500m³", doneQty: "145m³", testItem: "抗壓試驗", result: "合格", note: "28天強度達設計值" }],
                documents: [], specialNote: "",
            },
        ],
    },
    {
        id: 2, name: "新北市板橋區民生路道路改善工程", shortName: "民生路道路改善工程",
        location: "新北市板橋區", contractNo: "1141A10090", contractAmount: 85.2,
        actualProgress: 5.4, plannedProgress: 8.0, billingProgress: 0.0,
        startDate: "2024-09-01", endDate: "2025-08-31", remainDays: 172,
        status: "落後", anomalies: 2, owner: "新北市政府工務局", supervisorName: "陳工程師",
        submissions: {
            construction: { total: 6, approved: 3, reviewing: 2, pending: 1 },
            material: { total: 12, approved: 7, reviewing: 3, pending: 2 },
        },
        tests: [
            { name: "混凝土抗壓試驗", date: "02/20", result: "合格" },
            { name: "土壤夯實試驗", date: "02/28", result: "不合格" },
        ],
        ncr: [
            { id: 1, desc: "施工縫處理不當", status: "處理中", date: "02/15" },
            { id: 2, desc: "土方回填夯實不足", status: "待處理", date: "03/01" },
        ],
        billing: [{ period: "第1期", amount: 0, date: "-", status: "未申請" }],
        dailyReports: [],
    },
    {
        id: 3, name: "桃園市中壢區環南路人行道改善工程", shortName: "環南路人行道改善工程",
        location: "桃園市中壢區", contractNo: "1141B20015", contractAmount: 42.8,
        actualProgress: 68.5, plannedProgress: 65.0, billingProgress: 55.0,
        startDate: "2024-03-01", endDate: "2025-04-30", remainDays: 49,
        status: "施工中", anomalies: 0, owner: "桃園市政府工務局", supervisorName: "王工程師",
        submissions: {
            construction: { total: 10, approved: 9, reviewing: 1, pending: 0 },
            material: { total: 20, approved: 18, reviewing: 2, pending: 0 },
        },
        tests: [
            { name: "鋪面平整度試驗", date: "03/06", result: "合格" },
            { name: "側溝施作品質", date: "03/09", result: "合格" },
        ],
        ncr: [],
        billing: [
            { period: "第1期", amount: 8.5, date: "2024-06-01", status: "已核准" },
            { period: "第2期", amount: 12.0, date: "2024-09-01", status: "已核准" },
            { period: "第3期", amount: 14.0, date: "2024-12-01", status: "已核准" },
        ],
        dailyReports: [],
    },
];

const WEATHER_OPTIONS = ["晴", "多雲", "陰", "小雨", "中雨", "大雨", "颱風"];
const DOC_TYPES = ["業主公文", "廠商公文", "會議紀錄", "督導查核", "交辦事項", "其他"];
const weatherIcon = { "晴": "☀️", "多雲": "⛅", "陰": "☁️", "小雨": "🌦️", "中雨": "🌧️", "大雨": "⛈️", "颱風": "🌀" };
const today = () => new Date().toISOString().split("T")[0];
const thisMonth = () => new Date().toISOString().slice(0, 7);

// ─── ICONS ────────────────────────────────────────────────────────────────────
const I = {
    menu: (c = "currentColor") => <svg width="20" height="20" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>,
    back: (c = "currentColor") => <svg width="20" height="20" fill="none" stroke={c} strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>,
    plus: (c = "currentColor", s = 16) => <svg width={s} height={s} fill="none" stroke={c} strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
    trash: (c = "#ef4444") => <svg width="15" height="15" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>,
    edit: (c = "currentColor") => <svg width="15" height="15" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
    check: (c = "#059669") => <svg width="14" height="14" fill="none" stroke={c} strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>,
    chev: (c = "#94a3b8", s = 16) => <svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>,
    logout: () => <svg width="16" height="16" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
    grid: (c = "currentColor") => <svg width="17" height="17" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
    report: (c = "currentColor") => <svg width="17" height="17" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
    billing: (c = "currentColor") => <svg width="17" height="17" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>,
    data: (c = "currentColor") => <svg width="17" height="17" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3S3 13.66 3 12" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>,
    submit: (c = "currentColor") => <svg width="17" height="17" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
    shield: (c = "currentColor") => <svg width="17" height="17" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
    chart: (c = "currentColor") => <svg width="16" height="16" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" /></svg>,
    flask: (c = "currentColor") => <svg width="16" height="16" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M6 2v6l-4 8a2 2 0 001.8 3h12.4A2 2 0 0018 16L14 8V2" /><line x1="6" y1="2" x2="18" y2="2" /></svg>,
    alert: (c = "#dc2626") => <svg width="16" height="16" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
    cal: (c = "currentColor") => <svg width="13" height="13" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
    trend: (c = "#059669") => <svg width="16" height="16" fill="none" stroke={c} strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>,
    clock: (c = "#d97706") => <svg width="16" height="16" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
    book: (c = "#2563eb") => <svg width="16" height="16" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>,
    ncr: (c = "#dc2626") => <svg width="16" height="16" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>,
    loc: (c = "#64748b") => <svg width="11" height="11" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>,
    sync: (c = "#059669") => <svg width="13" height="13" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg>,
    doc: (c = "currentColor") => <svg width="16" height="16" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
};

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
const Badge = ({ label, variant = "default" }) => {
    const vs = {
        default: { bg: "#f1f5f9", color: "#475569" },
        success: { bg: C.successLight, color: C.success },
        danger: { bg: C.dangerLight, color: C.danger },
        warn: { bg: C.warnLight, color: C.warn },
        blue: { bg: C.blueLight, color: C.blue },
        dark: { bg: "#1e293b", color: "#fff" },
    };
    const s = vs[variant] || vs.default;
    return <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 99, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>{label}</span>;
};

const ProgressBar = ({ value, planned, color, height = 7 }) => (
    <div style={{ position: "relative" }}>
        <div style={{ background: "#e2e8f0", borderRadius: 99, height, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, value)}%`, height: "100%", borderRadius: 99, background: color, transition: "width .6s ease" }} />
        </div>
        {planned !== undefined && (
            <div style={{ position: "absolute", top: -2, left: `${Math.min(100, planned)}%`, width: 2, height: height + 4, background: "#334155", borderRadius: 2, transform: "translateX(-50%)" }} />
        )}
    </div>
);

const Card = ({ children, style = {}, p = "18px", mb = 12 }) => (
    <div style={{ background: C.card, borderRadius: 14, padding: p, marginBottom: mb, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: `1px solid ${C.border}`, ...style }}>
        {children}
    </div>
);

const SH = ({ icon, title, action, actionLabel }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {icon && <span style={{ color: C.textMid }}>{icon(C.textMid)}</span>}
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{title}</span>
        </div>
        {action && (
            <button onClick={action} style={{ display: "flex", alignItems: "center", gap: 4, background: C.blueLight, border: "none", borderRadius: 8, padding: "5px 12px", color: C.blue, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {I.plus(C.blue, 12)} {actionLabel}
            </button>
        )}
    </div>
);

const inp = { width: "100%", padding: "9px 12px", borderRadius: 9, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.text, outline: "none", boxSizing: "border-box", background: "#fff", fontFamily: "inherit", transition: "border-color .15s" };
const tis = { ...inp, padding: "8px 10px", fontSize: 12 };
const lbl = { fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 4, display: "block" };
const Field = ({ label, children }) => <div style={{ marginBottom: 13 }}><label style={lbl}>{label}</label>{children}</div>;

// ─── PIE CHART ────────────────────────────────────────────────────────────────
function PieChart({ approved, reviewing, pending, total }) {
    if (total === 0) return <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#e2e8f0" }} />;
    const r = 35, cx = 50, cy = 50;
    const seg = (val, start, color) => {
        if (!val) return null;
        const a = (val / total) * 2 * Math.PI;
        if (a >= 2 * Math.PI - 0.001) return <circle cx={cx} cy={cy} r={r} fill={color} key={color} />;
        const x1 = cx + r * Math.sin(start), y1 = cy - r * Math.cos(start);
        const x2 = cx + r * Math.sin(start + a), y2 = cy - r * Math.cos(start + a);
        return <path key={color} d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${a > Math.PI ? 1 : 0},1 ${x2},${y2} Z`} fill={color} />;
    };
    const a0 = 0, a1 = (approved / total) * 2 * Math.PI, a2 = a1 + (reviewing / total) * 2 * Math.PI;
    return (
        <svg viewBox="0 0 100 100" width={80} height={80}>
            {seg(approved, a0, "#10b981")}
            {seg(reviewing, a1, "#3b82f6")}
            {seg(pending, a2, "#f43f5e")}
            <circle cx={cx} cy={cy} r={18} fill="#fff" />
        </svg>
    );
}

// ─── TOP BAR ─────────────────────────────────────────────────────────────────
function TopBar({ title, sub, onMenu, onBack, right }) {
    return (
        <div style={{ background: "#fff", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 50 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                {onMenu && <button onClick={onMenu} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: C.textMid, flexShrink: 0 }}>{I.menu(C.text)}</button>}
                {onBack && <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}>{I.back(C.text)}</button>}
                <div style={{ minWidth: 0 }}>
                    <div className="topbar-title">{title}</div>
                    {sub && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
                </div>
            </div>
            <div style={{ flexShrink: 0, marginLeft: 12 }}>
                {right || (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: C.success, background: C.successLight, padding: "4px 9px", borderRadius: 99 }}>
                        {I.sync(C.success)} 即時同步
                    </span>
                )}
            </div>
        </div>
    );
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
function Sidebar({ open, onClose, activePage, setPage, alwaysOpen = false }) {
    const [exp, setExp] = useState({ basic: false, submit: false, quality: false });
    const tog = k => setExp(e => ({ ...e, [k]: !e[k] }));

    const MI = ({ label, icon, pageKey, sub = false }) => {
        const active = activePage === pageKey;
        return (
            <button onClick={() => { setPage(pageKey); if (!alwaysOpen) onClose(); }} style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%",
                padding: sub ? "9px 14px 9px 46px" : "11px 14px",
                background: active ? "rgba(26,86,219,0.14)" : "none",
                border: "none", color: active ? "#60a5fa" : "rgba(255,255,255,0.72)",
                cursor: "pointer", fontSize: 13.5, fontWeight: active ? 700 : 400,
                textAlign: "left", borderRadius: 9,
                borderLeft: active ? "3px solid #3b82f6" : "3px solid transparent",
            }}>
                {!sub && icon && <span style={{ opacity: active ? 1 : 0.7 }}>{icon(active ? "#60a5fa" : "rgba(255,255,255,0.7)")}</span>}
                {label}
            </button>
        );
    };

    const GI = ({ label, icon, gKey, children }) => (
        <div>
            <button onClick={() => tog(gKey)} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", padding: "11px 14px", background: "none", border: "none",
                color: "rgba(255,255,255,0.72)", cursor: "pointer", fontSize: 13.5, textAlign: "left",
                borderRadius: 9, borderLeft: "3px solid transparent",
            }}>
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {icon && <span style={{ opacity: 0.7 }}>{icon("rgba(255,255,255,0.7)")}</span>}
                    {label}
                </span>
                <span style={{ transform: exp[gKey] ? "rotate(180deg)" : "none", transition: ".2s", opacity: 0.5 }}>{I.chev("rgba(255,255,255,0.5)", 14)}</span>
            </button>
            {exp[gKey] && <div>{children}</div>}
        </div>
    );

    return (
        <>
            {open && !alwaysOpen && (
                <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 150, backdropFilter: "blur(2px)" }} />
            )}
            <div style={{
                position: "fixed", top: 0, left: 0, bottom: 0, width: 265, background: C.sidebar,
                zIndex: 160, transform: (open || alwaysOpen) ? "translateX(0)" : "translateX(-100%)",
                transition: "transform .25s cubic-bezier(.4,0,.2,1)",
                boxShadow: "6px 0 30px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column",
            }}>
                <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg,#1a56db,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19 }}>🔧</div>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: 1 }}>LITE PMIS</div>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 0.5 }}>工程專案管理系統</div>
                        </div>
                    </div>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "10px 8px" }}>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, padding: "8px 14px 4px", letterSpacing: 1.5 }}>主要功能</div>
                    <MI label="儀表板" icon={I.grid} pageKey="list" />
                    <MI label="監造日報表" icon={I.report} pageKey="daily-reports" />
                    <MI label="估驗計價" icon={I.billing} pageKey="billing" />
                    <div style={{ marginTop: 8, fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, padding: "8px 14px 4px", letterSpacing: 1.5 }}>管理模組</div>
                    <GI label="基本資料" icon={I.data} gKey="basic">
                        <MI label="專案資訊" pageKey="project-info" sub />
                        <MI label="合約資料" pageKey="contract" sub />
                    </GI>
                    <GI label="送審管理" icon={I.submit} gKey="submit">
                        <MI label="施工計畫" pageKey="construction-plan" sub />
                        <MI label="材料送審" pageKey="material-submit" sub />
                    </GI>
                    <GI label="品質管理" icon={I.shield} gKey="quality">
                        <MI label="檢試驗紀錄" pageKey="test-records" sub />
                        <MI label="缺失改善" pageKey="ncr-list" sub />
                    </GI>
                </div>
                <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#1a56db,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 12 }}>監</div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>監造人員</div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>系統管理員</div>
                        </div>
                    </div>
                    <button style={{ width: "100%", padding: "9px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 9, color: "#f87171", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        {I.logout()} 退出系統
                    </button>
                </div>
            </div>
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════════
function Login({ onLogin }) {
    const [user, setUser] = useState("");
    const [pass, setPass] = useState("");
    const [loading, setLoading] = useState(false);
    const submit = () => { setLoading(true); setTimeout(() => { setLoading(false); onLogin(); }, 900); };

    return (
        <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#0f172a 0%,#1e3a5f 50%,#0f172a 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -80, right: -80, width: 300, height: 300, borderRadius: "50%", background: "rgba(26,86,219,0.15)", filter: "blur(60px)" }} />
            <div style={{ position: "absolute", bottom: -60, left: -60, width: 250, height: 250, borderRadius: "50%", background: "rgba(59,130,246,0.1)", filter: "blur(50px)" }} />
            <div style={{ position: "relative", width: "100%", maxWidth: 400 }}>
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                    <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg,#1a56db,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, margin: "0 auto 16px", boxShadow: "0 8px 32px rgba(26,86,219,0.4)" }}>🔧</div>
                    <div style={{ fontSize: 30, fontWeight: 900, color: "#fff", letterSpacing: 3, marginBottom: 6 }}>LITE PMIS</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", letterSpacing: 1 }}>工程監造專案管理系統</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(16px)", borderRadius: 20, padding: "32px 28px", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ ...lbl, color: "rgba(255,255,255,0.6)" }}>帳號</label>
                        <input className="pmis-input" style={{ ...inp, background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.12)", color: "#fff" }}
                            placeholder="請輸入帳號" value={user} onChange={e => setUser(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
                    </div>
                    <div style={{ marginBottom: 24 }}>
                        <label style={{ ...lbl, color: "rgba(255,255,255,0.6)" }}>密碼</label>
                        <input type="password" className="pmis-input" style={{ ...inp, background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.12)", color: "#fff" }}
                            placeholder="請輸入密碼" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
                    </div>
                    <button onClick={submit} disabled={loading} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: loading ? "rgba(26,86,219,0.5)" : "linear-gradient(135deg,#1a56db,#3b82f6)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 4px 16px rgba(26,86,219,0.4)", transition: "all .2s" }}>
                        {loading ? "驗證中..." : "登入系統 →"}
                    </button>
                    <div style={{ marginTop: 20, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                        示範帳號：admin / admin&nbsp;&nbsp;·&nbsp;&nbsp;© 2025 LITE PMIS
                    </div>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROJECT LIST
// ═══════════════════════════════════════════════════════════════════════════════
function ProjectList({ projects, onSelect, onOpenMenu, onNewProject, isDesktop }) {
    const total = projects.length;
    const active = projects.filter(p => p.status === "施工中").length;
    const behind = projects.filter(p => p.status === "落後").length;

    return (
        <div style={{ background: C.bg, minHeight: "100vh", paddingBottom: 40 }}>
            <TopBar title="專案總覽" onMenu={isDesktop ? undefined : onOpenMenu} />
            <div className="pmis-container">
                {/* Summary strip */}
                <div className="g-3col" style={{ marginBottom: 16 }}>
                    {[
                        { label: "總工程數", value: total, color: C.primary, bg: C.primaryLight },
                        { label: "施工中", value: active, color: C.success, bg: C.successLight },
                        { label: "進度落後", value: behind, color: C.danger, bg: C.dangerLight },
                    ].map(s => (
                        <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: "14px 10px", textAlign: "center", border: `1px solid ${s.color}22` }}>
                            <div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: 11, color: s.color, fontWeight: 600, marginTop: 3 }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* New project button */}
                <button onClick={onNewProject} style={{
                    width: "100%", padding: "13px", borderRadius: 12, border: `2px dashed ${C.primary}55`,
                    background: C.primaryLight, color: C.primary, fontSize: 13, fontWeight: 700,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 16,
                }}>
                    {I.plus(C.primary, 15)} 建立新專案
                </button>

                {/* Project cards */}
                <div className="g-proj-list">
                    {projects.map(p => {
                        const ahead = p.actualProgress >= p.plannedProgress;
                        return (
                            <button key={p.id} className="card-btn" onClick={() => onSelect(p)} style={{
                                width: "100%", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16,
                                padding: "16px", textAlign: "left", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", cursor: "pointer",
                                borderLeft: `4px solid ${ahead ? C.success : C.danger}`,
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                                    <div style={{ flex: 1, paddingRight: 8 }}>
                                        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, lineHeight: 1.4, marginBottom: 4 }}>{p.name}</div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.textMuted }}>
                                            {I.loc(C.textMuted)} {p.location} · {p.contractNo}
                                        </div>
                                    </div>
                                    <Badge label={p.status} variant={p.status === "施工中" ? "success" : "danger"} />
                                </div>
                                <div style={{ marginBottom: 10 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                                        <span style={{ fontSize: 11, color: C.textMuted }}>施工進度</span>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: ahead ? C.success : C.danger }}>
                                            {p.actualProgress}% / {p.plannedProgress}% <span style={{ fontWeight: 400 }}>計畫</span>
                                        </span>
                                    </div>
                                    <ProgressBar value={p.actualProgress} planned={p.plannedProgress} color={ahead ? "#10b981" : "#f43f5e"} />
                                </div>
                                <div className="g-4col">
                                    {[
                                        ["合約金額", `${p.contractAmount}M`],
                                        ["剩餘工期", `${p.remainDays}天`],
                                        ["差異", `${ahead ? "+" : ""}${(p.actualProgress - p.plannedProgress).toFixed(1)}%`],
                                        ["異常", `${p.anomalies}項`],
                                    ].map(([k, v], i) => (
                                        <div key={k} style={{ background: i === 3 && p.anomalies > 0 ? "#fef2f2" : C.bg, borderRadius: 8, padding: "6px 8px" }}>
                                            <div style={{ fontSize: 9, color: C.textMuted }}>{k}</div>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: i === 3 && p.anomalies > 0 ? C.danger : C.text }}>{v}</div>
                                        </div>
                                    ))}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW PROJECT FORM
// ═══════════════════════════════════════════════════════════════════════════════
function NewProjectForm({ onSave, onBack }) {
    const [form, setForm] = useState({
        name: "", location: "", contractNo: "", contractAmount: "", owner: "",
        startDate: "", endDate: "", supervisorName: "",
    });
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const save = () => {
        if (!form.name || !form.contractNo) return;
        onSave({
            ...form, id: Date.now(),
            shortName: form.name.slice(0, 12) + (form.name.length > 12 ? "..." : ""),
            contractAmount: parseFloat(form.contractAmount) || 0,
            actualProgress: 0, plannedProgress: 0, billingProgress: 0,
            remainDays: 365, status: "施工中", anomalies: 0,
            submissions: {
                construction: { total: 0, approved: 0, reviewing: 0, pending: 0 },
                material: { total: 0, approved: 0, reviewing: 0, pending: 0 },
            },
            tests: [], ncr: [], billing: [], dailyReports: [],
        });
    };
    return (
        <div style={{ background: C.bg, minHeight: "100vh", paddingBottom: 60 }}>
            <TopBar title="建立新專案" onBack={onBack} />
            <div className="pmis-container-sm">
                <Card>
                    <SH icon={I.data} title="契約基本資料" />
                    <Field label="工程名稱 *"><input className="pmis-input" style={inp} placeholder="請輸入完整工程名稱" value={form.name} onChange={e => set("name", e.target.value)} /></Field>
                    <div className="g-form2">
                        <Field label="契約編號 *"><input className="pmis-input" style={tis} placeholder="1141A10XXX" value={form.contractNo} onChange={e => set("contractNo", e.target.value)} /></Field>
                        <Field label="合約金額 (百萬)"><input type="number" className="pmis-input" style={tis} placeholder="0.00" value={form.contractAmount} onChange={e => set("contractAmount", e.target.value)} /></Field>
                    </div>
                    <Field label="業主單位"><input className="pmis-input" style={inp} placeholder="請輸入業主名稱" value={form.owner} onChange={e => set("owner", e.target.value)} /></Field>
                    <Field label="工程地點"><input className="pmis-input" style={inp} placeholder="縣市區路段" value={form.location} onChange={e => set("location", e.target.value)} /></Field>
                    <div className="g-form2">
                        <Field label="開工日期"><input type="date" className="pmis-input" style={tis} value={form.startDate} onChange={e => set("startDate", e.target.value)} /></Field>
                        <Field label="竣工日期"><input type="date" className="pmis-input" style={tis} value={form.endDate} onChange={e => set("endDate", e.target.value)} /></Field>
                    </div>
                    <Field label="監造人員"><input className="pmis-input" style={inp} placeholder="負責監造工程師" value={form.supervisorName} onChange={e => set("supervisorName", e.target.value)} /></Field>
                </Card>
                <button onClick={save} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#1a56db,#3b82f6)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(26,86,219,0.3)" }}>
                    建立專案 →
                </button>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROJECT DETAIL / DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function ProjectDetail({ project, onBack, onOpenMenu, onDailyReport, isDesktop }) {
    const [submitTab, setSubmitTab] = useState("construction");
    const sub = project.submissions[submitTab];
    const ahead = project.actualProgress >= project.plannedProgress;

    const ProgressCard = (
        <Card key="prog">
            <SH icon={I.chart} title="進度概況" />
            <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: C.textMid }}>整體施工進度</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: ahead ? C.success : C.danger }}>
                        實際 {project.actualProgress}% / 計畫 {project.plannedProgress}%
                    </span>
                </div>
                <ProgressBar value={project.actualProgress} planned={project.plannedProgress} color={ahead ? "#10b981" : "#f43f5e"} height={8} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                    <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: ahead ? "#10b981" : "#f43f5e", display: "inline-block" }} />實際進度</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 2, height: 10, background: "#334155", display: "inline-block" }} />計畫進度</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: ahead ? C.success : C.danger }}>
                        {ahead ? "▲ 超前" : "▼ 落後"} {Math.abs(project.actualProgress - project.plannedProgress).toFixed(1)}%
                    </span>
                </div>
            </div>
            <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: C.textMid }}>估驗計價進度</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.blue }}>{project.billingProgress}%</span>
                </div>
                <ProgressBar value={project.billingProgress} color="#3b82f6" height={6} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, marginTop: 12, borderTop: `1px solid ${C.border}` }}>
                <div><div style={{ fontSize: 10, color: C.textMuted }}>開工日期</div><div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginTop: 2 }}>{project.startDate}</div></div>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 10, color: C.textMuted }}>剩餘工期</div><div style={{ fontSize: 12, fontWeight: 600, color: C.warn, marginTop: 2 }}>{project.remainDays} 天</div></div>
                <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: C.textMuted }}>預定完工</div><div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginTop: 2 }}>{project.endDate}</div></div>
            </div>
        </Card>
    );

    const SubmitCard = (
        <Card key="sub">
            <SH icon={I.doc} title="送審統計" />
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {[["施工計畫", "construction"], ["材料送審", "material"]].map(([label, key]) => (
                    <button key={key} onClick={() => setSubmitTab(key)} style={{ padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${submitTab === key ? C.text : C.border}`, background: submitTab === key ? C.text : "#fff", color: submitTab === key ? "#fff" : C.textMid, fontSize: 12, fontWeight: submitTab === key ? 700 : 400, cursor: "pointer" }}>{label}</button>
                ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <PieChart {...sub} />
                <div style={{ flex: 1 }}>
                    {[["需求總數", sub.total, C.text], ["已核准", sub.approved, "#10b981"], ["審查中", sub.reviewing, "#3b82f6"], ["未送審", sub.pending, "#f43f5e"]].map(([k, v, c]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.bg}` }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.textMid }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block" }} />{k}
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: c }}>{v}</span>
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    );

    const TestsCard = (
        <Card key="tests">
            <SH icon={I.flask} title="近期檢試驗" />
            {project.tests.map((t, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: i < project.tests.length - 1 ? `1px solid ${C.bg}` : "none" }}>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{I.cal(C.textMuted)} {t.date}</div>
                    </div>
                    <Badge label={t.result} variant={t.result === "合格" ? "success" : "danger"} />
                </div>
            ))}
            {project.tests.length === 0 && <div style={{ textAlign: "center", color: C.textMuted, padding: "20px 0" }}>尚無試驗紀錄</div>}
        </Card>
    );

    const NcrCard = (
        <Card key="ncr" mb={0}>
            <SH icon={I.ncr} title="NCR 缺失改善" />
            {project.ncr.length === 0
                ? <div style={{ textAlign: "center", color: C.success, padding: "20px 0", fontSize: 13, fontWeight: 600 }}>✓ 無缺失待處理</div>
                : project.ncr.map((n, i) => (
                    <div key={i} style={{ padding: "10px 12px", borderRadius: 10, background: n.status === "待處理" ? "#fef2f2" : "#f0fdf4", marginBottom: 8, borderLeft: `3px solid ${n.status === "待處理" ? C.danger : C.success}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: n.status === "待處理" ? C.danger : C.success }}>{n.status}</span>
                            <span style={{ fontSize: 11, color: C.textMuted }}>{n.date}</span>
                        </div>
                        <div style={{ fontSize: 12, color: C.textMid }}>{n.desc}</div>
                    </div>
                ))
            }
        </Card>
    );

    return (
        <div style={{ background: C.bg, minHeight: "100vh", paddingBottom: 40 }}>
            <TopBar title={project.shortName} sub={`${project.location} · ${project.contractNo}`} onBack={onBack} onMenu={isDesktop ? undefined : onOpenMenu} />
            <div className="pmis-container">
                {/* KPI cards */}
                <div className="g-kpi" style={{ marginBottom: 14 }}>
                    {[
                        { label: "合約金額", value: `${project.contractAmount}M`, icon: I.book, bg: "#eff6ff", color: C.blue },
                        { label: "累計進度", value: `${project.actualProgress}%`, icon: I.trend, bg: "#d1fae5", color: C.success },
                        { label: "剩餘工期", value: `${project.remainDays} 天`, icon: I.clock, bg: "#fef3c7", color: C.warn },
                        { label: "異常項目", value: `${project.anomalies} 項`, icon: I.alert, bg: "#fee2e2", color: C.danger },
                    ].map(c => (
                        <div key={c.label} style={{ background: "#fff", borderRadius: 14, padding: "14px", boxShadow: "0 1px 5px rgba(0,0,0,0.06)", border: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>{c.label}</div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 22, fontWeight: 900, color: C.text }}>{c.value}</span>
                                <span style={{ width: 36, height: 36, borderRadius: 10, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{c.icon(c.color)}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Quick action */}
                <button onClick={onDailyReport} style={{
                    width: "100%", padding: "13px 16px", borderRadius: 13, border: "none",
                    background: "linear-gradient(135deg,#1340a8,#1a56db,#2563eb)", color: "#fff",
                    fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 14,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                    boxShadow: "0 4px 18px rgba(26,86,219,0.35)",
                }}>
                    {I.report("#fff")} 填寫今日監造日報表
                    <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 400, opacity: 0.7 }}>{today()}</span>
                </button>

                {/* Dashboard grid */}
                <div className="g-dash">
                    <div>{ProgressCard}{TestsCard}</div>
                    <div>{SubmitCard}{NcrCard}</div>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY REPORT LIST
// ═══════════════════════════════════════════════════════════════════════════════
function DailyReportList({ projects, onSelectReport, onNewReport, onOpenMenu, isDesktop }) {
    const [selProjId, setSelProjId] = useState(projects[0]?.id || null);
    const proj = projects.find(p => p.id === selProjId);
    const month = thisMonth();

    return (
        <div style={{ background: C.bg, minHeight: "100vh", paddingBottom: 40 }}>
            <TopBar title="監造日報表" onMenu={isDesktop ? undefined : onOpenMenu} />
            <div className="pmis-container">
                <div style={{ marginBottom: 14 }}>
                    <label style={lbl}>選擇工程案</label>
                    <select value={selProjId} onChange={e => setSelProjId(Number(e.target.value))} className="pmis-input" style={inp}>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>

                {proj && (
                    <>
                        <div className="g-3col" style={{ marginBottom: 14 }}>
                            {[
                                { label: "日報總數", value: proj.dailyReports.length, color: C.primary },
                                { label: "本月填報", value: proj.dailyReports.filter(r => r.date.startsWith(month)).length, color: C.success },
                                { label: "缺報天數", value: 0, color: C.textMuted },
                            ].map(s => (
                                <div key={s.label} style={{ background: "#fff", borderRadius: 12, padding: "14px 10px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: `1px solid ${C.border}` }}>
                                    <div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.value}</div>
                                    <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{s.label}</div>
                                </div>
                            ))}
                        </div>

                        <button onClick={() => onNewReport(proj)} style={{
                            width: "100%", padding: "13px", borderRadius: 12, border: `2px dashed ${C.primary}55`,
                            background: C.primaryLight, color: C.primary, fontSize: 14, fontWeight: 700, cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14,
                        }}>
                            {I.plus(C.primary)} 新增日報表
                        </button>

                        {proj.dailyReports.length === 0
                            ? <div style={{ textAlign: "center", color: C.textMuted, padding: "50px 0", fontSize: 14 }}>
                                <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>尚無日報表，請新增
                            </div>
                            : <div className="g-daily-list">
                                {[...proj.dailyReports].reverse().map(r => (
                                    <button key={r.id} className="card-btn" onClick={() => onSelectReport(r, proj)} style={{
                                        width: "100%", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14,
                                        padding: "16px", textAlign: "left", boxShadow: "0 1px 5px rgba(0,0,0,0.05)", cursor: "pointer",
                                    }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <div style={{ width: 40, height: 40, borderRadius: 10, background: C.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                                                    {weatherIcon[r.weather] || "🌤️"}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.date}</div>
                                                    <div style={{ fontSize: 11, color: C.textMuted }}>編號：{r.reportNo}</div>
                                                </div>
                                            </div>
                                            <Badge label={r.weather} variant="blue" />
                                        </div>
                                        <div className="g-3col">
                                            {[["實際進度", `${r.actualProgress}%`], ["抽查項目", `${r.inspections.length}項`], ["文件紀錄", `${r.documents.length}件`]].map(([k, v]) => (
                                                <div key={k} style={{ background: C.bg, borderRadius: 8, padding: "7px 8px" }}>
                                                    <div style={{ fontSize: 10, color: C.textMuted }}>{k}</div>
                                                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{v}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        }
                    </>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY REPORT VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function DailyReportView({ report, project, onBack, onEdit }) {
    const [tab, setTab] = useState("progress");
    const diff = (report.actualProgress - report.plannedProgress).toFixed(1);
    const ahead = diff >= 0;
    const tabs = [
        { key: "progress", label: "工程進度" },
        { key: "qty", label: "數量計算" },
        { key: "inspect", label: "施工抽查" },
        { key: "quality", label: "品質試驗" },
        { key: "docs", label: "文件管理" },
    ];

    return (
        <div style={{ background: C.bg, minHeight: "100vh", paddingBottom: 40 }}>
            <TopBar title={`日報表 ${report.date}`} sub={project.shortName} onBack={onBack} />
            <div className="pmis-container">
                {/* Basic info */}
                <Card mb={10}>
                    <div className="g-2col">
                        {[
                            ["報表編號", report.reportNo],
                            ["日期", report.date],
                            ["天氣", `${weatherIcon[report.weather] || ""} ${report.weather}`],
                            ["氣溫", `${report.tempLow}°C ～ ${report.tempHigh}°C`],
                            ["監造人員", report.supervisor],
                            ["承攬廠商", report.contractor],
                        ].map(([k, v]) => (
                            <div key={k}>
                                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>{k}</div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{v}</div>
                            </div>
                        ))}
                    </div>
                </Card>

                <button onClick={onEdit} style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: "#fff", color: C.textMid, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 14 }}>
                    {I.edit(C.textMid)} 編輯此日報表
                </button>

                {/* Tab pills */}
                <div className="tab-scroll" style={{ marginBottom: 12 }}>
                    {tabs.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: "7px 14px", borderRadius: 20, border: `1.5px solid ${tab === t.key ? C.primary : C.border}`, background: tab === t.key ? C.primary : "#fff", color: tab === t.key ? "#fff" : C.textMid, fontSize: 12, fontWeight: tab === t.key ? 700 : 400, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{t.label}</button>
                    ))}
                </div>

                {tab === "progress" && (
                    <Card>
                        <SH icon={I.chart} title="工程進度" />
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                <span style={{ fontSize: 13, color: C.textMid }}>整體施工進度</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: ahead ? C.success : C.danger }}>{report.actualProgress}% / {report.plannedProgress}% 計畫</span>
                            </div>
                            <ProgressBar value={report.actualProgress} planned={report.plannedProgress} color={ahead ? "#10b981" : "#f43f5e"} height={8} />
                            <div style={{ textAlign: "center", marginTop: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: ahead ? C.success : C.danger }}>
                                    {ahead ? "▲" : "▼"} 進度差異 {ahead ? "+" : ""}{diff}%
                                </span>
                            </div>
                        </div>
                        {report.progressNote && (
                            <div style={{ background: C.bg, borderRadius: 10, padding: "12px", fontSize: 13, color: C.textMid, lineHeight: 1.7, borderLeft: `3px solid ${C.primary}` }}>
                                📝 {report.progressNote}
                            </div>
                        )}
                    </Card>
                )}
                {tab === "qty" && (
                    <Card>
                        <SH icon={I.chart} title="數量計算" />
                        {report.quantities.map((q, i) => (
                            <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < report.quantities.length - 1 ? `1px solid ${C.bg}` : "none" }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 8 }}>{q.item}</div>
                                <div className="g-qty">
                                    {[["單位", q.unit], ["契約數量", q.contractQty], ["本日數量", q.todayQty], ["累計數量", q.cumQty]].map(([k, v]) => (
                                        <div key={k} style={{ background: C.bg, borderRadius: 8, padding: "7px 8px" }}>
                                            <div style={{ fontSize: 9, color: C.textMuted }}>{k}</div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{v}</div>
                                        </div>
                                    ))}
                                </div>
                                {q.note && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 5 }}>備註：{q.note}</div>}
                            </div>
                        ))}
                        {report.quantities.length === 0 && <div style={{ textAlign: "center", color: C.textMuted, padding: "20px 0" }}>無數量計算資料</div>}
                    </Card>
                )}
                {tab === "inspect" && (
                    <Card>
                        <SH icon={I.shield} title="施工抽查" />
                        {report.inspections.map((ins, i) => (
                            <div key={i} style={{ marginBottom: 10, background: C.bg, borderRadius: 10, padding: "12px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <div>
                                        <span style={{ fontSize: 11, color: C.textMuted, marginRight: 8 }}>{ins.no}</span>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{ins.item}</span>
                                    </div>
                                    <Badge label={ins.result} variant={ins.result === "合格" ? "success" : "danger"} />
                                </div>
                                {ins.note && <div style={{ fontSize: 12, color: C.textMid }}>📌 {ins.note}</div>}
                            </div>
                        ))}
                        {report.inspections.length === 0 && <div style={{ textAlign: "center", color: C.textMuted, padding: "20px 0" }}>無抽查紀錄</div>}
                    </Card>
                )}
                {tab === "quality" && (
                    <Card>
                        <SH icon={I.flask} title="品質試驗" />
                        {report.qualityTests.map((qt, i) => (
                            <div key={i} style={{ marginBottom: 10, background: C.bg, borderRadius: 10, padding: "12px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{qt.material}</span>
                                    <Badge label={qt.result} variant={qt.result === "合格" ? "success" : "danger"} />
                                </div>
                                <div className="g-qty3" style={{ marginBottom: qt.note ? 6 : 0 }}>
                                    {[["契約數量", qt.contractQty], ["已作數量", qt.doneQty], ["試驗項目", qt.testItem]].map(([k, v]) => (
                                        <div key={k}>
                                            <div style={{ fontSize: 9, color: C.textMuted }}>{k}</div>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{v}</div>
                                        </div>
                                    ))}
                                </div>
                                {qt.note && <div style={{ fontSize: 11, color: C.textMid }}>📌 {qt.note}</div>}
                            </div>
                        ))}
                        {report.qualityTests.length === 0 && <div style={{ textAlign: "center", color: C.textMuted, padding: "20px 0" }}>無試驗紀錄</div>}
                    </Card>
                )}
                {tab === "docs" && (
                    <>
                        <Card>
                            <SH icon={I.doc} title="文件管理" />
                            {report.documents.map((d, i) => (
                                <div key={i} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: i < report.documents.length - 1 ? `1px solid ${C.bg}` : "none" }}>
                                    <div style={{ marginBottom: 5 }}><Badge label={d.type} /></div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 3 }}>{d.subject}</div>
                                    <div style={{ fontSize: 11, color: C.textMuted }}>文號：{d.no} · {d.date}</div>
                                    {d.note && <div style={{ fontSize: 11, color: C.textMid, background: C.bg, borderRadius: 7, padding: "6px 10px", marginTop: 6 }}>📌 {d.note}</div>}
                                </div>
                            ))}
                            {report.documents.length === 0 && <div style={{ textAlign: "center", color: C.textMuted, padding: "20px 0" }}>無文件紀錄</div>}
                        </Card>
                        {report.specialNote && (
                            <Card mb={0}>
                                <SH icon={I.doc} title="特別記載事項" />
                                <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.8, background: "#fffbeb", borderRadius: 10, padding: "12px 14px", borderLeft: `3px solid ${C.warn}` }}>
                                    {report.specialNote}
                                </div>
                            </Card>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY REPORT FORM
// ═══════════════════════════════════════════════════════════════════════════════
function DailyReportForm({ project, existing, onSave, onBack }) {
    const emptyReport = {
        id: Date.now(), date: today(),
        reportNo: `114-${String((project.dailyReports.length + 1)).padStart(3, "0")}`,
        weather: "晴", tempHigh: 28, tempLow: 18,
        supervisor: project.supervisorName || "", contractor: "",
        plannedProgress: project.plannedProgress, actualProgress: project.actualProgress,
        progressNote: "",
        quantities: [{ item: "", unit: "m²", contractQty: 0, todayQty: 0, cumQty: 0, note: "" }],
        inspections: [{ no: "", item: "", result: "合格", note: "" }],
        qualityTests: [{ material: "", contractQty: "", doneQty: "", testItem: "", result: "合格", note: "" }],
        documents: [{ type: "業主公文", no: "", subject: "", date: today(), note: "" }],
        specialNote: "",
    };

    const [form, setForm] = useState(existing || emptyReport);
    const [activeTab, setActiveTab] = useState("basic");
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const updArr = (key, idx, field, val) => setForm(f => { const arr = [...f[key]]; arr[idx] = { ...arr[idx], [field]: val }; return { ...f, [key]: arr }; });
    const addRow = (key, tmpl) => setForm(f => ({ ...f, [key]: [...f[key], { ...tmpl }] }));
    const delRow = (key, idx) => setForm(f => ({ ...f, [key]: f[key].filter((_, i) => i !== idx) }));

    const tabs = ["基本資料", "工程進度", "數量計算", "施工抽查", "品質試驗", "文件管理"];
    const tabKeys = ["basic", "progress", "qty", "inspect", "quality", "docs"];
    const tabIdx = tabKeys.indexOf(activeTab);

    return (
        <div style={{ background: C.bg, minHeight: "100vh", paddingBottom: 90 }}>
            <TopBar title={existing ? "編輯日報表" : "新增日報表"} sub={project.shortName} onBack={onBack} right={<span />} />

            {/* Tab bar */}
            <div style={{ background: "#fff", borderBottom: `1px solid ${C.border}`, padding: "0 12px", display: "flex", gap: 0, overflowX: "auto", scrollbarWidth: "none" }}>
                {tabs.map((t, i) => (
                    <button key={i} onClick={() => setActiveTab(tabKeys[i])} style={{
                        padding: "13px 14px", border: "none", background: "none", whiteSpace: "nowrap", flexShrink: 0,
                        fontSize: 13, fontWeight: activeTab === tabKeys[i] ? 700 : 400,
                        color: activeTab === tabKeys[i] ? C.primary : C.textMuted,
                        borderBottom: activeTab === tabKeys[i] ? `2.5px solid ${C.primary}` : "2.5px solid transparent",
                        cursor: "pointer",
                    }}>{t}</button>
                ))}
            </div>

            {/* Progress dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "10px 0", background: "#fff", borderBottom: `1px solid ${C.bg}` }}>
                {tabKeys.map((k, i) => (
                    <div key={k} style={{ width: i === tabIdx ? 20 : 8, height: 8, borderRadius: 99, background: i < tabIdx ? C.success : i === tabIdx ? C.primary : C.border, transition: "all .3s" }} />
                ))}
            </div>

            <div className="pmis-container-sm" style={{ paddingBottom: 0 }}>
                {/* ── 基本資料 ── */}
                {activeTab === "basic" && (
                    <Card>
                        <SH icon={I.doc} title="基本資料" />
                        <div className="g-form2">
                            <Field label="報表編號">
                                <input className="pmis-input" style={tis} value={form.reportNo} onChange={e => set("reportNo", e.target.value)} />
                            </Field>
                            <Field label="日期">
                                <input type="date" className="pmis-input" style={tis} value={form.date} onChange={e => set("date", e.target.value)} />
                            </Field>
                        </div>
                        <div className="g-form2">
                            <Field label="天氣">
                                <select className="pmis-input" style={tis} value={form.weather} onChange={e => set("weather", e.target.value)}>
                                    {WEATHER_OPTIONS.map(w => <option key={w}>{w}</option>)}
                                </select>
                            </Field>
                            <Field label="氣溫 (°C)">
                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                    <input type="number" className="pmis-input" style={{ ...tis, width: "100%" }} placeholder="最低" value={form.tempLow} onChange={e => set("tempLow", e.target.value)} />
                                    <span style={{ color: C.textMuted, flexShrink: 0 }}>~</span>
                                    <input type="number" className="pmis-input" style={{ ...tis, width: "100%" }} placeholder="最高" value={form.tempHigh} onChange={e => set("tempHigh", e.target.value)} />
                                </div>
                            </Field>
                        </div>
                        <Field label="監造人員">
                            <input className="pmis-input" style={inp} value={form.supervisor} onChange={e => set("supervisor", e.target.value)} />
                        </Field>
                        <Field label="承攬廠商">
                            <input className="pmis-input" style={inp} value={form.contractor} onChange={e => set("contractor", e.target.value)} />
                        </Field>
                    </Card>
                )}

                {/* ── 工程進度 ── */}
                {activeTab === "progress" && (
                    <Card>
                        <SH icon={I.chart} title="工程進度" />
                        <div className="g-form2">
                            <Field label="預定進度 (%)">
                                <input type="number" className="pmis-input" style={tis} value={form.plannedProgress} onChange={e => set("plannedProgress", parseFloat(e.target.value) || 0)} />
                            </Field>
                            <Field label="實際進度 (%)">
                                <input type="number" className="pmis-input" style={tis} value={form.actualProgress} onChange={e => set("actualProgress", parseFloat(e.target.value) || 0)} />
                            </Field>
                        </div>
                        <div style={{ marginBottom: 14 }}>
                            <ProgressBar value={form.actualProgress} planned={form.plannedProgress} color={form.actualProgress >= form.plannedProgress ? "#10b981" : "#f43f5e"} height={10} />
                            <div style={{ textAlign: "center", marginTop: 6, fontSize: 12, fontWeight: 700, color: form.actualProgress >= form.plannedProgress ? C.success : C.danger }}>
                                {form.actualProgress >= form.plannedProgress ? "▲ 超前" : "▼ 落後"} {Math.abs(form.actualProgress - form.plannedProgress).toFixed(1)}%
                            </div>
                        </div>
                        <Field label="突發情形說明">
                            <textarea className="pmis-input" style={{ ...inp, resize: "vertical", height: 90 }} value={form.progressNote} onChange={e => set("progressNote", e.target.value)} placeholder="說明當日施工狀況、突發事件..." />
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
                                <div className="g-form2" style={{ marginBottom: 6 }}>
                                    <div>
                                        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>施工項目</div>
                                        <input className="pmis-input" style={tis} placeholder="項目名稱" value={q.item} onChange={e => updArr("quantities", i, "item", e.target.value)} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>單位</div>
                                        <input className="pmis-input" style={tis} placeholder="m²" value={q.unit} onChange={e => updArr("quantities", i, "unit", e.target.value)} />
                                    </div>
                                </div>
                                <div className="g-qty" style={{ marginBottom: 6 }}>
                                    {[["契約數量", "contractQty"], ["本日數量", "todayQty"], ["累計數量", "cumQty"]].map(([label, key]) => (
                                        <div key={key}>
                                            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>{label}</div>
                                            <input type="number" className="pmis-input" style={tis} value={q[key]} onChange={e => updArr("quantities", i, key, parseFloat(e.target.value) || 0)} />
                                        </div>
                                    ))}
                                    <div>
                                        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>備註</div>
                                        <input className="pmis-input" style={tis} value={q.note} onChange={e => updArr("quantities", i, "note", e.target.value)} />
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
                                <div className="g-form2" style={{ marginBottom: 6 }}>
                                    <div>
                                        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>抽查編號</div>
                                        <input className="pmis-input" style={tis} placeholder="QC-001" value={ins.no} onChange={e => updArr("inspections", i, "no", e.target.value)} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>結果</div>
                                        <select className="pmis-input" style={tis} value={ins.result} onChange={e => updArr("inspections", i, "result", e.target.value)}>
                                            <option>合格</option><option>不合格</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ marginBottom: 6 }}>
                                    <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>抽查項目</div>
                                    <input className="pmis-input" style={tis} placeholder="項目說明" value={ins.item} onChange={e => updArr("inspections", i, "item", e.target.value)} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>備註</div>
                                    <input className="pmis-input" style={tis} placeholder="備註說明" value={ins.note} onChange={e => updArr("inspections", i, "note", e.target.value)} />
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
                                <div className="g-form2" style={{ marginBottom: 6 }}>
                                    <div>
                                        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>材料/設備</div>
                                        <input className="pmis-input" style={tis} placeholder="材料名稱" value={qt.material} onChange={e => updArr("qualityTests", i, "material", e.target.value)} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>試驗結果</div>
                                        <select className="pmis-input" style={tis} value={qt.result} onChange={e => updArr("qualityTests", i, "result", e.target.value)}>
                                            <option>合格</option><option>不合格</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="g-qty3" style={{ marginBottom: 6 }}>
                                    {[["試驗項目", "testItem", "坍度試驗"], ["契約數量", "contractQty", "500m³"], ["已作數量", "doneQty", "120m³"]].map(([label, key, ph]) => (
                                        <div key={key}>
                                            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>{label}</div>
                                            <input className="pmis-input" style={tis} placeholder={ph} value={qt[key]} onChange={e => updArr("qualityTests", i, key, e.target.value)} />
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>備註</div>
                                    <input className="pmis-input" style={tis} placeholder="備註說明" value={qt.note} onChange={e => updArr("qualityTests", i, "note", e.target.value)} />
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
                                    <div className="g-form2" style={{ marginBottom: 6 }}>
                                        <div>
                                            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>文件類型</div>
                                            <select className="pmis-input" style={tis} value={d.type} onChange={e => updArr("documents", i, "type", e.target.value)}>
                                                {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>日期</div>
                                            <input type="date" className="pmis-input" style={tis} value={d.date} onChange={e => updArr("documents", i, "date", e.target.value)} />
                                        </div>
                                    </div>
                                    <div style={{ marginBottom: 6 }}>
                                        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>文號</div>
                                        <input className="pmis-input" style={tis} placeholder="文件編號" value={d.no} onChange={e => updArr("documents", i, "no", e.target.value)} />
                                    </div>
                                    <div style={{ marginBottom: 6 }}>
                                        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>主旨</div>
                                        <input className="pmis-input" style={tis} placeholder="文件主旨" value={d.subject} onChange={e => updArr("documents", i, "subject", e.target.value)} />
                                    </div>
                                    <input className="pmis-input" style={tis} placeholder="備註" value={d.note} onChange={e => updArr("documents", i, "note", e.target.value)} />
                                </div>
                            ))}
                            {form.documents.length === 0 && <div style={{ textAlign: "center", padding: "24px 0", color: C.textMuted, fontSize: 13 }}>點擊「新增文件」開始填寫</div>}
                        </Card>
                        <Card mb={0}>
                            <SH icon={I.doc} title="特別記載事項" />
                            <textarea className="pmis-input" style={{ ...inp, resize: "vertical", height: 100, width: "100%" }}
                                value={form.specialNote} onChange={e => set("specialNote", e.target.value)}
                                placeholder="特別事項、人員安全、機具異常、業主指示等記載..." />
                        </Card>
                    </>
                )}
            </div>

            {/* Bottom nav — responds to sidebar via CSS */}
            <div className="daily-bottom-nav">
                {tabIdx > 0 && (
                    <button onClick={() => setActiveTab(tabKeys[tabIdx - 1])} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: "#fff", color: C.textMid, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        ← 上一頁
                    </button>
                )}
                {tabIdx < tabKeys.length - 1 ? (
                    <button onClick={() => setActiveTab(tabKeys[tabIdx + 1])} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: C.primary, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        下一頁 →
                    </button>
                ) : (
                    <button onClick={() => onSave(form)} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#059669,#10b981)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        {I.check("#fff")} 儲存日報表
                    </button>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
    const [loggedIn, setLoggedIn] = useState(false);
    const [projects, setProjects] = useState(INIT_PROJECTS);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [page, setPage] = useState("list");
    const [selProject, setSelProject] = useState(null);
    const [selReport, setSelReport] = useState(null);
    const [editReport, setEditReport] = useState(null);

    const winW = useWindowWidth();
    const isDesktop = winW >= 1200;

    if (!loggedIn) return (
        <>
            <link href={FONT_LINK} rel="stylesheet" />
            <style>{GLOBAL_CSS}</style>
            <Login onLogin={() => setLoggedIn(true)} />
        </>
    );

    const saveReport = (form) => {
        setProjects(ps => ps.map(p => {
            if (p.id !== selProject.id) return p;
            const exists = p.dailyReports.find(r => r.id === form.id);
            const reports = exists ? p.dailyReports.map(r => r.id === form.id ? form : r) : [...p.dailyReports, form];
            const updated = { ...p, dailyReports: reports };
            setSelProject(updated);
            return updated;
        }));
        setSelReport(form);
        setPage("daily-view");
    };

    const saveProject = (proj) => { setProjects(ps => [...ps, proj]); setPage("list"); };
    const handleSetPage = (p) => {
        setPage(p);
        if (p === "daily-reports" && !selProject && projects.length) setSelProject(projects[0]);
    };
    const cp = () => projects.find(p => p.id === selProject?.id) || selProject;

    const pageContent = () => {
        const rp = { isDesktop };
        if (page === "list")
            return <ProjectList projects={projects} onSelect={p => { setSelProject(p); setPage("detail"); }} onNewProject={() => setPage("new-project")} onOpenMenu={() => setSidebarOpen(true)} {...rp} />;
        if (page === "new-project")
            return <NewProjectForm onSave={saveProject} onBack={() => setPage("list")} />;
        if (page === "detail" && selProject)
            return <ProjectDetail project={cp()} onBack={() => setPage("list")} onOpenMenu={() => setSidebarOpen(true)} onDailyReport={() => { setEditReport(null); setPage("daily-form"); }} {...rp} />;
        if (page === "daily-reports")
            return <DailyReportList projects={projects} onSelectReport={(r, p) => { setSelReport(r); setSelProject(p); setPage("daily-view"); }} onNewReport={p => { setSelProject(p); setEditReport(null); setPage("daily-form"); }} onOpenMenu={() => setSidebarOpen(true)} {...rp} />;
        if (page === "daily-view" && selReport && selProject)
            return <DailyReportView report={selReport} project={cp()} onBack={() => setPage("daily-reports")} onEdit={() => { setEditReport(selReport); setPage("daily-form"); }} />;
        if (page === "daily-form" && selProject)
            return <DailyReportForm project={cp()} existing={editReport} onSave={saveReport} onBack={() => setPage(selReport && editReport ? "daily-view" : "detail")} />;
        if (["billing", "project-info", "contract", "construction-plan", "material-submit", "test-records", "ncr-list"].includes(page))
            return (
                <div style={{ background: C.bg, minHeight: "100vh" }}>
                    <TopBar title={{ billing: "估驗計價", "project-info": "專案資訊", contract: "合約資料", "construction-plan": "施工計畫", "material-submit": "材料送審", "test-records": "檢試驗紀錄", "ncr-list": "缺失改善" }[page]} onMenu={!isDesktop ? () => setSidebarOpen(true) : undefined} onBack={() => setPage("list")} />
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 80, color: C.textMuted }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: C.textMid, marginBottom: 8 }}>開發中</div>
                        <div style={{ fontSize: 13, color: C.textMuted }}>此模組即將上線，敬請期待</div>
                    </div>
                </div>
            );
        return null;
    };

    return (
        <>
            <link href={FONT_LINK} rel="stylesheet" />
            <style>{GLOBAL_CSS}</style>

            {isDesktop ? (
                /* ═══ DESKTOP: permanent sidebar ═══ */
                <div className="pmis-app">
                    <div className="pmis-sidebar-col">
                        <Sidebar open alwaysOpen onClose={() => { }} activePage={page} setPage={handleSetPage} />
                    </div>
                    <div className="pmis-main">
                        {pageContent()}
                    </div>
                </div>
            ) : (
                /* ═══ MOBILE / TABLET: overlay drawer ═══ */
                <div className="pmis-main-full">
                    <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activePage={page} setPage={handleSetPage} />
                    {pageContent()}
                </div>
            )}
        </>
    );
}
