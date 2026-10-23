"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readNavigationJson } from "@/lib/navigation-read";

type DatedDayData = { date: string; generated_at?: string; observation?: { collected_at?: string | null; generated_at?: string | null } | null };
const snapshotTime = (day: DatedDayData) => Date.parse(day.observation?.collected_at ?? day.observation?.generated_at ?? day.generated_at ?? "");
type UseDailyMarketDataParams<T extends DatedDayData> = {
  activeDate: string; initialDayData: T | null; routePrefix: string; errorMessage?: string; refreshIntervalMs?: number;
};
export function useDailyMarketData<T extends DatedDayData>({ activeDate, initialDayData, routePrefix,
  refreshIntervalMs = 0,
  errorMessage = "データを読み込めませんでした。時間をおいて再度お試しください。",
}: UseDailyMarketDataParams<T>) {
  const [loadedDays, setLoadedDays] = useState<Record<string, T>>(() => initialDayData ? { [initialDayData.date]: initialDayData } : {});
  const acceptedDays = useRef<Record<string, T>>(initialDayData ? { [initialDayData.date]: initialDayData } : {});
  const [lastGood, setLastGood] = useState<T | null>(initialDayData);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [refreshAttempt, setRefreshAttempt] = useState(0);
  const consumedRefresh = useRef(0);
  const [observedDate, setObservedDate] = useState(activeDate);
  const storeDayData = useCallback((day: T) => {
    const previous = acceptedDays.current[day.date];
    if (previous && snapshotTime(day) < snapshotTime(previous)) throw new Error("以前のsnapshotでは表示を更新しません。");
    acceptedDays.current[day.date] = day;
    setLoadedDays(current => ({ ...current, [day.date]: day }));
    setLastGood(day);
    setFailure(previous => previous?.key.startsWith(`${day.date}:`) ? null : previous);
  }, []);
  const key = `${activeDate}:${attempt}`;
  const cached = loadedDays[activeDate];
  if (cached && lastGood !== cached) setLastGood(cached);
  if (observedDate !== activeDate) {
    setObservedDate(activeDate);
    if (failure?.key === key) setFailure(null);
  }
  const loadError = failure?.key === key ? failure.message : null;
  const isLoading = Boolean(activeDate && !cached && !loadError);
  useEffect(() => {
    if (!activeDate || loadedDays[activeDate]) return;
    const controller = new AbortController();
    void readNavigationJson<T>(`${routePrefix}/${activeDate}`, { signal: controller.signal })
      .then(day => {
        if (controller.signal.aborted) return;
        if (day.date !== activeDate) throw new Error("選択日と応答日が一致しません。");
        storeDayData(day);
      })
      .catch(() => { if (!controller.signal.aborted) setFailure({ key, message: errorMessage }); });
    return () => controller.abort();
  }, [activeDate, key, errorMessage, loadedDays, routePrefix, storeDayData]);
  const hasCached = Boolean(cached);
  useEffect(() => {
    if (!refreshIntervalMs || !activeDate || !hasCached) return;
    const controller = new AbortController();
    let running = false;
    const refresh = async () => {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      try {
        const day = await readNavigationJson<T>(`${routePrefix}/${activeDate}`, { signal: controller.signal, cache: "no-store", headers: { "x-market-refresh": "1" } });
        if (controller.signal.aborted) return;
        if (day.date !== activeDate) throw new Error("選択日と応答日が一致しません。");
        storeDayData(day);
      } catch {
        if (!controller.signal.aborted) setFailure({ key: `${activeDate}:${attempt}`, message: "最新データの確認に失敗しました。表示中のデータを保持し、自動で再試行します。" });
      } finally { running = false; }
    };
    if (refreshAttempt !== consumedRefresh.current) {
      consumedRefresh.current = refreshAttempt;
      void refresh();
    }
    const timer = setInterval(() => void refresh(), refreshIntervalMs);
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [activeDate, attempt, refreshAttempt, hasCached, refreshIntervalMs, routePrefix, storeDayData]);
  const currentDayData = activeDate ? loadedDays[activeDate] ?? lastGood : null;
  return { loadedDays, isLoading, loadError, currentDayData, storeDayData,
    isPreviousData: currentDayData !== null && currentDayData.date !== activeDate,
    retry: () => cached ? setRefreshAttempt(value => value + 1) : setAttempt(value => value + 1),
  };
}
