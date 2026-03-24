import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "TITAN — 銀行 IT 團隊工作管理系統",
  description: "TITAN 是為銀行內部 IT 團隊設計的一體化工作管理系統",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-TW"
      className={`${GeistSans.variable} ${GeistMono.variable} dark`}
    >
      <body className={GeistSans.className}>{children}</body>
    </html>
  );
}
