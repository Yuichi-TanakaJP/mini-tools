export default function Loading() {
  const sk = {
    background: "var(--color-border)",
    animation: "skeleton-pulse 1.4s ease-in-out infinite",
  } as const;

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "0 16px 64px" }}>
      <section style={{ padding: "32px 0 24px" }}>
        <div style={{ ...sk, width: 240, height: 30, borderRadius: 6, marginBottom: 12 }} />
        <div style={{ ...sk, width: "min(520px, 100%)", height: 16, borderRadius: 4 }} />
      </section>

      <section style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ ...sk, width: 160, height: 38, borderRadius: 8 }} />
        <div style={{ ...sk, width: 84, height: 38, borderRadius: 8 }} />
        <div style={{ ...sk, width: 180, height: 38, borderRadius: 8 }} />
      </section>

      <section
        style={{
          background: "var(--color-bg-card)",
          borderRadius: 12,
          border: "1px solid var(--color-border)",
          overflow: "hidden",
        }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "72px 120px 1fr 120px",
              gap: 12,
              padding: "13px 14px",
              borderBottom: i < 11 ? "1px solid var(--color-border)" : "none",
            }}
          >
            <div style={{ ...sk, height: 16, borderRadius: 4 }} />
            <div style={{ ...sk, height: 16, borderRadius: 4 }} />
            <div style={{ ...sk, height: 16, borderRadius: 4 }} />
            <div style={{ ...sk, height: 16, borderRadius: 4 }} />
          </div>
        ))}
      </section>
    </main>
  );
}
