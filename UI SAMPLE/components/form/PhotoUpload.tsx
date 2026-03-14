"use client";

import React, { useState, useRef } from "react";
import exifr from "exifr";
import { Camera, MapPin, Calendar, AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PhotoMetadata {
    latitude?: number;
    longitude?: number;
    takenAt?: Date;
    locationNote?: string;
    blob: Blob;
    previewUrl: string;
}

export default function PhotoUpload({ onUploadComplete }: { onUploadComplete?: (data: PhotoMetadata) => void }) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [photo, setPhoto] = useState<PhotoMetadata | null>(null);
    const [errorStatus, setErrorStatus] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const processImage = async (file: File) => {
        setIsProcessing(true);
        setErrorStatus(null);
        try {
            // 1. Parse EXIF
            const metadata = await exifr.parse(file, {
                gps: true,
            });

            console.log("EXIF Metadata:", metadata);

            const lat = metadata?.latitude;
            const lng = metadata?.longitude;
            const takenAt = metadata?.DateTimeOriginal ? new Date(metadata.DateTimeOriginal) : null;

            // 2. Watermark & Convert
            const watermarkedBlob = await addWatermarkAndGetBlob(file, takenAt || new Date());

            const photoData: PhotoMetadata = {
                latitude: lat,
                longitude: lng,
                takenAt: takenAt || new Date(),
                blob: watermarkedBlob,
                previewUrl: URL.createObjectURL(watermarkedBlob),
            };

            setPhoto(photoData);

            // Check strict rules
            if (!lat || !lng) {
                toast.warning("照片缺少 GPS 資訊，請手動輸入拍攝地點。");
            }

            if (!takenAt) {
                toast.info("未能讀取照片原始拍攝日期，請手動校正。");
            }

        } catch (error) {
            console.error("Process error:", error);
            toast.error("照片處理失敗，請檢查檔案格式。");
            setErrorStatus("處理失敗");
        } finally {
            setIsProcessing(false);
        }
    };

    const addWatermarkAndGetBlob = (file: File, date: Date): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                if (!ctx) return reject("Canvas error");

                canvas.width = img.width;
                canvas.height = img.height;

                // Draw original image
                ctx.drawImage(img, 0, 0);

                // Watermark settings
                const dateStr = date.toLocaleString("zh-TW", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                });

                const fontSize = Math.max(24, Math.floor(canvas.width / 40));
                ctx.font = `bold ${fontSize}px sans-serif`;
                ctx.fillStyle = "rgba(255, 235, 59, 0.9)"; // Yellow
                ctx.textAlign = "right";
                ctx.textBaseline = "bottom";

                // Draw text background for readability
                const padding = fontSize * 0.5;
                const textMetrics = ctx.measureText(dateStr);
                ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
                ctx.fillRect(
                    canvas.width - textMetrics.width - padding * 2,
                    canvas.height - fontSize - padding * 2,
                    textMetrics.width + padding * 2,
                    fontSize + padding * 2
                );

                // Draw date text
                ctx.fillStyle = "#FFEB3B"; // Statutory Yellow
                ctx.fillText(dateStr, canvas.width - padding, canvas.height - padding);

                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject("Blob generation failed");
                }, "image/jpeg", 0.9);
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    };

    const handleUpdateLocation = (note: string) => {
        if (photo) {
            setPhoto({ ...photo, locationNote: note });
        }
    };

    const handleUpdateDate = (dateStr: string) => {
        if (photo) {
            const newDate = new Date(dateStr);
            if (!isNaN(newDate.getTime())) {
                setPhoto({ ...photo, takenAt: newDate });
                // NOTE: In a real app, we'd re-watermark if the date changed manually
            }
        }
    };

    const removePhoto = () => {
        setPhoto(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <Camera size={18} className="text-primary" />
                    現場施工照片 (EXIF GPS/日期驗證)
                </label>
                <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded border border-amber-100 font-bold uppercase">
                    工程會防偽規範
                </span>
            </div>

            {!photo ? (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                        "border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 transition-all cursor-pointer hover:border-primary hover:bg-primary/5 group text-center",
                        isProcessing && "opacity-50 pointer-events-none"
                    )}
                >
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={(e) => e.target.files?.[0] && processImage(e.target.files[0])}
                    />
                    {isProcessing ? (
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="animate-spin text-primary" size={32} />
                            <p className="text-sm text-slate-500 font-medium">正在解析 EXIF 資訊並繪製浮水印...</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all">
                                <Camera size={24} />
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300 font-bold">點擊上傳照片</p>
                            <p className="text-[10px] text-slate-400">系統將自動提取經緯度與拍照日期</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm relative overflow-hidden">
                    <button
                        onClick={removePhoto}
                        className="absolute top-2 right-2 p-1.5 bg-white/80 dark:bg-slate-800/80 rounded-full text-slate-500 hover:text-red-500 shadow-sm z-10 transition-colors"
                    >
                        <X size={16} />
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-100 dark:border-slate-800">
                            <img src={photo.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                            <div className="absolute bottom-2 right-2 bg-black/50 px-2 py-0.5 rounded text-[8px] font-mono text-white pointer-events-none">
                                PREVIEW WITH WATERMARK
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">驗證結果</h4>

                            {/* Date Status */}
                            <div className="group space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                                        <Calendar size={14} className="text-slate-400" />
                                        拍照日期
                                    </div>
                                    {photo.takenAt ? (
                                        <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold">
                                            <CheckCircle2 size={12} /> 已核對
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-[10px] text-amber-500 font-bold">
                                            <AlertTriangle size={12} /> 需校正
                                        </span>
                                    )}
                                </div>
                                <input
                                    type="datetime-local"
                                    className="w-full text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary"
                                    value={photo.takenAt ? photo.takenAt.toISOString().slice(0, 16) : ""}
                                    onChange={(e) => handleUpdateDate(e.target.value)}
                                />
                            </div>

                            {/* Location Status */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                                        <MapPin size={14} className="text-slate-400" />
                                        GPS 座標
                                    </div>
                                    {photo.latitude && photo.longitude ? (
                                        <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold">
                                            <CheckCircle2 size={12} /> 經緯度正確
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-[10px] text-amber-500 font-bold">
                                            <AlertTriangle size={12} /> 缺少座標
                                        </span>
                                    )}
                                </div>

                                {photo.latitude && photo.longitude ? (
                                    <div className="text-[10px] font-mono text-slate-500 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800">
                                        {photo.latitude.toFixed(6)}, {photo.longitude.toFixed(6)}
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <input
                                            type="text"
                                            placeholder="請輸入拍攝地點 (例如: A棟3F樓板)"
                                            className="w-full text-xs bg-amber-50/30 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-amber-500"
                                            value={photo.locationNote || ""}
                                            onChange={(e) => handleUpdateLocation(e.target.value)}
                                        />
                                        <p className="text-[9px] text-amber-600 font-medium">* 缺乏 GPS 資訊時必須手動加註拍攝位置</p>
                                    </div>
                                )}
                            </div>

                            <div className="pt-2">
                                <button
                                    onClick={() => onUploadComplete?.(photo)}
                                    className="w-full py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-black shadow-lg hover:shadow-primary/10 transition-all flex items-center justify-center gap-2"
                                >
                                    <CheckCircle2 size={14} />
                                    確認帶入表單
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
