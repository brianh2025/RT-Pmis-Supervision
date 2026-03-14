"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

const menuGroups = [
    {
        label: "監造",
        items: [
            { icon: "grid_view", label: "專案總覽", path: "/projects" },
            { icon: "analytics", label: "進度分析", path: "/analytics" },
        ],
    },
    {
        label: "文件",
        items: [
            { icon: "folder_open", label: "歸檔管理", path: "/archive", sub: true },
            { icon: "fact_check", label: "送審管理", path: "/submission", sub: true },
            { icon: "verified_user", label: "品管管理", path: "/quality", sub: true },
        ],
    },
];

export default function Sidebar() {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const pathname = usePathname();
    const params = useParams();
    const projectId = params?.id as string;

    // Helper to generate context-aware links
    const getLink = (path: string) => {
        if (!projectId) return path;
        const projectSpecific = ["/analytics", "/archive", "/submission", "/quality"];
        if (projectSpecific.includes(path)) {
            return `/projects/${projectId}${path}`;
        }
        return path;
    };

    return (
        <>
            {/* Mobile trigger */}
            {!isMobileOpen && (
                <button
                    onClick={() => setIsMobileOpen(true)}
                    className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-[#1565C0] text-white rounded-full shadow-lg z-[60] flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                >
                    <span className="material-icons-round text-2xl">menu</span>
                </button>
            )}

            <aside
                className={`fixed inset-0 lg:sticky lg:top-0 lg:h-screen z-50 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300
          ${isMobileOpen ? "translate-x-0 w-full" : "-translate-x-full lg:translate-x-0"}
          ${isCollapsed ? "lg:w-[60px]" : "lg:w-52"}
        `}
            >
                {/* Header */}
                <div className="h-12 flex items-center px-3 border-b border-slate-100 dark:border-slate-800 justify-between overflow-hidden">
                    <div className="flex items-center min-w-0">
                        <div className="bg-[#1565C0] rounded-lg p-1.5 flex-shrink-0 text-white flex items-center justify-center w-9 h-9">
                            <span className="material-icons-round text-xl">account_tree</span>
                        </div>
                        {(!isCollapsed || isMobileOpen) && (
                            <h1 className="ml-2.5 text-base font-bold text-slate-800 dark:text-white whitespace-nowrap tracking-tight">
                                RT PMIS
                            </h1>
                        )}
                    </div>

                    {/* Desktop collapse toggle */}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="hidden lg:flex absolute -right-3 top-8 w-6 h-6 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full items-center justify-center text-slate-500 hover:text-[#1565C0] shadow-sm z-50"
                    >
                        <span className="material-icons-round text-xs">
                            {isCollapsed ? "chevron_right" : "chevron_left"}
                        </span>
                    </button>

                    {/* Mobile close */}
                    <button
                        onClick={() => setIsMobileOpen(false)}
                        className="lg:hidden w-10 h-10 flex items-center justify-center text-slate-500"
                    >
                        <span className="material-icons-round">close</span>
                    </button>
                </div>

                {/* Nav */}
                <div className="flex-1 overflow-y-auto py-4 px-3 lg:px-2.5 space-y-4 custom-scrollbar">
                    {menuGroups.map((group, idx) => (
                        <div key={idx}>
                            {!isCollapsed && (
                                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 px-2">
                                    {group.label}
                                </div>
                            )}
                            <div className="space-y-0.5">
                                {group.items.map((item, i) => {
                                    const targetPath = getLink(item.path);
                                    const isActive = pathname === targetPath;
                                    return (
                                        <Link
                                            key={i}
                                            href={targetPath}
                                            onClick={() => setIsMobileOpen(false)}
                                            className={`flex items-center group relative px-2.5 py-1.5 rounded-lg transition-all ${isActive
                                                ? "bg-[#1565C0]/10 text-[#1565C0]"
                                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                }`}
                                        >
                                            <span
                                                className={`material-icons-outlined text-lg flex-shrink-0 ${isCollapsed && !isMobileOpen ? "mx-auto" : "mr-2.5"
                                                    }`}
                                            >
                                                {item.icon}
                                            </span>
                                            {(!isCollapsed || isMobileOpen) && (
                                                <span className="font-medium whitespace-nowrap text-sm">
                                                    {item.label}
                                                </span>
                                            )}
                                            {isCollapsed && !isMobileOpen && (
                                                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap z-50 transition-opacity">
                                                    {item.label}
                                                </div>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                            {isCollapsed && (
                                <div className="h-px bg-slate-100 dark:bg-slate-800 my-4" />
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer logout */}
                <div className="p-3 border-t border-slate-100 dark:border-slate-800">
                    <Link
                        href="/"
                        className="w-full flex items-center justify-center px-2 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 transition-colors"
                    >
                        <span className="material-icons-round text-sm -ml-0.5">logout</span>
                        {!isCollapsed && (
                            <span className="ml-1.5 text-[13px] font-medium">登出</span>
                        )}
                    </Link>
                </div>
            </aside>
        </>
    );
}
