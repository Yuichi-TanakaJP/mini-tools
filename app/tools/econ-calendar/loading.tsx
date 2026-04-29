export default function Loading() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "18px 12px 56px",
        background:
          "radial-gradient(1000px 420px at 20% 0%, rgba(37, 99, 235, 0.08), transparent 58%), #eef2f7",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 580,
          paddingTop: 40,
          textAlign: "center",
          color: "#94a3b8",
          fontSize: 13,
        }}
      >
        読み込み中…
      </div>
    </main>
  );
}
