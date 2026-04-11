export default function Loading() {
  const sk = {
    background: "var(--color-border)",
    animation: "skeleton-pulse 1.4s ease-in-out infinite",
  } as const;

  return (
    <main style={{ minHeight: "100vh", padding: "18px 12px 56px" }}>
      <div style={{ width: "100%", maxWidth: 440, margin: "0 auto", padding: "0 8px 24px" }}>
        {/* Hero block */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ ...sk, display: "inline-block", width: 110, height: 20, borderRadius: 999, marginBottom: 10 }} />
          <div style={{ ...sk, width: 140, height: 24, borderRadius: 6, marginBottom: 8 }} />
          <div style={{ ...sk, width: "90%", height: 13, borderRadius: 4 }} />
        </div>

        {/* Market tab row: 国内 / 海外 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 12 }}>
          {[0, 1].map((i) => (
            <div key={i} style={{ ...sk, height: 52, borderRadius: 16 }} />
          ))}
        </div>

        {/* Calendar card */}
        <div style={{
          background: "rgba(255,255,255,0.8)",
          borderRadius: 22,
          padding: 16,
          boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
          border: "1px solid rgba(15,23,42,0.04)",
        }}>
          {/* Month nav: ‹ YYYY年M月 › */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ ...sk, width: 38, height: 38, borderRadius: 999 }} />
            <div style={{ ...sk, width: 110, height: 18, borderRadius: 6 }} />
            <div style={{ ...sk, width: 38, height: 38, borderRadius: 999 }} />
          </div>

          {/* Week header: SUN MON TUE WED THU FRI SAT */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={{ ...sk, height: 20, borderRadius: 4, opacity: 0.5 }} />
            ))}
          </div>

          {/* Calendar grid: 5 rows × 7 cols */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} style={{ ...sk, height: 42, borderRadius: 6 }} />
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
