"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// TOOLS は実行時に変化しないため、グループ化はモジュール初期化時に一度だけ行う
const GROUPS = groupToolsByCategory();

type NavDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export default function NavDrawer({ open, onClose }: NavDrawerProps) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

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

  // 開いたらパネルへフォーカスを移し、閉じたら呼び出し元（ハンバーガー）へ戻す。
  // 検索 input ではなくパネル自体へ当てることで、モバイルで即ソフトキーボードが
  // 立ち上がるのを避ける。完全なフォーカストラップは未実装（decision-log 残課題）。
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      panelRef.current?.focus();
    } else {
      triggerRef.current?.focus?.();
      triggerRef.current = null;
    }
  }, [open]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return null;
    return TOOLS.filter((tool) =>
      `${tool.title} ${tool.short} ${tool.detail}`
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [query]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const handleNavigate = (href: string) => {
    // ホームはツールではないため tool_opened に混ぜない。
    // ツールは ToolGridClient と同じ tool_opened に source を付けて揃える。
    track(href === "/" ? "nav_home_clicked" : "tool_opened", {
      href,
      source: "nav_drawer",
    });
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
        ref={panelRef}
        tabIndex={-1}
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

              {GROUPS.map((group) => (
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
