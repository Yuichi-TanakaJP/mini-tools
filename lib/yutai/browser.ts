"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { createSupabaseBrowserClient } from "../supabase/client";
import { checkMonth } from "./contracts";
import { EMPTY_STATE } from "./repository";
import { createYutaiRuntime } from "./runtime";

let runtime: ReturnType<typeof createYutaiRuntime> | undefined;
/** Call from event handlers/effects only. Existing screens do not import this yet. */
export function getYutaiRepository() {
  if (typeof window === "undefined") throw new Error("BROWSER_ONLY");
  runtime ??= createYutaiRuntime(createSupabaseBrowserClient(), {
    window, document, online: () => navigator.onLine,
  });
  return runtime.repository;
}
export function useYutaiWorkspace(month: number) {
  checkMonth(month);
  const subscribe = useCallback((listener: () => void) => getYutaiRepository().subscribe(listener), []);
  const getSnapshot = useCallback(() => runtime?.repository.getSnapshot(month) ?? EMPTY_STATE, [month]);
  const state = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_STATE);
  useEffect(() => {
    getYutaiRepository();
    return runtime.watch(month);
  }, [month]);
  return state;
}
