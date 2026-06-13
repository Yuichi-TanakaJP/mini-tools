"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./MobileBottomNav.module.css";

const ITEMS = [
  { href: "/", label: "ホーム", exact: true },
  { href: "/tools/my-stocks", label: "マイ銘柄", exact: false },
  { href: "/tools/yutai-candidates", label: "優待", exact: false },
  { href: "/tools/earnings-calendar", label: "カレンダー", exact: false },
  { href: "/tools/disclosure-radar", label: "開示", exact: false },
] as const;

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="スマートフォン用メインナビゲーション">
      {ITEMS.map((item) => {
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
