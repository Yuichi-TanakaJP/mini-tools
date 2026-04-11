export default function Loading() {
  const sk = {
    background: "var(--color-border)",
    animation: "skeleton-pulse 1.4s ease-in-out infinite",
  } as const;

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "0 16px 64px" }}>
      {/* Header */}
      <div style={{ padding: "32px 0 24px" }}>
        <div style={{ ...sk, width: 180, height: 28, borderRadius: 6, marginBottom: 8 }} />
        <div style={{ ...sk, width: 280, height: 14, borderRadius: 4 }} />
      </div>

      {/* Control card: date nav + summary 2×2 */}
      <div style={{
        background: "#fff",
        border: "1px solid rgba(15,23,42,0.04)",
        borderRadius: 22,
        boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
        padding: 16,
        marginBottom: 16,
      }}>
        {/* Date nav: ← date → */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ ...sk, width: 34, height: 34, borderRadius: 999 }} />
          <div style={{ ...sk, width: 160, height: 34, borderRadius: 8 }} />
          <div style={{ ...sk, width: 34, height: 34, borderRadius: 999 }} />
        </div>

        {/* Summary cards: 2×2 grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 4 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ ...sk, height: 76, borderRadius: 8 }} />
          ))}
        </div>
      </div>

      {/* ImpactMap (treemap) placeholder */}
      <div style={{ ...sk, width: "100%", height: 420, borderRadius: 12, marginBottom: 16 }} />

      {/* Full records table */}
      <div style={{
        borderRadius: 12,
        border: "1px solid var(--color-border)",
        background: "var(--color-bg-card)",
        overflow: "hidden",
      }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderBottom: i < 11 ? "1px solid var(--color-border)" : "none",
          }}>
            <div style={{ ...sk, width: 36, height: 14, borderRadius: 4, flexShrink: 0 }} />
            <div style={{ ...sk, flex: 1, height: 14, borderRadius: 4 }} />
            <div style={{ ...sk, width: 64, height: 14, borderRadius: 4, flexShrink: 0 }} />
            <div style={{ ...sk, width: 64, height: 14, borderRadius: 4, flexShrink: 0 }} />
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
