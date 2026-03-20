// app/layout.tsx
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import Header from "@/components/Header";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mini-tools-rho.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "mini-tools | 個人投資家向けミニツール集",
    template: "%s",
  },
  description:
    "文字数カウント、合計計算、株主優待期限管理、優待銘柄メモをブラウザで使える無料ミニツール集。データは端末内に保存。",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "mini-tools | 個人投資家向けミニツール集",
    description:
      "文字数カウント、合計計算、株主優待期限管理、優待銘柄メモをブラウザで使える無料ミニツール集。",
    url: "/",
    siteName: "mini-tools",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "mini-tools | 個人投資家向けミニツール集",
    description:
      "文字数カウント、合計計算、株主優待期限管理、優待銘柄メモをブラウザで使える無料ミニツール集。",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        {GA_ID ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}');
              `}
            </Script>
          </>
        ) : null}
      </head>

      <body style={{ margin: 0 }}>
        <Header />
        {children}
      </body>
    </html>
  );
}
