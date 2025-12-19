// app/page.tsx
"use client";

import Link from "next/link";
import { track } from "@/lib/analytics";
import ShareButtons from "@/components/ShareButtons";
import MonetizeBar from "@/components/MonetizeBar";

type ToolItem = {
  title: string;
  description: string;
  href: string;
};

const TOOLS: ToolItem[] = [
  {
    title: "合計計算ツール",
    description:
      "数字を1行ずつ貼るだけで合計（カンマ/円/マイナスもOK）。入力は端末内に保存。",
    href: "/tools/total",
  },
];

export default function HomePage() {
  const onClickTool = (href: string) => {
    track("tool_opened", { href });
  };

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: 20 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, marginBottom: 6 }}>mini-tools</h1>
        <p style={{ marginTop: 0, opacity: 0.8 }}>
          ちょい便利なミニツール集（サクッと使える / シンプル / 速い）
        </p>
      </header>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 14,
          padding: 14,
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 10 }}>
          ツール一覧
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              onClick={() => onClickTool(t.href)}
              style={{
                display: "block",
                padding: 14,
                border: "1px solid #111",
                borderRadius: 14,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700 }}>{t.title}</div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
                {t.description}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                開く →
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 18 }}>
        <ShareButtons text="mini-tools：ちょい便利なミニツール集" />
        <MonetizeBar />
      </section>

      <footer style={{ marginTop: 24, fontSize: 12, opacity: 0.7 }}>
        ※入力データは基本この端末内（ブラウザ）に保存されます。サーバーには送信しません。
      </footer>
    </main>
  );
}
