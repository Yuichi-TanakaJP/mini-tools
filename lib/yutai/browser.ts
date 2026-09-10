"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { createSupabaseBrowserClient } from "../supabase/client";
import { checkMonth } from "./contracts";
import { EMPTY_STATE } from "./repository";
import { createYutaiRuntime } from "./runtime";
import { RestoreController } from "./restore-controller";
import { getSupabaseEnv } from "../supabase/config";

let runtime: ReturnType<typeof createYutaiRuntime> | undefined;
let restore: { epoch: number; controller: RestoreController } | undefined;
export function getYutaiRestoreController() {
  const repo = getYutaiRepository(), epoch = repo.getIdentity().sessionRevision;
  if (!restore || restore.epoch !== epoch) restore = { epoch, controller: new RestoreController(repo, runtime!.restore, getSupabaseEnv().url) };
  return restore.controller;
}
/** Browser-only shared instance; disabled consumers must not initialize it. */
export function getYutaiRepository() {
  if (typeof window === "undefined") throw new Error("BROWSER_ONLY");
  runtime ??= createYutaiRuntime(createSupabaseBrowserClient(), {
    window, document, online: () => navigator.onLine,
  });
  return runtime.repository;
}
export function useYutaiWorkspace(month: number, enabled = true) {
  checkMonth(month);
  const subscribe = useCallback((listener: () => void) => enabled ? getYutaiRepository().subscribe(listener) : () => {}, [enabled]);
  const getSnapshot = useCallback(() => enabled ? runtime?.repository.getSnapshot(month) ?? EMPTY_STATE : EMPTY_STATE, [month, enabled]);
  const state = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_STATE);
  useEffect(() => {
    if (!enabled) return;
    getYutaiRepository();
    return runtime.watch(month);
  }, [month, enabled]);
  return state;
}
