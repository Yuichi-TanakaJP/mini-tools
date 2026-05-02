"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { EdinetDocumentListResponse, EdinetDocItem, EdinetManifest } from "./types";

const DOC_TYPE_LABELS: Record<string, string> = {
  "020": "有価証券届出書",
  "030": "訂正有価証券届出書",
  "040": "有価証券届出書（組込方式）",
  "050": "訂正有価証券届出書（組込方式）",
  "060": "有価証券届出書（参照方式）",
  "070": "訂正有価証券届出書（参照方式）",
  "120": "有価証券報告書",
  "130": "訂正有価証券報告書",
  "140": "半期報告書",
  "150": "訂正半期報告書",
  "160": "四半期報告書",
  "170": "訂正四半期報告書",
  "180": "臨時報告書",
  "190": "訂正臨時報告書",
  "200": "親会社等状況報告書",
  "210": "訂正親会社等状況報告書",
  "220": "自己株券買付状況報告書",
  "230": "訂正自己株券買付状況報告書",
  "240": "内部統制報告書",
  "250": "訂正内部統制報告書",
  "251": "確認書",
  "252": "訂正確認書",
  "270": "大量保有報告書",
  "280": "訂正大量保有報告書",
  "290": "基準日の届出書",
  "300": "株券等の取引に関する報告書",
  "310": "公開買付届出書",
  "320": "訂正公開買付届出書",
  "330": "公開買付撤回届出書",
  "340": "公開買付報告書",
  "350": "訂正公開買付報告書",
  "360": "意見表明報告書",
  "370": "訂正意見表明報告書",
  "380": "対質問回答報告書",
  "390": "訂正対質問回答報告書",
  "400": "計画書",
  "410": "訂正計画書",
};

