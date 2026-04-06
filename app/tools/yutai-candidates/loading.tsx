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
          width: 200,
          height: 14,
          borderRadius: 6,
          background: "var(--color-border)",
          animation: "skeleton-pulse 1.4s ease-in-out infinite",
        }} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[56, 56, 56, 56].map((w, i) => (
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
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 10,
      }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{
            borderRadius: 10,
            border: "1px solid var(--color-border)",
            background: "var(--color-bg-card)",
            padding: "12px 14px",
          }}>
            <div style={{
              width: 40,
              height: 12,
              borderRadius: 4,
              background: "var(--color-border)",
              marginBottom: 8,
              animation: "skeleton-pulse 1.4s ease-in-out infinite",
            }} />
            <div style={{
              width: "80%",
              height: 16,
              borderRadius: 4,
              background: "var(--color-border)",
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
