"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CATEGORY_LABELS,
  TOOLS,
  groupToolsByCategory,
  type ToolItem,
} from "@/lib/tools-catalog";
import { track } from "@/lib/analytics";
import styles from "./NavDrawer.module.css";

type NavDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export default function NavDrawer({ open, onClose }: NavDrawerProps) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  const handleClose = useCallback(() => {
    setQuery("");
    onClose();
  }, [onClose]);

  // 開いている間は body のスクロールをロックし、Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, handleClose]);

  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalizedQuery) return null;
    return TOOLS.filter((tool) =>
      `${tool.title} ${tool.short} ${tool.detail}`
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [normalizedQuery]);

  const groups = useMemo(() => groupToolsByCategory(), []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const handleNavigate = (href: string) => {
    track("nav_drawer_opened_tool", { href });
    handleClose();
  };

  const renderItem = (tool: ToolItem) => {
    const active = isActive(tool.href);
    return (
      <Link
        key={tool.href}
        href={tool.href}
        className={`${styles.item} ${active ? styles.itemActive : ""}`}
        aria-current={active ? "page" : undefined}
        onClick={() => handleNavigate(tool.href)}
      >
        <span className={styles.itemIcon} aria-hidden="true">
          {tool.icon}
        </span>
        <span className={styles.itemLabel}>{tool.title}</span>
      </Link>
    );
  };

  return (
    <>
      <div
        className={`${styles.overlay} ${open ? styles.overlayOpen : ""}`}
        onClick={handleClose}
        aria-hidden="true"
      />
      <aside
        className={`${styles.panel} ${open ? styles.panelOpen : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="ツールメニュー"
        inert={!open}
      >
        <div className={styles.header}>
          <Link
            href="/"
            className={styles.brand}
            onClick={() => handleNavigate("/")}
          >
            <span className={styles.brandMini}>mini-</span>
            <span className={styles.brandTools}>tools</span>
          </Link>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={handleClose}
            aria-label="メニューを閉じる"
          >
            ×
          </button>
        </div>

        <div className={styles.searchWrap}>
          <input
            type="search"
            className={styles.search}
            placeholder="ツールを検索…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="ツールを検索"
          />
        </div>

        <nav className={styles.list}>
          {filtered ? (
            filtered.length > 0 ? (
              filtered.map(renderItem)
            ) : (
              <div className={styles.empty}>該当するツールがありません</div>
            )
          ) : (
            <>
              <Link
                href="/"
                className={`${styles.item} ${styles.itemHome} ${
                  isActive("/") ? styles.itemActive : ""
                }`}
                aria-current={isActive("/") ? "page" : undefined}
                onClick={() => handleNavigate("/")}
              >
                <span className={styles.itemIcon} aria-hidden="true">
                  🏠
                </span>
                <span className={styles.itemLabel}>ホーム</span>
              </Link>

              {groups.map((group) => (
                <div key={group.category}>
                  <div className={styles.groupLabel}>
                    {CATEGORY_LABELS[group.category]}
                  </div>
                  {group.tools.map(renderItem)}
                </div>
              ))}
            </>
          )}
        </nav>
      </aside>
    </>
  );
}
