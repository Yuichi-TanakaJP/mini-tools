export default function Loading() {
  const sk = {
    background: "var(--color-border)",
    animation: "skeleton-pulse 1.4s ease-in-out infinite",
  } as const;

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px 64px" }}>
      {/* Header */}
      <div style={{ padding: "32px 0 24px" }}>
        <div style={{ ...sk, width: 160, height: 28, borderRadius: 6, marginBottom: 8 }} />
        <div style={{ ...sk, width: 220, height: 14, borderRadius: 4 }} />
      </div>

      {/* Date nav card: ← date → */}
      <div style={{
        background: "#fff",
        border: "1px solid rgba(15,23,42,0.04)",
        borderRadius: 22,
        boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
        padding: 16,
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}>
        <div style={{ ...sk, width: 34, height: 34, borderRadius: 999 }} />
        <div style={{ ...sk, width: 160, height: 34, borderRadius: 8 }} />
        <div style={{ ...sk, width: 34, height: 34, borderRadius: 999 }} />
      </div>

      {/* Summary: 上昇業種 / 下落業種 / 変わらず (3 cols) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ ...sk, height: 64, borderRadius: 12 }} />
        ))}
      </div>

      {/* Ranking: 上昇 / 下落 (2 cols) */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 12,
        marginBottom: 16,
      }}>
        {[0, 1].map((col) => (
          <div key={col} style={{
            borderRadius: 12,
            border: "1px solid var(--color-border)",
            background: "var(--color-bg-card)",
            overflow: "hidden",
          }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border)" }}>
              <div style={{ ...sk, width: 100, height: 16, borderRadius: 4 }} />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                borderBottom: i < 4 ? "1px solid var(--color-border)" : "none",
              }}>
                <div style={{ ...sk, width: 24, height: 14, borderRadius: 4, flexShrink: 0 }} />
                <div style={{ ...sk, flex: 1, height: 14, borderRadius: 4 }} />
                <div style={{ ...sk, width: 56, height: 14, borderRadius: 4, flexShrink: 0 }} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Sectors table: 業種 / 変化率 / 値 (3 cols, 10 rows preview) */}
      <div style={{
        borderRadius: 12,
        border: "1px solid var(--color-border)",
        background: "var(--color-bg-card)",
        overflow: "hidden",
      }}>
        {/* Column header row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 80px 80px",
          gap: 12,
          padding: "10px 16px",
          borderBottom: "2px solid var(--color-border)",
        }}>
          <div style={{ ...sk, width: 40, height: 12, borderRadius: 3 }} />
          <div style={{ ...sk, width: 48, height: 12, borderRadius: 3, marginLeft: "auto" }} />
          <div style={{ ...sk, width: 32, height: 12, borderRadius: 3, marginLeft: "auto" }} />
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{
            display: "grid",
            gridTemplateColumns: "1fr 80px 80px",
            alignItems: "center",
            gap: 12,
            padding: "11px 16px",
            borderBottom: i < 9 ? "1px solid var(--color-border)" : "none",
          }}>
            <div style={{ ...sk, height: 14, borderRadius: 4 }} />
            <div style={{ ...sk, width: 60, height: 14, borderRadius: 4, marginLeft: "auto" }} />
            <div style={{ ...sk, width: 44, height: 14, borderRadius: 4, marginLeft: "auto" }} />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </main>
  );
}
