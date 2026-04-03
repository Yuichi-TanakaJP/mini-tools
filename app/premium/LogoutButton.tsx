"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogout() {
    setIsSubmitting(true);

    try {
      await fetch("/api/premium/logout", { method: "POST" });
      router.push("/premium/login");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isSubmitting}
      style={{
        height: 40,
        borderRadius: 999,
        border: "1px solid rgba(15, 23, 42, 0.08)",
        background: "#fff",
        color: "var(--color-text-sub)",
        padding: "0 16px",
        fontWeight: 700,
        cursor: isSubmitting ? "default" : "pointer",
      }}
    >
      {isSubmitting ? "ログアウト中..." : "ログアウト"}
    </button>
  );
}
