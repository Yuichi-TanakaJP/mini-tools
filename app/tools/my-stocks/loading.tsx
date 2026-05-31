export default function Loading() {
  const sk = {
    background: "var(--color-border)",
    animation: "skeleton-pulse 1.4s ease-in-out infinite",
  } as const;

  return (
    <main style={{ minHeight: "100vh", padding: "24px 16px 96px" }}>
      <div style={{ width: "100%", maxWidth: 760, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ ...sk, width: 180, height: 24, borderRadius: 6 }} />
          <div style={{ ...sk, width: "80%", height: 13, borderRadius: 4 }} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ ...sk, width: 90, height: 32, borderRadius: 8 }} />
          <div style={{ ...sk, width: 80, height: 32, borderRadius: 8 }} />
        </div>
        <div style={{ ...sk, width: "100%", height: 42, borderRadius: 8 }} />
        <div style={{ display: "grid", gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ ...sk, width: "100%", height: 92, borderRadius: 10 }} />
          ))}
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
