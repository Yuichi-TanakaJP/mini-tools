// components/ShareButtons.tsx
import { track } from "@/lib/analytics";

export default function ShareButtons({ text }: { text: string }) {
  const shareToX = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const intent = `https://x.com/intent/tweet?text=${encodeURIComponent(
      text
    )}&url=${encodeURIComponent(url)}`;
    track("share_clicked", { method: "x" });
    window.open(intent, "_blank", "noopener,noreferrer");
  };

  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={shareToX}
        style={{
          padding: "10px 12px",
          border: "1px solid #111",
          borderRadius: 10,
        }}
      >
        𝕏でシェア
      </button>
    </div>
  );
}
