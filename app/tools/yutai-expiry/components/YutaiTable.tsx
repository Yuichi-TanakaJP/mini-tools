import { useMemo, useState, Fragment } from "react";
import type { BenefitItemV2 } from "../benefits/store";
import styles from "../ToolClient.module.css";

type Bundle = {
  unitValue: number | null;
  qty: number | null;
};

type Grouped = {
  key: string;
  title: string;
  company: string;
  expiry: string | null;
  bundles: Bundle[];
  totalYen: number;
  summary: string;
};

function groupItems(items: BenefitItemV2[]): Grouped[] {
  const map = new Map<string, Grouped>();

  for (const it of items) {
    const key = `${it.company}__${it.title}`;
    const b: Bundle = {
      unitValue: it.amountYen ?? null,
      qty: it.quantity ?? null,
    };

    const bundleValue =
      b.unitValue != null && b.qty != null ? b.unitValue * b.qty : 0;

    const g = map.get(key);
    if (!g) {
      map.set(key, {
        key,
        title: it.title,
        company: it.company,
        expiry: it.expiresOn ?? null,
        bundles: [b],
        totalYen: bundleValue,
        summary: "sum",
      });
    } else {
      g.bundles.push(b);
      g.totalYen += bundleValue;
      if (it.expiresOn) {
        if (!g.expiry || it.expiresOn < g.expiry) g.expiry = it.expiresOn;
      }
    }
  }

  for (const g of map.values()) {
    const parts = g.bundles
      .filter((b) => b.unitValue != null && b.qty != null && b.qty > 0)
      .map((b) => `${b.unitValue!.toLocaleString()}円×${b.qty}`);

    g.summary = parts.length > 0 ? parts.join(" / ") : "—";
  }

  return Array.from(map.values());
}

export function YutaiTable({
  items,
  onDelta,
}: {
  items: BenefitItemV2[];
  onDelta: (key: string, unitValue: number | null, delta: number) => void;
}) {
  const grouped = useMemo(() => groupItems(items), [items]);
  const totalAll = grouped.reduce((sum, g) => sum + (g.totalYen ?? 0), 0);
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({});

  return (
    <div className={styles.tableWrap}>
      <div className={styles.kpiRow}>総残高：¥{totalAll.toLocaleString()}</div>
      <table className={styles.yutaiTable}>
        <thead>
          <tr>
            <th>優待</th>
            <th>企業</th>
            <th>期限</th>
            <th>内訳</th>
            <th style={{ textAlign: "right" }}>操作</th>
          </tr>
        </thead>

        <tbody>
          {grouped.map((g) => (
            // React.Fragment で「親＋子複数行」をまとめる
            <Fragment key={g.key}>
              <tr
                className={styles.parentRow}
                onClick={() =>
                  setOpenKeys((prev) => ({
                    ...prev,
                    [g.key]: !prev[g.key],
                  }))
                }
                style={{ cursor: "pointer" }}
              >
                <td>
                  <span style={{ marginRight: 6 }}>
                    {openKeys[g.key] ? "▼" : "▶"}
                  </span>
                  {g.title}
                </td>
                <td>{g.company}</td>
                <td>{g.expiry ?? "—"}</td>

                <td className={styles.cellRight}>
                  <div style={{ fontWeight: 700 }}>
                    {g.totalYen > 0 ? `¥${g.totalYen.toLocaleString()}` : "—"}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>{g.summary}</div>
                </td>

                {/* ★ここが「操作」列（親は空） */}
                <td />
              </tr>

              {/* 子行（bundle） */}
              {openKeys[g.key] &&
                g.bundles.map((b, idx) => (
                  <tr key={`${g.key}-b-${idx}`}>
                    {/* 4列のうち、左3列をまとめてインデント表示 */}
                    <td colSpan={3} style={{ paddingLeft: 24, opacity: 0.9 }}>
                      └{" "}
                      {b.unitValue != null
                        ? `${b.unitValue.toLocaleString()}円券`
                        : "金額未設定"}
                    </td>

                    {/* ★これを追加：4列目（内訳列） */}
                    <td />

                    <td className={styles.opCell}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation(); // ★ これを追加
                          onDelta(g.key, b.unitValue, -1);
                        }}
                        className={styles.opBtn}
                        aria-label="1枚減らす"
                        disabled={(b.qty ?? 0) <= 0}
                      >
                        −
                      </button>

                      <span
                        style={{
                          display: "inline-block",
                          width: 56,
                          textAlign: "center",
                        }}
                      >
                        {b.qty != null ? `${b.qty}枚` : "—"}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation(); // ★ これを追加
                          onDelta(g.key, b.unitValue, +1);
                        }}
                        className={styles.opBtn}
                        aria-label="1枚増やす"
                      >
                        +
                      </button>
                    </td>
                  </tr>
                ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
