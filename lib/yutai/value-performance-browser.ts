"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "../supabase/client";
import { parseYutaiValuePerformance, type YutaiValuePerformance } from "./value-performance";

type State = {
  status: "idle" | "signed_out" | "loading" | "ready" | "error";
  data: YutaiValuePerformance | null;
  error: string | null;
};

export function useYutaiValuePerformance(today: string) {
  const [client] = useState<SupabaseClient>(() => createSupabaseBrowserClient());
  const [state, setState] = useState<State>({ status: "idle", data: null, error: null });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: "loading", error: null }));
    try {
      const { data: auth, error: authError } = await client.auth.getSession();
      if (authError || !auth.session) {
        setState({ status: "signed_out", data: null, error: authError?.message ?? null });
        return;
      }
      const { data, error } = await client.rpc("stock_notes_get_yutai_value_performance_v1", { p_today: today });
      if (error) throw error;
      setState({ status: "ready", data: parseYutaiValuePerformance(data), error: null });
    } catch (error) {
      setState((current) => ({ ...current, status: "error", error: error instanceof Error ? error.message : String(error) }));
    }
  }, [client, today]);

  useEffect(() => {
    void load();
    const { data: subscription } = client.auth.onAuthStateChange(() => { void load(); });
    const refresh = () => { if (document.visibilityState !== "hidden" && navigator.onLine) void load(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      subscription.subscription.unsubscribe();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [client, load]);

  return useMemo(() => ({ ...state, reload: load }), [state, load]);
}
