"use client";

import { useEffect, useState } from "react";
import { readNavigationJson } from "@/lib/navigation-read";
import { acceptInvestorFlowUpdate } from "./live-data";
import type { InvestorFlowPageData } from "./types";

export function useLiveInvestorFlow(initialData: InvestorFlowPageData, start?: string, end?: string) {
  const selection = `${start ?? ""}:${end ?? ""}`;
  const [snapshot, setSnapshot] = useState({ data: initialData, props: initialData, error: false, selection });
  const [checking, setChecking] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Reset only the request snapshot, preserving the display subtree's tabs
  // and expanded details across server-driven week navigation.
  if (snapshot.selection !== selection) {
    setSnapshot({ data: initialData, props: initialData, error: false, selection });
    if (checking) setChecking(false);
    if (attempt) setAttempt(0);
  } else if (snapshot.props !== initialData) {
    setSnapshot(current => {
      try {
        return { ...current, data: acceptInvestorFlowUpdate(current.data, initialData, start, end), props: initialData, error: false };
      } catch {
        return { ...current, props: initialData, error: true };
      }
    });
  }
  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    const refresh = async () => {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      setChecking(true);
      const query = start && end ? `?${new URLSearchParams({ start, end })}` : "";
      try {
        const next = await readNavigationJson<InvestorFlowPageData>(`/tools/investor-flow/data${query}`, { signal: controller.signal, cache: "no-store" });
        if (controller.signal.aborted) return;
        setSnapshot(current => {
          try { return { ...current, data: acceptInvestorFlowUpdate(current.data, next, start, end), error: false }; }
          catch { return { ...current, error: true }; }
        });
      } catch {
        if (!controller.signal.aborted) setSnapshot(current => ({ ...current, error: true }));
      } finally {
        running = false;
        if (!controller.signal.aborted) setChecking(false);
      }
    };
    if (attempt) void refresh();
    const interval = setInterval(() => void refresh(), 60_000);
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { controller.abort(); clearInterval(interval); document.removeEventListener("visibilitychange", visible); };
  }, [start, end, attempt]);
  return { data: snapshot.data, error: snapshot.error, checking, retry: () => setAttempt(value => value + 1) };
}
