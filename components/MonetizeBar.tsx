// components/MonetizeBar.tsx
export default function MonetizeBar() {
  const donateUrl = "https://www.buymeacoffee.com/xxxx"; // ←差し替え

  return (
    <div style={{ marginTop: 24, paddingTop: 12, borderTop: "1px solid #ddd" }}>
      <a
        href={donateUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          padding: "10px 12px",
          border: "1px solid #111",
          borderRadius: 10,
        }}
      >
        ☕ 役に立ったらコーヒー1杯お願いします
      </a>
      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
        ※外部サイトでの支援になります
      </div>
    </div>
  );
}
