export default function Loading() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 16px 64px" }}>
      <div style={{ padding: "32px 0 24px" }}>
        <div style={{
          width: 160,
          height: 28,
          borderRadius: 6,
          background: "var(--color-border)",
          marginBottom: 8,
          animation: "skeleton-pulse 1.4s ease-in-out infinite",
        }} />
        <div style={{
          width: 220,
          height: 14,
          borderRadius: 6,
          background: "var(--color-border)",
          animation: "skeleton-pulse 1.4s ease-in-out infinite",
        }} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[100, 80].map((w, i) => (
          <div key={i} style={{
            width: w,
            height: 32,
            borderRadius: 8,
            background: "var(--color-border)",
            animation: "skeleton-pulse 1.4s ease-in-out infinite",
          }} />
        ))}
      </div>

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
            <div style={{
              width: 24,
              height: 16,
              borderRadius: 4,
              background: "var(--color-border)",
              flexShrink: 0,
              animation: "skeleton-pulse 1.4s ease-in-out infinite",
            }} />
            <div style={{
              flex: 1,
              height: 16,
              borderRadius: 4,
              background: "var(--color-border)",
              animation: "skeleton-pulse 1.4s ease-in-out infinite",
            }} />
            <div style={{
              width: 64,
              height: 16,
              borderRadius: 4,
              background: "var(--color-border)",
              flexShrink: 0,
              animation: "skeleton-pulse 1.4s ease-in-out infinite",
            }} />
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
