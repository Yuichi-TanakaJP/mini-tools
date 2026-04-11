export default function Loading() {
  const sk = {
    background: "var(--color-border)",
    animation: "skeleton-pulse 1.4s ease-in-out infinite",
  } as const;

  return (
    <main style={{ minHeight: "100vh", padding: "24px 16px 72px" }}>
      <div style={{ width: "100%", maxWidth: 980, margin: "0 auto" }}>
        {/* Hero block */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ ...sk, display: "inline-block", width: 130, height: 22, borderRadius: 999, marginBottom: 12 }} />
          <div style={{ ...sk, width: 220, height: 26, borderRadius: 6, marginBottom: 8 }} />
          <div style={{ ...sk, width: "70%", height: 13, borderRadius: 4 }} />
        </div>

        {/* Panel */}
        <div style={{
          background: "#ffffff",
          borderRadius: 28,
          padding: "20px 20px 24px",
          boxShadow: "0 1px 3px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)",
          border: "1px solid rgba(15,23,42,0.06)",
        }}>
          {/* Month chips */}
          <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
            <div style={{ ...sk, width: 40, height: 11, borderRadius: 3, marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[56, 56, 56, 56, 56, 56].map((w, i) => (
                <div key={i} style={{ ...sk, width: w, height: 32, borderRadius: 999 }} />
              ))}
            </div>
          </div>

          {/* Search bar */}
          <div style={{ ...sk, width: "100%", height: 40, borderRadius: 10, marginBottom: 10 }} />

          {/* Filter selects */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {[160, 140, 120, 120].map((w, i) => (
              <div key={i} style={{ ...sk, width: w, height: 34, borderRadius: 8 }} />
            ))}
          </div>

          {/* Card grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
            gap: 10,
          }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{
                borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.08)",
                borderLeft: "3px solid rgba(15,23,42,0.10)",
                padding: "14px 16px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <div style={{ ...sk, width: 40, height: 11, borderRadius: 3, marginBottom: 6 }} />
                    <div style={{ ...sk, width: 140, height: 16, borderRadius: 4 }} />
                  </div>
                  <div style={{ ...sk, width: 64, height: 32, borderRadius: 8 }} />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ ...sk, width: 60, height: 20, borderRadius: 999 }} />
                  <div style={{ ...sk, width: 80, height: 20, borderRadius: 999 }} />
                </div>
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
