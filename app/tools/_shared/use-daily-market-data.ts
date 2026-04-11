"use client";

import { useEffect, useState } from "react";

type DatedDayData = {
  date: string;
};

type UseDailyMarketDataParams<T extends DatedDayData> = {
  activeDate: string;
  initialDayData: T | null;
  routePrefix: string;
  errorMessage?: string;
};

export function useDailyMarketData<T extends DatedDayData>({
  activeDate,
  initialDayData,
  routePrefix,
  errorMessage = "データを読み込めませんでした。時間をおいて再度お試しください。",
}: UseDailyMarketDataParams<T>) {
  const [loadedDays, setLoadedDays] = useState<Record<string, T>>(() => {
    if (!initialDayData) {
      return {};
    }

    return { [initialDayData.date]: initialDayData };
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeDate || loadedDays[activeDate]) {
      setLoadError(null);
      return;
    }

    let active = true;

    async function loadSelectedDate() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const res = await fetch(`${routePrefix}/${activeDate}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const day = (await res.json()) as T;
        if (!active) {
          return;
        }

        setLoadedDays((current) => ({ ...current, [day.date]: day }));
      } catch {
        if (!active) {
          return;
        }

        setLoadError(errorMessage);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadSelectedDate();

    return () => {
      active = false;
    };
  }, [activeDate, errorMessage, loadedDays, routePrefix]);

  return {
    loadedDays,
    isLoading,
    loadError,
    currentDayData: activeDate ? loadedDays[activeDate] ?? null : null,
  };
}
