import React from "react";

export const ProjectMonitor = () => {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 h-full">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                    <span className="material-icons-round text-primary text-xl">trending_up</span>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">進度監控</h3>
                </div>
            </div>
            <div className="space-y-8 flex-1 flex flex-col justify-center">
                <div className="space-y-2">
                    <div className="flex justify-between items-end mb-1">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">專案總進度</span>
                        <div className="text-right">
                            <span className="text-xs text-slate-400">目前 <span className="text-slate-600 dark:text-slate-300">0%</span></span>
                            <span className="text-slate-300 mx-1">|</span>
                            <span className="text-sm font-bold text-primary">預計 0%</span>
                        </div>
                    </div>
                    <div className="relative h-3 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="absolute top-0 left-0 h-full bg-slate-200 dark:bg-slate-600 w-[0%]"></div>
                        <div className="absolute top-0 left-0 h-full bg-primary w-[0%] shadow-lg shadow-blue-500/50"></div>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                        <span>落後</span>
                        <span>提早</span>
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between items-end mb-1">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">付款進度</span>
                        <span className="text-sm font-bold text-violet-500">0%</span>
                    </div>
                    <div className="relative h-3 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="absolute top-0 left-0 h-full bg-violet-500 w-[1%] shadow-lg shadow-violet-500/50"></div>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">累積估驗金額與合約比</p>
                </div>
            </div>
        </div>
    );
};
