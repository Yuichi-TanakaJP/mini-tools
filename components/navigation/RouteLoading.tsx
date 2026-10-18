"use client";

import { useNavigationActivity } from "./NavigationProvider";

export default function RouteLoading({ label = "画面" }: { label?: string }) {
  useNavigationActivity(true, label);
  return <section className="route-loading" aria-busy="true" role="status" aria-live="polite">
    <h1>{label}を読み込み中…</h1>
    <p>表示の準備をしています。メニューから別の画面にも移動できます。</p>
    <div className="route-loading-skeleton" aria-hidden="true" />
  </section>;
}
