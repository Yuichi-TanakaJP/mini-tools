"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { createSupabaseBrowserClient } from "../supabase/client";
import { getYutaiRepository } from "./browser";
import { EMPTY_REWARD_V2_STATE, RewardV2Repository } from "./reward-v2-repository";

let repository: RewardV2Repository | undefined;
function getRewardV2Repository() {
  repository ??= new RewardV2Repository(createSupabaseBrowserClient());
  return repository;
}

export function useYutaiRewardLedgerV2(today: string, enabled = true) {
  const repo = useMemo(() => enabled && typeof window !== "undefined" ? getRewardV2Repository() : null, [enabled]);
  const subscribe = useCallback((listener: () => void) => repo ? repo.subscribe(listener) : () => {}, [repo]);
  const getSnapshot = useCallback(() => repo ? repo.getSnapshot() : EMPTY_REWARD_V2_STATE, [repo]);
  const state = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_REWARD_V2_STATE);
  useEffect(() => {
    if (!repo || !enabled) return;
    const legacy = getYutaiRepository();
    const syncIdentity = () => {
      const identity = legacy.getIdentity();
      repo.setIdentity(identity.ownerId, identity.sessionRevision);
    };
    syncIdentity();
    const unsubscribe = legacy.subscribe(syncIdentity);
    return unsubscribe;
  }, [repo, enabled]);
  useEffect(() => {
    if (!repo || !enabled || !state.ownerId) return;
    void repo.load(today);
  }, [repo, enabled, state.ownerId, state.sessionRevision, today]);
  return { state, repository: repo };
}
