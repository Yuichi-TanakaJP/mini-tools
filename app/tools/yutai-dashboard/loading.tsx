export default function Loading() {
  const sk = {
    background: "var(--color-border)",
    animation: "skeleton-pulse 1.4s ease-in-out infinite",
  } as const;

  return (
    <main style={{ minHeight: "100vh", padding: "24px 24px 72px" }}>
      <div style={{ width: "100%", maxWidth: 1500, margin: "0 auto" }}>
        {/* Hero block */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ ...sk, display: "inline-block", width: 150, height: 22, borderRadius: 999, marginBottom: 12 }} />
          <div style={{ ...sk, width: 280, height: 26, borderRadius: 6, marginBottom: 8 }} />
          <div style={{ ...sk, width: "50%", height: 13, borderRadius: 4 }} />
        </div>

        {/* Panel */}
        <div style={{
          background: "#ffffff",
          borderRadius: 24,
          padding: "20px 20px 24px",
          boxShadow: "0 1px 3px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)",
          border: "1px solid rgba(15,23,42,0.06)",
        }}>
          {/* Filter bar */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
            {[130, 130, 130, 150, 110, 140, 130, 220].map((w, i) => (
              <div key={i} style={{ ...sk, width: w, height: 52, borderRadius: 10 }} />
            ))}
          </div>

          {/* Table rows */}
          <div style={{ borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", overflow: "hidden" }}>
            <div style={{ ...sk, width: "100%", height: 38 }} />
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "10px 12px", borderTop: "1px solid rgba(15,23,42,0.05)" }}>
                <div style={{ ...sk, width: 48, height: 14, borderRadius: 4 }} />
                <div style={{ ...sk, width: 180, height: 14, borderRadius: 4 }} />
                <div style={{ ...sk, width: 60, height: 14, borderRadius: 4 }} />
                <div style={{ ...sk, width: 90, height: 14, borderRadius: 999 }} />
                <div style={{ ...sk, width: 60, height: 14, borderRadius: 999 }} />
                <div style={{ ...sk, flex: 1, height: 14, borderRadius: 4 }} />
              </div>
            ))}
          </div>
        </div>
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
