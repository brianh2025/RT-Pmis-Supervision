import React from 'react';

// 品牌色（主色保持，背景/文字/邊框改用 CSS 變數以支援深色模式）
export const C = {
    primary: "#1a56db", primaryDark: "#1340a8", primaryLight: "rgba(26,86,219,0.10)",
    success: "#059669", successLight: "rgba(5,150,105,0.12)",
    danger: "#dc2626", dangerLight: "rgba(220,38,38,0.12)",
    warn: "#d97706", warnLight: "rgba(217,119,6,0.12)",
    blue: "#2563eb", blueLight: "rgba(37,99,235,0.10)",
    text: "var(--color-text-main)", textMid: "var(--color-text2)", textMuted: "var(--color-text-muted)",
    border: "var(--color-border)", bg: "var(--color-bg1)", card: "var(--color-surface)",
    sidebar: "var(--color-background-base)",
};

export const I = {
    menu: (c = "currentColor") => <svg width="20" height="20" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>,
    back: (c = "currentColor") => <svg width="20" height="20" fill="none" stroke={c} strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>,
    plus: (c = "currentColor", s = 16) => <svg width={s} height={s} fill="none" stroke={c} strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
    trash: (c = "#ef4444") => <svg width="15" height="15" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>,
    edit: (c = "currentColor") => <svg width="15" height="15" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
    check: (c = "#059669") => <svg width="14" height="14" fill="none" stroke={c} strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>,
    chev: (c = "#94a3b8", s = 16) => <svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>,
    report: (c = "currentColor") => <svg width="17" height="17" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
    shield: (c = "currentColor") => <svg width="17" height="17" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
    chart: (c = "currentColor") => <svg width="16" height="16" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" /></svg>,
    flask: (c = "currentColor") => <svg width="16" height="16" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M6 2v6l-4 8a2 2 0 001.8 3h12.4A2 2 0 0018 16L14 8V2" /><line x1="6" y1="2" x2="18" y2="2" /></svg>,
    doc: (c = "currentColor") => <svg width="16" height="16" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
    sync: (c = "#059669") => <svg width="13" height="13" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg>,
    loc: (c = "#64748b") => <svg width="11" height="11" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>,
    cal: (c = "currentColor") => <svg width="13" height="13" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
};

export const WEATHER_OPTIONS = ["晴", "多雲", "陰", "小雨", "中雨", "大雨", "颱風"];
export const DOC_TYPES = ["業主公文", "廠商公文", "會議紀錄", "督導查核", "交辦事項", "其他"];
export const weatherIcon = { "晴": "☀️", "多雲": "⛅", "陰": "☁️", "小雨": "🌦️", "中雨": "🌧️", "大雨": "⛈️", "颱風": "🌀" };
export const today = () => new Date().toISOString().split("T")[0];
export const thisMonth = () => new Date().toISOString().slice(0, 7);

export const Badge = ({ label, variant = "default" }) => {
    const vs = {
        default: { bg: C.bg, color: C.textMid },
        success: { bg: C.successLight, color: C.success },
        danger: { bg: C.dangerLight, color: C.danger },
        warn: { bg: C.warnLight, color: C.warn },
        blue: { bg: C.blueLight, color: C.blue },
        dark: { bg: "#1e293b", color: "#fff" },
    };
    const s = vs[variant] || vs.default;
    return <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 99, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>{label}</span>;
};

export const ProgressBar = ({ value, planned, color, height = 7 }) => (
    <div style={{ position: "relative" }}>
        <div style={{ background: "var(--color-surface-border)", borderRadius: 99, height, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, value)}%`, height: "100%", borderRadius: 99, background: color, transition: "width .6s ease" }} />
        </div>
        {planned !== undefined && (
            <div style={{ position: "absolute", top: -2, left: `${Math.min(100, planned)}%`, width: 2, height: height + 4, background: "var(--color-text2)", borderRadius: 2, transform: "translateX(-50%)" }} />
        )}
    </div>
);

export const Card = ({ children, style = {}, p = "16px", mb = 16 }) => (
    <div style={{ background: C.card, borderRadius: 14, padding: p, marginBottom: mb, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: `1px solid ${C.border}`, ...style }}>
        {children}
    </div>
);

export const SH = ({ icon, title, action, actionLabel }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {icon && <span style={{ color: C.textMid }}>{icon(C.textMid)}</span>}
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{title}</span>
        </div>
        {action && (
            <button onClick={action} style={{ display: "flex", alignItems: "center", gap: 4, background: C.blueLight, border: "none", borderRadius: 8, padding: "5px 12px", color: C.blue, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "transform .15s" }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
                onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
                {I.plus(C.blue, 12)} {actionLabel}
            </button>
        )}
    </div>
);
