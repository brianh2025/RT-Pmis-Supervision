import type { Metadata } from "next";
import { Public_Sans, Noto_Sans_TC } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const notoSansTC = Noto_Sans_TC({
  variable: "--font-noto-sans-tc",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "RT PMIS - 睿泰工程監造管理系統",
  description: "睿泰工程顧問有限公司 · 工程監造管理平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/icon?family=Material+Icons+Round|Material+Icons+Outlined"
        />
      </head>
      <body
        className={`${publicSans.variable} ${notoSansTC.variable} font-[var(--font-public-sans)] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
