"use client";

import { useEffect, useState } from "react";
import { useNavigationActivity } from "./NavigationProvider";

export default function PendingRegion({ active, label = "データ" }: { active: boolean; label?: string }) {
  useNavigationActivity(active, label);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setSlow(true), 3000);
    return () => { clearTimeout(timer); setSlow(false); };
  }, [active]);
  return active ? <p role="status" aria-live="polite" className="data-pending" aria-busy="true">
    {label}を更新中…{slow ? " 取得に時間がかかっています。" : ""}
  </p> : null;
}
