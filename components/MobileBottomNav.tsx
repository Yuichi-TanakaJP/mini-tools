"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./MobileBottomNav.module.css";

const PUBLIC_ITEMS = [
  { href: "/", label: "ホーム", exact: true },
  { href: "/tools/my-stocks", label: "マイ銘柄", exact: false },
  { href: "/tools/yutai-candidates", label: "優待", exact: false },
  { href: "/tools/earnings-calendar", label: "カレンダー", exact: false },
  { href: "/tools/disclosure-radar", label: "開示", exact: false },
] as const;

const PREMIUM_ITEMS = [
  { href: "/premium", label: "Premium", exact: true },
  { href: "/premium/portfolio", label: "保有分析", exact: false },
  { href: "/premium/market", label: "市場分析", exact: false },
  { href: "/premium/themes", label: "テーマ", exact: false },
  { href: "/", label: "通常ホーム", exact: true },
] as const;

export default function MobileBottomNav() {
  const pathname = usePathname();
  const items = pathname.startsWith("/premium") ? PREMIUM_ITEMS : PUBLIC_ITEMS;

  return (
    <nav className={styles.nav} aria-label="スマートフォン用メインナビゲーション">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.link} ${active ? styles.active : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className={styles.marker} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
