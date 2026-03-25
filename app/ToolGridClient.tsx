// app/ToolGridClient.tsx
"use client";

import Link from "next/link";
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

export default function ToolGridClient({ tools }: Props) {
  const onOpen = (href: string) => {
    track("tool_opened", { href });
  };

  return (
    <>
      <div className="tool-grid">
        {tools.map((t) =>
          t.disabled ? (
            <div key={t.href} className="tool-card tool-card--disabled">
              <div className="tool-card__icon">{t.icon}</div>
              <div className="tool-card__body">
                <div className="tool-card__title">{t.title}</div>
                <div className="tool-card__desc">{t.detail}</div>
              </div>
              <div className="tool-card__badge">{t.statusLabel ?? "準備中"}</div>
            </div>
          ) : (
            <Link
              key={t.href}
              href={t.href}
              onClick={() => onOpen(t.href)}
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
      `}</style>
    </>
  );
}
