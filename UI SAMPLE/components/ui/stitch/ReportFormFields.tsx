import React from "react";
import { UseFormRegister, FieldErrors } from "react-hook-form";
import { DailyReportFormValues, weatherEnum } from "@/lib/validations/daily-report";

interface Props {
    register: UseFormRegister<DailyReportFormValues>;
    errors: FieldErrors<DailyReportFormValues>;
}

export const ReportFormFields = ({ register, errors }: Props) => {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Date Field */}
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200">報告日期</label>
                    <input
                        type="date"
                        {...register("date")}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-primary outline-none transition-all"
                    />
                    {errors.date && <p className="text-xs text-red-500 font-medium">{errors.date.message}</p>}
                </div>

                {/* Weather Field */}
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200">當日天候</label>
                    <select
                        {...register("weather")}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-primary outline-none transition-all"
                    >
                        <option value="">請選擇天候</option>
                        {weatherEnum.options.map((w) => (
                            <option key={w} value={w}>
                                {w}
                            </option>
                        ))}
                    </select>
                    {errors.weather && <p className="text-xs text-red-500 font-medium">{errors.weather.message}</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Progress Field */}
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200">施工累計進度 (%)</label>
                    <input
                        type="number"
                        step="0.01"
                        {...register("progress", { valueAsNumber: true })}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-primary outline-none transition-all"
                        placeholder="0 - 100"
                    />
                    {errors.progress && <p className="text-xs text-red-500 font-medium">{errors.progress.message}</p>}
                </div>

                {/* Temperature Field */}
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200">平均溫度 (°C)</label>
                    <input
                        type="text"
                        {...register("temperature")}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-primary outline-none transition-all"
                        placeholder="例: 22-26"
                    />
                </div>
            </div>

            {/* Content Field */}
            <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-200">主要施工內容</label>
                <textarea
                    {...register("content")}
                    rows={4}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-primary outline-none transition-all resize-none"
                    placeholder="請描述今日施工重點..."
                />
                {errors.content && <p className="text-xs text-red-500 font-medium">{errors.content.message}</p>}
            </div>

            {/* Note Field */}
            <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-200">監造備註 / 缺失提醒</label>
                <textarea
                    {...register("note")}
                    rows={2}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-primary outline-none transition-all resize-none"
                    placeholder="如有缺失或特殊事項請在此註記"
                />
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-6">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">法定紀錄項目</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Labor & Equipment Section */}
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                人員出勤 (本日)
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">工別</p>
                                    <input placeholder="例: 模板工" className="w-full text-xs px-3 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">人數</p>
                                    <input type="number" placeholder="0" className="w-full text-xs px-3 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                機具使用 (本日)
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">機具名稱</p>
                                    <input placeholder="例: 挖土機" className="w-full text-xs px-3 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">數量</p>
                                    <input type="number" placeholder="0" className="w-full text-xs px-3 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Safety Checklist Section */}
                    <div className="space-y-4 bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            職業安全衛生檢查
                        </label>
                        <div className="space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" {...register("safety.preJobEducation")} className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary" />
                                <span className="text-xs text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">實施勤前教育 (含預防災變)</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" {...register("safety.insuranceVerified")} className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary" />
                                <span className="text-xs text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">核對勞工保險與安衛訓練紀錄</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" {...register("safety.ppeChecked")} className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary" />
                                <span className="text-xs text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">確認勞工確實配戴防護具 (PPE)</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
