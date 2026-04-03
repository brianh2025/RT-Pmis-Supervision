import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { DailyReportTemplate } from "@/lib/pdf/DailyReportTemplate";
import { supabase } from "@/lib/supabase/client";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ reportId: string }> }
) {
    const { reportId } = await params;

    try {
        // 1. Fetch Daily Report Data
        const { data: report, error: reportError } = await supabase
            .from("daily_reports")
            .select(`
        *,
        projects (name),
        tasks (name)
      `)
            .eq("id", reportId)
            .single();

        if (reportError || !report) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        // 2. Fetch Related Logs
        const [laborRes, equipRes, safetyRes] = await Promise.all([
            supabase.from("labor_logs").select("*").eq("daily_report_id", reportId),
            supabase.from("equipment_logs").select("*").eq("daily_report_id", reportId),
            supabase.from("safety_checks").select("*").eq("daily_report_id", reportId).maybeSingle(),
        ]);

        // 3. Prepare Data for Template
        const pdfData = {
            projectName: (report as any).projects?.name || "未知工程",
            contractor: "XX 營造股份有限公司",
            date: (report as any).date,
            weather: (report as any).weather || "晴",
            progress: (report as any).progress || 0,
            tasks: [
                {
                    name: (report as any).tasks?.name || "主要工程項目",
                    unit: "式",
                    contractQty: 1,
                    todayQty: 0.05,
                    cumQty: 0.1,
                },
            ],
            labor: laborRes.data?.map((l: any) => ({ type: l.worker_type, count: Number(l.today_count) })) || [],
            equipment: equipRes.data?.map((e: any) => ({ name: e.equipment_name, count: e.today_count })) || [],
            safety: {
                preJobEd: (safetyRes.data as any)?.pre_job_education || false,
                insurance: (safetyRes.data as any)?.insurance_verified || false,
                ppe: (safetyRes.data as any)?.ppe_checked || false,
            },
        };

        // 4. Generate PDF Buffer
        const buffer = await renderToBuffer(<DailyReportTemplate data={pdfData as any} />);

        // 5. Return Response
        return new NextResponse(buffer as any, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="DailyReport_${reportId}.pdf"`,
            },
        });
    } catch (error: any) {
        console.error("PDF Generation Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
