"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "../supabase/client";
import { parseYutaiRewardHistory, type YutaiRewardHistory } from "./reward-history";

type State = { status:"idle"|"signed_out"|"loading"|"ready"|"error"; data:YutaiRewardHistory|null; error:string|null };

export function useYutaiRewardHistory(limit = 200) {
  const [client] = useState<SupabaseClient>(() => createSupabaseBrowserClient());
  const [state,setState] = useState<State>({status:"idle",data:null,error:null});
  const load = useCallback(async () => {
    setState(current => ({...current,status:"loading",error:null}));
    try {
      const {data:auth,error:authError} = await client.auth.getSession();
      if (authError || !auth.session) { setState({status:"signed_out",data:null,error:authError?.message??null}); return; }
      const {data,error} = await client.rpc("stock_notes_get_yutai_reward_history_v1",{p_limit:limit,p_before:null});
      if (error) throw error;
      setState({status:"ready",data:parseYutaiRewardHistory(data),error:null});
    } catch (error) {
      setState(current => ({...current,status:"error",error:error instanceof Error?error.message:String(error)}));
    }
  },[client,limit]);

  useEffect(() => {
    void load();
    const {data:subscription} = client.auth.onAuthStateChange(() => { void load(); });
    const refresh = () => { if (document.visibilityState !== "hidden" && navigator.onLine) void load(); };
    window.addEventListener("focus",refresh); window.addEventListener("online",refresh); document.addEventListener("visibilitychange",refresh);
    return () => { subscription.subscription.unsubscribe(); window.removeEventListener("focus",refresh); window.removeEventListener("online",refresh); document.removeEventListener("visibilitychange",refresh); };
  },[client,load]);

  return useMemo(() => ({...state,reload:load}),[state,load]);
}
