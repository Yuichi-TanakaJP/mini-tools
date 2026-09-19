"use client";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSyncConfigured } from "@/lib/supabase/config";
import { holdingsLabel, isAudience, type Audience } from "./holdings";

export const AUDIENCE_CHANGED = "portfolio-audience-changed";
export function useAudience() {
  const [data, setData] = useState<Audience | null>(null);
  const [status, setStatus] = useState("保有・ウォッチを確認中…");
  useEffect(() => {
    let active = true;
    let request = 0;
    async function refresh() {
      const current = ++request;
      setData(null);
      setStatus("保有・ウォッチを確認中…");
      try {
        const response = await fetch("/api/stock-notes/audience", { cache: "no-store" });
        if (!active || current !== request) return;
        if (response.status === 401) { setStatus("保有・ウォッチの確認にはログインが必要です。"); return; }
        if (!response.ok) throw new Error("Audience unavailable");
        const next: unknown = await response.json();
        if (!active || current !== request) return;
        if (!isAudience(next)) throw new Error("Invalid audience");
        setData(next);
        setStatus(`${holdingsLabel(next.holdings)} / ${next.watch.state === "ready" ? `ウォッチ ${next.watch.codes.length}銘柄` : "ウォッチを取得できませんでした"}`);
      } catch {
        if (active && current === request) setStatus("保有・ウォッチを取得できませんでした。対象0件とは判定していません。");
      }
    }
    const reload = () => { void refresh(); };
    const auth = isSyncConfigured() ? createSupabaseBrowserClient().auth.onAuthStateChange(reload) : null;
    window.addEventListener("focus", reload);
    window.addEventListener(AUDIENCE_CHANGED, reload);
    reload();
    return () => { active = false; request++; auth?.data.subscription.unsubscribe(); window.removeEventListener("focus", reload); window.removeEventListener(AUDIENCE_CHANGED, reload); };
  }, []);
  const codes = useMemo(() => new Set([
    ...(data?.holdings.state === "ready" ? data.holdings.holdings.map((h) => h.code) : []),
    ...(data?.watch.state === "ready" ? data.watch.codes : []),
  ]), [data]);
  return { codes, status, data };
}
