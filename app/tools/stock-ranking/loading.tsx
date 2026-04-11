export default function Loading() {
  const sk = {
    background: "var(--color-border)",
    animation: "skeleton-pulse 1.4s ease-in-out infinite",
  } as const;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px 64px" }}>
      {/* Header */}
      <div style={{ padding: "32px 0 24px" }}>
        <div style={{ ...sk, width: 160, height: 28, borderRadius: 6, marginBottom: 8 }} />
        <div style={{ ...sk, width: 240, height: 14, borderRadius: 4 }} />
      </div>

      {/* Date nav: ← date select → */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginBottom: 16,
      }}>
        <div style={{ ...sk, width: 34, height: 34, borderRadius: 999 }} />
        <div style={{ ...sk, width: 160, height: 34, borderRadius: 8 }} />
        <div style={{ ...sk, width: 34, height: 34, borderRadius: 999 }} />
      </div>

      {/* Market tabs: プライム / スタンダード / グロース */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {[88, 108, 80].map((w, i) => (
          <div key={i} style={{ ...sk, width: w, height: 32, borderRadius: 8 }} />
        ))}
      </div>

      {/* Ranking tabs: 値上がり率 / 値下がり率 / 売買高 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[92, 96, 72].map((w, i) => (
          <div key={i} style={{ ...sk, width: w, height: 32, borderRadius: 8 }} />
        ))}
      </div>

      {/* Ranking table */}
      <div style={{
        borderRadius: 12,
        border: "1px solid var(--color-border)",
        background: "var(--color-bg-card)",
        overflow: "hidden",
      }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderBottom: i < 9 ? "1px solid var(--color-border)" : "none",
          }}>
            <div style={{ ...sk, width: 24, height: 16, borderRadius: 4, flexShrink: 0 }} />
            <div style={{ ...sk, flex: 1, height: 16, borderRadius: 4 }} />
            <div style={{ ...sk, width: 60, height: 16, borderRadius: 4, flexShrink: 0 }} />
            <div style={{ ...sk, width: 60, height: 16, borderRadius: 4, flexShrink: 0 }} />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
