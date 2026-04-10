import type { Metadata } from "next";
import { headers } from "next/headers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import PWARegister from "@/app/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "TITAN — 銀行 IT 團隊工作管理系統",
  description: "TITAN 是為銀行內部 IT 團隊設計的一體化工作管理系統",
};

const THEME_SCRIPT = "(function(){try{var t=localStorage.getItem('titan-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}})()";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hdrs = await headers();
  const cspNonce = hdrs.get("x-csp-nonce") ?? undefined;

  return (
    <html
      lang="zh-TW"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#4f46e5" />
        <script nonce={cspNonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={GeistSans.className}>
        {children}
        <Toaster richColors position="top-right" />
        <PWARegister />
      </body>
    </html>
  );
}
