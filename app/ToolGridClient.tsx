// app/ToolGridClient.tsx
"use client";

import Link from "next/link";
import type { MouseEvent, PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";

type ToolItem = {
  title: string;
  detail: string;
  href: string;
  icon: string;
  disabled?: boolean;
  statusLabel?: string;
};

type Props = {
  tools: ToolItem[];
};

const ORDER_STORAGE_KEY = "mini_tools_home_tool_order_v1";
const LONG_PRESS_MS = 520;

function readSavedOrder(): string[] {
  try {
    const raw = window.localStorage.getItem(ORDER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

function mergeToolsWithOrder(tools: ToolItem[], order: string[]): ToolItem[] {
  if (order.length === 0) return tools;

  const byHref = new Map(tools.map((tool) => [tool.href, tool]));
  const seen = new Set<string>();
  const ordered = order.flatMap((href) => {
    const tool = byHref.get(href);
    if (!tool || seen.has(href)) return [];
    seen.add(href);
    return [tool];
  });
  const orderedHrefs = new Set(ordered.map((tool) => tool.href));
  const missing = tools.filter((tool) => !orderedHrefs.has(tool.href));

  return [...ordered, ...missing];
}

export default function ToolGridClient({ tools }: Props) {
  const defaultOrder = useMemo(() => tools.map((tool) => tool.href), [tools]);
  const [orderedTools, setOrderedTools] = useState(tools);
  const [isEditing, setIsEditing] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const suppressClickTimerRef = useRef<number | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressNextClickRef = useRef(false);

  useEffect(() => {
    setOrderedTools(mergeToolsWithOrder(tools, readSavedOrder()));
  }, [tools]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
      }
      if (suppressClickTimerRef.current) {
        window.clearTimeout(suppressClickTimerRef.current);
      }
    };
  }, []);

  const clearLongPressTimer = () => {
    if (!longPressTimerRef.current) return;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
    pressStartRef.current = null;
  };

  const startLongPress = (event: PointerEvent, disabled?: boolean) => {
    if (disabled || isEditing || event.pointerType === "mouse") return;

    clearLongPressTimer();
    pressStartRef.current = { x: event.clientX, y: event.clientY };
    longPressTimerRef.current = window.setTimeout(() => {
      setIsEditing(true);
      suppressNextClickRef.current = true;
      suppressClickTimerRef.current = window.setTimeout(() => {
        suppressNextClickRef.current = false;
        suppressClickTimerRef.current = null;
      }, 900);
      longPressTimerRef.current = null;
      pressStartRef.current = null;
    }, LONG_PRESS_MS);
  };

  const cancelLongPressOnMove = (event: PointerEvent) => {
    if (!pressStartRef.current) return;
    const movedX = Math.abs(event.clientX - pressStartRef.current.x);
    const movedY = Math.abs(event.clientY - pressStartRef.current.y);
    if (movedX > 8 || movedY > 8) {
      clearLongPressTimer();
    }
  };

  const onOpen = (event: MouseEvent, href: string) => {
    if (suppressNextClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressNextClickRef.current = false;
      return;
    }

    track("tool_opened", { href });
  };

  const saveOrder = (nextTools: ToolItem[]) => {
    setOrderedTools(nextTools);
    try {
      window.localStorage.setItem(
        ORDER_STORAGE_KEY,
        JSON.stringify(nextTools.map((tool) => tool.href))
      );
    } catch {
      // localStorage が使えない環境でも画面内の並び替えは維持する。
    }
  };

  const moveTool = (href: string, direction: -1 | 1) => {
    const currentIndex = orderedTools.findIndex((tool) => tool.href === href);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedTools.length) return;

    const nextTools = [...orderedTools];
    [nextTools[currentIndex], nextTools[nextIndex]] = [
      nextTools[nextIndex],
      nextTools[currentIndex],
    ];
    saveOrder(nextTools);
  };

  const resetOrder = () => {
    setOrderedTools(tools);
    try {
      window.localStorage.removeItem(ORDER_STORAGE_KEY);
    } catch {
      // localStorage が使えない場合は画面内だけ初期順へ戻す。
    }
  };

  const isCustomOrder =
    orderedTools.length === defaultOrder.length &&
    orderedTools.some((tool, index) => tool.href !== defaultOrder[index]);

  return (
    <>
      <div className="tool-grid-toolbar" aria-label="ツール配置の操作">
        <button
          type="button"
          className="tool-grid-toolbar__button"
          onClick={() => setIsEditing((value) => !value)}
          aria-pressed={isEditing}
        >
          {isEditing ? "完了" : "配置変更"}
        </button>
        <button
          type="button"
          className="tool-grid-toolbar__button tool-grid-toolbar__button--secondary"
          onClick={resetOrder}
          disabled={!isCustomOrder}
        >
          初期順に戻す
        </button>
      </div>

      <div className="tool-grid">
        {orderedTools.map((t, index) =>
          t.disabled ? (
            <div
              key={t.href}
              className="tool-card tool-card--disabled"
              onPointerDown={(event) => startLongPress(event, t.disabled)}
              onPointerMove={cancelLongPressOnMove}
              onPointerUp={clearLongPressTimer}
              onPointerCancel={clearLongPressTimer}
              onPointerLeave={clearLongPressTimer}
              onContextMenu={(event) => {
                if (isEditing) event.preventDefault();
              }}
            >
              <div className="tool-card__icon">{t.icon}</div>
              <div className="tool-card__body">
                <div className="tool-card__title">{t.title}</div>
                <div className="tool-card__desc">{t.detail}</div>
              </div>
              {isEditing ? (
                <MoveControls
                  title={t.title}
                  isFirst={index === 0}
                  isLast={index === orderedTools.length - 1}
                  onMoveUp={() => moveTool(t.href, -1)}
                  onMoveDown={() => moveTool(t.href, 1)}
                />
              ) : (
                <div className="tool-card__badge">{t.statusLabel ?? "準備中"}</div>
              )}
            </div>
          ) : isEditing ? (
            <div key={t.href} className="tool-card tool-card--editing">
              <div className="tool-card__icon">{t.icon}</div>
              <div className="tool-card__body">
                <div className="tool-card__title">{t.title}</div>
                <div className="tool-card__desc">{t.detail}</div>
              </div>
              <MoveControls
                title={t.title}
                isFirst={index === 0}
                isLast={index === orderedTools.length - 1}
                onMoveUp={() => moveTool(t.href, -1)}
                onMoveDown={() => moveTool(t.href, 1)}
              />
            </div>
          ) : (
            <Link
              key={t.href}
              href={t.href}
              onClick={(event) => onOpen(event, t.href)}
              onPointerDown={(event) => startLongPress(event, t.disabled)}
              onPointerMove={cancelLongPressOnMove}
              onPointerUp={clearLongPressTimer}
              onPointerCancel={clearLongPressTimer}
              onPointerLeave={clearLongPressTimer}
              onContextMenu={(event) => {
                if (isEditing || suppressNextClickRef.current) event.preventDefault();
              }}
              className="tool-card tool-card--link"
            >
              <div className="tool-card__icon">{t.icon}</div>
              <div className="tool-card__body">
                <div className="tool-card__title">{t.title}</div>
                <div className="tool-card__desc">{t.detail}</div>
              </div>
              <div className="tool-card__arrow" aria-hidden>→</div>
            </Link>
          )
        )}
      </div>

      <style>{`
        .tool-grid-toolbar {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin: -4px 0 12px;
          flex-wrap: wrap;
        }

        .tool-grid-toolbar__button {
          min-height: 34px;
          border: 1px solid var(--color-accent);
          border-radius: 8px;
          background: var(--color-accent);
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          padding: 7px 12px;
          cursor: pointer;
        }

        .tool-grid-toolbar__button--secondary {
          background: var(--color-bg-card);
          color: var(--color-text-sub);
          border-color: var(--color-border-strong);
        }

        .tool-grid-toolbar__button:disabled {
          opacity: 0.45;
          cursor: default;
        }

        .tool-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        @media (max-width: 560px) {
          .tool-grid {
            grid-template-columns: 1fr;
          }
        }

        .tool-card {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 16px 14px;
          border-radius: 18px;
          border: 1px solid var(--color-border);
          background: var(--color-bg-card);
          box-shadow: 0 4px 16px rgba(15,23,42,0.05);
          text-decoration: none;
          color: inherit;
          transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
          position: relative;
          overflow: hidden;
        }

        .tool-card--link::before {
          content: "";
          position: absolute;
          left: 0;
          top: 12px;
          bottom: 12px;
          width: 3px;
          border-radius: 999px;
          background: var(--color-accent);
          opacity: 0;
          transition: opacity 0.15s;
        }

        .tool-card--disabled {
          opacity: 0.60;
          cursor: default;
        }

        .tool-card--editing {
          cursor: default;
        }

        @media (hover: hover) and (pointer: fine) {
          .tool-card--link:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 32px rgba(15,23,42,0.10);
            border-color: var(--color-border-strong);
          }
          .tool-card--link:hover::before {
            opacity: 1;
          }
          .tool-card--link:hover .tool-card__arrow {
            opacity: 1;
            transform: translateX(2px);
          }
        }

        .tool-card__icon {
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: var(--color-accent-sub);
          border: 1px solid rgba(37,84,255,0.12);
          display: grid;
          place-items: center;
          font-size: 22px;
          line-height: 1;
        }

        .tool-card__body {
          flex: 1;
          min-width: 0;
        }

        .tool-card__title {
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -0.2px;
          color: var(--color-text);
          margin-bottom: 4px;
        }

        .tool-card__desc {
          font-size: 12px;
          color: var(--color-text-muted);
          line-height: 1.55;
        }

        .tool-card__arrow {
          flex-shrink: 0;
          font-size: 16px;
          color: var(--color-text-muted);
          opacity: 0.45;
          transition: opacity 0.15s, transform 0.15s;
          margin-top: 2px;
        }

        .tool-card__badge {
          flex-shrink: 0;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 999px;
          background: var(--color-bg-input);
          border: 1px solid var(--color-border);
          color: var(--color-text-muted);
        }

        .tool-card__controls {
          display: inline-flex;
          flex-shrink: 0;
          gap: 6px;
          margin-top: -2px;
        }

        .tool-card__move {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border: 1px solid var(--color-border-strong);
          border-radius: 8px;
          background: var(--color-bg-input);
          color: var(--color-text-sub);
          font-size: 16px;
          font-weight: 800;
          line-height: 1;
          cursor: pointer;
        }

        .tool-card__move:disabled {
          opacity: 0.35;
          cursor: default;
        }

        @media (max-width: 560px) {
          .tool-grid-toolbar {
            justify-content: stretch;
          }
          .tool-grid-toolbar__button {
            flex: 1;
          }
          .tool-card {
            align-items: center;
          }
          .tool-card__controls {
            flex-direction: column;
          }
        }
      `}</style>
    </>
  );
}

type MoveControlsProps = {
  title: string;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

function MoveControls({
  title,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: MoveControlsProps) {
  return (
    <div className="tool-card__controls" aria-label={`${title}の配置変更`}>
      <button
        type="button"
        className="tool-card__move"
        onClick={onMoveUp}
        disabled={isFirst}
        aria-label={`${title}を前へ移動`}
      >
        ↑
      </button>
      <button
        type="button"
        className="tool-card__move"
        onClick={onMoveDown}
        disabled={isLast}
        aria-label={`${title}を後ろへ移動`}
      >
        ↓
      </button>
    </div>
  );
}
