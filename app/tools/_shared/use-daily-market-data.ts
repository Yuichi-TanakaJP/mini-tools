"use client";

import { useCallback, useEffect, useState } from "react";
import { readNavigationJson } from "@/lib/navigation-read";

type DatedDayData = { date: string };
type UseDailyMarketDataParams<T extends DatedDayData> = {
  activeDate: string; initialDayData: T | null; routePrefix: string; errorMessage?: string;
};
export function useDailyMarketData<T extends DatedDayData>({ activeDate, initialDayData, routePrefix,
  errorMessage = "データを読み込めませんでした。時間をおいて再度お試しください。",
}: UseDailyMarketDataParams<T>) {
  const [loadedDays, setLoadedDays] = useState<Record<string, T>>(() => initialDayData ? { [initialDayData.date]: initialDayData } : {});
  const [lastGood, setLastGood] = useState<T | null>(initialDayData);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [observedDate, setObservedDate] = useState(activeDate);
  const storeDayData = useCallback((day: T) => {
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
  const loadError = !cached && failure?.key === key ? failure.message : null;
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
  const currentDayData = activeDate ? loadedDays[activeDate] ?? lastGood : null;
  return { loadedDays, isLoading, loadError, currentDayData, storeDayData,
    isPreviousData: currentDayData !== null && currentDayData.date !== activeDate,
    retry: () => setAttempt(value => value + 1),
  };
}
