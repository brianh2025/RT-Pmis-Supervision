import { z } from "zod";

export const weatherEnum = z.enum(["晴", "多雲", "陰", "雨", "陣雨", "雷雨"]);

export const laborLogSchema = z.object({
    workerType: z.string().min(1, "工別為必填"),
    todayCount: z.number().min(0),
});

export const equipmentLogSchema = z.object({
    name: z.string().min(1, "機具名稱為必填"),
    count: z.number().min(0),
});

export const dailyReportSchema = z.object({
    date: z.string().min(1, "日期是必填項"),
    weather: weatherEnum,
    temperature: z.string().optional(),
    progress: z.number().min(0, "進度不能小於 0").max(100, "進度不能超過 100"),
    content: z.string().min(1, "施工內容是必填項"),
    note: z.string().optional(),
    // Statutory Fields
    labor: z.array(laborLogSchema).optional(),
    equipment: z.array(equipmentLogSchema).optional(),
    safety: z.object({
        preJobEducation: z.boolean(),
        insuranceVerified: z.boolean(),
        ppeChecked: z.boolean(),
    }),
});

export type DailyReportFormValues = z.infer<typeof dailyReportSchema>;
