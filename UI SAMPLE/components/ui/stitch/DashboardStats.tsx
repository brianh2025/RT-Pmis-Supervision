import React from "react";
import { Clock, Construction, CreditCard, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatProps {
    label: string;
    value: string;
    subText?: string;
    icon: React.ReactNode;
    color: "emerald" | "amber" | "violet" | "red";
    trend?: string;
}

const StatCard = ({ label, value, subText, icon, color, trend }: StatProps) => {
    const colorMap = {
        emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30",
        amber: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30",
        violet: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30",
        red: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30",
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                {icon}
            </div>
            <div className="flex justify-between items-start mb-4 relative z-10">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</h3>
                <div className={cn("p-2 rounded-lg", colorMap[color].split(" ").slice(2).join(" "))}>
                    {icon}
                </div>
            </div>
            <div className="relative z-10">
                <p className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">{value}</p>
                {trend && (
                    <p className={cn("text-xs mt-1 flex items-center font-medium", colorMap[color].split(" ").slice(0, 2).join(" "))}>
                        <TrendingUp size={12} className="mr-1" />
                        {trend}
                    </p>
                )}
                {subText && <p className="text-xs text-slate-400 mt-1">{subText}</p>}
            </div>
        </div>
    );
};

export const DashboardStats = () => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
                label="剩餘天數"
                value="841"
                trend="進度正常"
                icon={<Clock size={20} />}
                color="emerald"
            />
            <StatCard
                label="專案狀態"
                value="施工中"
                subText="階段: 前置作業"
                icon={<Construction size={20} />}
                color="amber"
            />
            <StatCard
                label="付款進度"
                value="0%"
                subText="累計估驗: 0 期"
                icon={<CreditCard size={20} />}
                color="violet"
            />
            <StatCard
                label="施工缺失"
                value="3"
                trend="待改善"
                icon={<Construction size={20} />}
                color="red"
            />
        </div>
    );
};
