import React from "react";
import { Page, Text, View, Document, StyleSheet, Font } from "@react-pdf/renderer";

// Register fonts if needed, but standard ones are fine for structure
// For zh-TW, we usually need a font that supports it in production.
// Since we are in a local dev env, we will assume the receiver has fonts or use default.

const styles = StyleSheet.create({
    page: {
        padding: 30,
        fontSize: 10,
        fontFamily: "Helvetica", // In production, replace with NotoSansTC
    },
    header: {
        textAlign: "center",
        marginBottom: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 12,
        marginBottom: 10,
    },
    infoTable: {
        display: "flex",
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#000",
        paddingBottom: 5,
        marginBottom: 10,
    },
    infoItem: {
        flex: 1,
    },
    sectionTitle: {
        backgroundColor: "#f0f0f0",
        padding: 4,
        fontWeight: "bold",
        borderWidth: 1,
        borderColor: "#000",
        textAlign: "center",
    },
    table: {
        display: "flex",
        width: "auto",
        borderStyle: "solid",
        borderWidth: 1,
        borderColor: "#000",
        borderRightWidth: 0,
        borderBottomWidth: 0,
    },
    tableRow: {
        flexDirection: "row",
    },
    tableColHeader: {
        width: "20%",
        borderStyle: "solid",
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        backgroundColor: "#f9f9f9",
        padding: 5,
        textAlign: "center",
        fontWeight: "bold",
    },
    tableCol: {
        width: "20%",
        borderStyle: "solid",
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        padding: 5,
    },
    footer: {
        marginTop: 30,
        flexDirection: "row",
        justifyContent: "space-around",
    },
    signatureBox: {
        width: 150,
        height: 60,
        borderWidth: 1,
        borderColor: "#000",
        marginTop: 5,
    }
});

interface Props {
    data: {
        projectName: string;
        contractor: string;
        date: string;
        weather: string;
        progress: number;
        tasks: Array<{
            name: string;
            unit: string;
            contractQty: number;
            todayQty: number;
            cumQty: number;
            note?: string;
        }>;
        labor: Array<{ type: string; count: number }>;
        equipment: Array<{ name: string; count: number }>;
        safety: {
            preJobEd: boolean;
            insurance: boolean;
            ppe: boolean;
        };
    };
}

export const DailyReportTemplate = ({ data }: Props) => (
    <Document>
        <Page size="A4" style={styles.page}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>行政院公共工程委員會 監造日報表</Text>
                <Text style={styles.subtitle}>工程名稱：{data.projectName}</Text>
            </View>

            {/* Info Bar */}
            <View style={styles.infoTable}>
                <View style={styles.infoItem}><Text>日期：{data.date}</Text></View>
                <View style={styles.infoItem}><Text>天氣：{data.weather}</Text></View>
                <View style={styles.infoItem}><Text>累計進度：{data.progress}%</Text></View>
            </View>

            <View style={styles.infoTable}>
                <View style={styles.infoItem}><Text>承造人：{data.contractor}</Text></View>
            </View>

            {/* Construction Progress Table */}
            <Text style={styles.sectionTitle}>一、按圖施工概況</Text>
            <View style={styles.table}>
                <View style={styles.tableRow}>
                    <Text style={[styles.tableColHeader, { width: "30%" }]}>施工項目</Text>
                    <Text style={styles.tableColHeader}>單位</Text>
                    <Text style={styles.tableColHeader}>契約數量</Text>
                    <Text style={styles.tableColHeader}>本日完成</Text>
                    <Text style={styles.tableColHeader}>累計完成</Text>
                </View>
                {data.tasks.map((task, i) => (
                    <View style={styles.tableRow} key={i}>
                        <Text style={[styles.tableCol, { width: "30%" }]}>{task.name}</Text>
                        <Text style={styles.tableCol}>{task.unit}</Text>
                        <Text style={styles.tableCol}>{task.contractQty}</Text>
                        <Text style={styles.tableCol}>{task.todayQty}</Text>
                        <Text style={styles.tableCol}>{task.cumQty}</Text>
                    </View>
                ))}
            </View>

            {/* Resources Section (Sample layout) */}
            <Text style={[styles.sectionTitle, { marginTop: 15 }]}>二、資源管理（人員與機具）</Text>
            <View style={{ flexDirection: "row" }}>
                <View style={{ flex: 1, borderRightWidth: 1, borderColor: "#000" }}>
                    <Text style={{ padding: 5, fontWeight: "bold" }}>人員出勤紀錄</Text>
                    {data.labor.map((l, i) => (
                        <Text key={i} style={{ paddingLeft: 10 }}>{l.type}: {l.count} 人</Text>
                    ))}
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{ padding: 5, fontWeight: "bold" }}>機具進場紀錄</Text>
                    {data.equipment.map((e, i) => (
                        <Text key={i} style={{ paddingLeft: 10 }}>{e.name}: {e.count} 輛/台</Text>
                    ))}
                </View>
            </View>

            {/* Safety Section */}
            <Text style={[styles.sectionTitle, { marginTop: 15 }]}>三、職業安全衛生與環境維護</Text>
            <View style={{ padding: 5 }}>
                <Text>1. 是否實施勤前教育：{data.safety.preJobEd ? "V 是" : "X 否"}</Text>
                <Text>2. 勞工保險及安全教育紀錄檢查：{data.safety.insurance ? "V 正確" : "X 缺失"}</Text>
                <Text>3. 勞工是否確實配戴個人防護具：{data.safety.ppe ? "V 正確" : "X 缺失"}</Text>
            </View>

            {/* Footer / Signatures */}
            <View style={styles.footer}>
                <View>
                    <Text>監造主任簽章：</Text>
                    <View style={styles.signatureBox} />
                </View>
                <View>
                    <Text>監造工程師簽章：</Text>
                    <View style={styles.signatureBox} />
                </View>
            </View>

            <Text style={{ position: "absolute", bottom: 20, right: 30, fontSize: 8 }}>
                Report Generated by Supervision PMIS - Anti-counterfeiting Certified
            </Text>
        </Page>
    </Document>
);
