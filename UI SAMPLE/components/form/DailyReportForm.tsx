"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { dailyReportSchema, DailyReportFormValues } from "@/lib/validations/daily-report";
import { ReportFormFields } from "@/components/ui/stitch/ReportFormFields";
import PhotoUpload from "@/components/form/PhotoUpload";
import { Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function DailyReportForm() {
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<DailyReportFormValues>({
        resolver: zodResolver(dailyReportSchema),
        defaultValues: {
            date: new Date().toISOString().split("T")[0],
            progress: 0,
            weather: "晴",
            safety: {
                preJobEducation: false,
                insuranceVerified: false,
                ppeChecked: false,
            },
        },
    });

    const onSubmit = async (data: DailyReportFormValues) => {
        // 治理規範 4.1: 送出後鎖定狀態 (模擬 API 請求)
        console.log("Submitting Daily Report:", data);

        // 模擬網路延遲
        await new Promise((resolve) => setTimeout(resolve, 1000));

        alert("監造日誌送出成功！資料已依據規範鎖定。");
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Form Header */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Save className="text-primary w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white">新增監造日誌</h2>
                            <p className="text-xs text-slate-500">依據工程會規範，送出後需電子簽核才可修改</p>
                        </div>
                    </div>
                </div>

                {/* Validation Error Alert */}
                {Object.keys(errors).length > 0 && (
                    <div className="mx-6 mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-start gap-3">
                        <AlertCircle className="text-red-500 w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                            <h3 className="text-sm font-bold text-red-800 dark:text-red-400">表單驗證未通過</h3>
                            <p className="text-xs text-red-600 dark:text-red-500">請修正下方紅字標示的錯誤後再試一次。</p>
                        </div>
                    </div>
                )}

                {/* Form Content */}
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-8">
                    <ReportFormFields register={register} errors={errors} />

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-8">
                        <PhotoUpload onUploadComplete={(data) => {
                            console.log("Photo Uploaded:", data);
                            toast.success("照片已成功解析並帶入暫存紀錄");
                        }} />
                    </div>

                    {/* Form Actions */}
                    <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                        <button
                            type="button"
                            className="px-6 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-8 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-md shadow-primary/20 transition-all flex items-center gap-2"
                        >
                            {isSubmitting ? "處理中..." : (
                                <>
                                    <Save size={18} />
                                    送出日誌
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
