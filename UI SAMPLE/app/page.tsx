"use client";
import Link from "next/link";

export default function WelcomePage() {
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 overflow-hidden dark:bg-slate-950 bg-slate-50">
      {/* Animated background blobs */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950" />
        <div className="absolute top-[20%] left-[20%] w-[30vw] h-[30vw] bg-[#1565C0]/10 rounded-full blur-[100px] animate-blob" />
        <div
          className="absolute bottom-[20%] right-[20%] w-[25vw] h-[25vw] bg-blue-400/10 rounded-full blur-[80px] animate-blob"
          style={{ animationDelay: "2s" }}
        />
      </div>

      {/* Welcome text above card */}
      <div className="relative z-10 mb-6 animate-fade-in text-center">
        <p className="text-[#1565C0] font-bold text-2xl mb-2 drop-shadow-sm">
          歡迎回來，監造人員
        </p>
      </div>

      {/* Glass card */}
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-[2.5rem] bg-white/70 dark:bg-slate-900/60 backdrop-blur-2xl shadow-2xl border border-white/40 dark:border-white/5 p-10 flex flex-col items-center text-center hover:shadow-[0_0_50px_-12px_rgba(21,101,192,0.3)] hover:-translate-y-1 transition-all duration-500">
        {/* Icon — 使用 fence（工地護欄）符合工程監造語意 */}
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#1565C0] shadow-lg shadow-[#1565C0]/30 text-white">
          <span className="material-icons-round text-4xl">fence</span>
        </div>

        {/* Title */}
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white uppercase">
          RT PMIS
        </h1>
        <p className="mb-4 text-sm font-semibold text-slate-400 dark:text-slate-500 tracking-wide uppercase">
          Enterprise Project Control
        </p>
        <p className="mb-8 text-xs text-slate-400 dark:text-slate-600">
          睿泰工程監造管理系統
        </p>

        {/* CTA */}
        <Link
          href="/projects"
          className="group relative flex w-full items-center justify-center overflow-hidden rounded-xl bg-slate-900 dark:bg-white px-6 py-4 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg"
        >
          <span className="mr-2 text-base font-bold text-white dark:text-slate-900">
            進入系統
          </span>
          <span className="material-icons-round text-white dark:text-slate-900 group-hover:translate-x-1 transition-transform">
            arrow_forward
          </span>
        </Link>
      </div>

      {/* Footer */}
      <footer className="mt-12 relative z-10 text-center opacity-70">
        <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">
          RT PMIS © 2025 · 睿泰工程顧問有限公司
        </p>
      </footer>
    </div>
  );
}
