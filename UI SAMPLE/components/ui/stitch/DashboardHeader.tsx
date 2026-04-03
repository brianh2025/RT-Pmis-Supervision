import React from "react";
import { Bell, Search, User, LayoutDashboard } from "lucide-react";

export const DashboardHeader = () => {
    return (
        <header className="flex items-center justify-between px-8 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
            <div className="flex items-center gap-3">
                <div className="bg-primary p-2 rounded-lg text-white shadow-md shadow-primary/20">
                    <LayoutDashboard size={24} />
                </div>
                <div>
                    <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Supervision PMIS</h1>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">工地監造管理系統</p>
                </div>
            </div>

            <div className="flex items-center gap-6">
                <div className="hidden md:flex items-center px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-full border border-slate-100 dark:border-slate-700 w-64 group focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                    <Search size={16} className="text-slate-400 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="搜尋工程、報表、圖說..."
                        className="bg-transparent border-none outline-none text-xs ml-2 w-full text-slate-600 dark:text-slate-300 placeholder:text-slate-400"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <button className="relative p-2 text-slate-500 hover:text-primary transition-colors">
                        <Bell size={20} />
                        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                    </button>

                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>

                    <div className="flex items-center gap-3 pl-1">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-slate-800 dark:text-white leading-none">王建國</p>
                            <p className="text-[10px] text-slate-400 font-medium mt-1">主任監造工程師</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-blue-400 flex items-center justify-center text-white shadow-md">
                            <User size={20} />
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};