function getDocTypeLabel(code: string): string {
  return DOC_TYPE_LABELS[code] ?? `書類(${code})`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr.replace(" ", "T"));
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatAsOfDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const DOW = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}（${DOW[d.getDay()]}）`;
}

function DocRow({ item, muted }: { item: EdinetDocItem; muted: boolean }) {
  const edinetUrl = `https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?${item.doc_id},,`;
  const docTypeLabel = getDocTypeLabel(item.doc_type_code);
  const docTitle = item.doc_description || docTypeLabel;

  return (
    <tr
      style={{
        borderBottom: "1px solid var(--color-border)",
        opacity: muted ? 0.45 : 1,
      }}
    >
      <td
        style={{
          padding: "10px 8px",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--color-text)",
          maxWidth: 180,
        }}
      >
        <div
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={item.filer_name}
        >
          {item.filer_name}
        </div>
        {item.sec_code && (
          <a
            href={`https://finance.yahoo.co.jp/quote/${item.sec_code.replace(/0+$/, "")}.T`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              fontSize: 11,
              color: "var(--color-accent)",
              fontWeight: 600,
              marginTop: 3,
              textDecoration: "none",
              padding: "1px 6px",
              borderRadius: 4,
              border: "1px solid var(--color-accent)",
              background: "var(--color-accent-sub)",
            }}
          >
            {item.sec_code.slice(0, 4)} ↗
          </a>
        )}
      </td>
      <td
        style={{
          padding: "10px 8px",
          fontSize: 12,
          color: "var(--color-text-muted)",
          whiteSpace: "nowrap",
          textAlign: "right",
        }}
      >
        {formatDate(item.submit_datetime)}
      </td>
      <td
        style={{
          padding: "10px 8px",
          fontSize: 11,
          color: "var(--color-text-muted)",
          textAlign: "right",
        }}
      >
        <a
          href={edinetUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={docTitle}
          style={{
            display: "inline-block",
            padding: "2px 6px",
            borderRadius: 999,
            background: "var(--color-bg-input)",
            border: "1px solid var(--color-border)",
            color: "inherit",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {docTypeLabel}
        </a>
        {docTitle !== docTypeLabel ? (
          <div
            title={docTitle}
            style={{
              marginTop: 4,
              marginLeft: "auto",
              maxWidth: "100%",
              color: "var(--color-text-muted)",
              fontSize: 10,
              fontWeight: 600,
              lineHeight: 1.35,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {docTitle}
          </div>
        ) : null}
      </td>
    </tr>
  );
}

export default function ToolClient({
  data,
  manifest,
  currentDate,
}: {
  data: EdinetDocumentListResponse | null;
  manifest: EdinetManifest | null;
  currentDate?: string;
}) {
  const router = useRouter();
  const [secCodeOnly, setSecCodeOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState("all");

  const dates = manifest?.dates ?? [];
  const displayDate = data?.as_of_date ?? currentDate ?? "";
  const currentIdx = dates.indexOf(displayDate);
  const prevDate = currentIdx > 0 ? dates[currentIdx - 1] : null;
  const nextDate = currentIdx < dates.length - 1 ? dates[currentIdx + 1] : null;

  const navigate = (date: string) => {
    router.push(`/tools/edinet-documents?date=${date}`);
  };

  const docTypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of data?.items ?? []) {
      counts.set(item.doc_type_code, (counts.get(item.doc_type_code) ?? 0) + 1);
    }
    return counts;
  }, [data?.items]);

  const topDocTypes = useMemo(() => {
    return [...docTypeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code]) => code);
  }, [docTypeCounts]);

  const filteredItems = useMemo(() => {
    return (data?.items ?? []).filter((item) => {
      if (secCodeOnly && !item.sec_code) return false;
      if (docTypeFilter !== "all" && item.doc_type_code !== docTypeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !item.filer_name.toLowerCase().includes(q) &&
          !item.doc_description.toLowerCase().includes(q) &&
          !(item.sec_code ?? "").includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [data?.items, secCodeOnly, docTypeFilter, searchQuery]);

  const displayItems = useMemo(
    () => filteredItems.map((item) => ({ item, muted: !secCodeOnly && !item.sec_code })),
    [filteredItems, secCodeOnly],
  );

  const navButtonStyle = (disabled: boolean) => ({
    padding: "4px 10px",
    borderRadius: 6,
    border: "1.5px solid var(--color-border)",
    background: "transparent",
    color: disabled ? "var(--color-text-muted)" : "var(--color-text)",
    fontSize: 16,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.35 : 1,
    lineHeight: 1,
  });

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px 64px" }}>
      {/* ヘッダー */}
      <section style={{ padding: "32px 0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 26 }}>📄</span>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: -0.7 }}>
            EDINET書類一覧
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.7 }}>
          金融庁EDINETに提出された書類を日次で確認できます。有価証券報告書・大量保有報告書などをまとめて表示。
        </p>
      </section>

      {/* 日付・件数サマリー */}
      <section
        style={{
          background: "var(--color-bg-card)",
          borderRadius: 12,
          border: "1px solid var(--color-border)",
          padding: "12px 16px",
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {/* 日付ナビゲーション */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => prevDate && navigate(prevDate)}
            disabled={!prevDate}
            style={navButtonStyle(!prevDate)}
            aria-label="前の日"
          >
            ←
          </button>
          <span style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)", minWidth: 160, textAlign: "center" }}>
            {displayDate ? formatAsOfDate(displayDate) : "—"}
          </span>
          <button
            type="button"
            onClick={() => nextDate && navigate(nextDate)}
            disabled={!nextDate}
            style={navButtonStyle(!nextDate)}
            aria-label="次の日"
          >
            →
          </button>
        </div>

        {data && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 600 }}>総件数</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)" }}>
              {data.total_count.toLocaleString()}件
            </span>
          </div>
        )}
        {data && filteredItems.length !== data.total_count && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 600 }}>表示中</span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: "var(--color-accent)",
              }}
            >
              {filteredItems.length.toLocaleString()}件
            </span>
          </div>
        )}
      </section>

      {/* フィルターバー */}
      {data && <section
        style={{
          background: "var(--color-bg-card)",
          borderRadius: 12,
          border: "1px solid var(--color-border)",
          padding: "12px 16px",
          marginBottom: 14,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {/* 検索 */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="提出者名・書類名・証券コードで検索..."
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1.5px solid var(--color-border)",
            background: "var(--color-bg-input)",
            color: "var(--color-text)",
            fontSize: 13,
            width: "100%",
            boxSizing: "border-box",
            outline: "none",
          }}
        />

        {/* 書類種別タブ */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setDocTypeFilter("all")}
            style={{
              padding: "4px 12px",
              borderRadius: 999,
              border: "1.5px solid",
              borderColor: docTypeFilter === "all" ? "var(--color-accent)" : "var(--color-border)",
              background: docTypeFilter === "all" ? "var(--color-accent-sub)" : "transparent",
              color: docTypeFilter === "all" ? "var(--color-accent)" : "var(--color-text-muted)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            すべて
          </button>
          {topDocTypes.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setDocTypeFilter(code)}
              style={{
                padding: "4px 12px",
                borderRadius: 999,
                border: "1.5px solid",
                borderColor: docTypeFilter === code ? "var(--color-accent)" : "var(--color-border)",
                background: docTypeFilter === code ? "var(--color-accent-sub)" : "transparent",
                color: docTypeFilter === code ? "var(--color-accent)" : "var(--color-text-muted)",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {getDocTypeLabel(code)}
              <span
                style={{
                  marginLeft: 4,
                  fontSize: 10,
                  opacity: 0.7,
                }}
              >
                {docTypeCounts.get(code)}
              </span>
            </button>
          ))}
        </div>

        {/* 証券コードフィルター */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={secCodeOnly}
            onChange={(e) => setSecCodeOnly(e.target.checked)}
            style={{ width: 14, height: 14, cursor: "pointer" }}
          />
          <span style={{ fontSize: 12, color: "var(--color-text-sub)", fontWeight: 600 }}>
            上場企業のみ表示（証券コードあり）
          </span>
        </label>
      </section>}

      {/* テーブル */}
      <section
        style={{
          background: "var(--color-bg-card)",
          borderRadius: 12,
          border: "1px solid var(--color-border)",
          overflow: "hidden",
        }}
      >
        {!data ? (
          <div
            style={{
              padding: "32px 20px",
              textAlign: "center",
              color: "var(--color-text-muted)",
              fontSize: 14,
            }}
          >
            この日付のデータはありません。
          </div>
        ) : filteredItems.length === 0 ? (
          <div
            style={{
              padding: "32px 20px",
              textAlign: "center",
              color: "var(--color-text-muted)",
              fontSize: 14,
            }}
          >
            該当する書類がありません。
          </div>
        ) : (
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                tableLayout: "fixed",
              }}
            >
              <colgroup>
                <col style={{ width: "50%" }} />
                <col style={{ width: "21%" }} />
                <col style={{ width: "29%" }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--color-border-strong)" }}>
                  {[
                    { label: "提出者" },
                    { label: "提出日時" },
                    { label: "種別" },
                  ].map(({ label }) => (
                    <th
                      key={label}
                      style={{
                        padding: "10px 8px",
                        textAlign: label === "提出者" ? "left" : "right",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--color-text-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayItems.map(({ item, muted }, idx) => (
                  <DocRow key={`${item.doc_id}-${idx}`} item={item} muted={muted} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* データ注記 */}
      <p
        style={{
          marginTop: 12,
          fontSize: 11,
          color: "var(--color-text-muted)",
          lineHeight: 1.6,
        }}
      >
        ※ データは金融庁EDINET APIから取得しています。種別のリンクからEDINETの詳細ページへ移動できます。
      </p>
    </main>
  );
}
