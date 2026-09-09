import type { SupabaseClient } from "@supabase/supabase-js";
import { checkMonth } from "./contracts";
import { YutaiFailure, YutaiRepository, type Transport } from "./repository";

export interface BrowserEvents {
  window: Pick<Window, "addEventListener" | "removeEventListener">;
  document: Pick<Document, "addEventListener" | "removeEventListener" | "visibilityState">;
  online: () => boolean;
}
/** Uses the existing Auth client, never a service-role client or payload owner ID. */
export function createYutaiRuntime(client: SupabaseClient, browser: BrowserEvents) {
  let owner: string | null = null;
  let generation = 0;
  let disposed = false;
  const watched = new Map<number, number>();
  const transport: Transport = {
    read: (expectedOwner, month, signal) => rpc(expectedOwner, "stock_notes_get_yutai_workspace", { p_month: month }, signal),
    write: (expectedOwner, command, signal) => rpc(expectedOwner, "stock_notes_record_yutai_command", { p_input: command }, signal),
  };
  const repository = new YutaiRepository(transport, { online: browser.online, activeMonths: () => [...watched.keys()] });
  async function rpc(expectedOwner: string, name: string, args: object, signal: AbortSignal) {
    const started = generation;
    const { data, error } = await client.auth.getSession();
    if (error || disposed || started !== generation || expectedOwner !== owner || data.session?.user.id !== expectedOwner) {
      throw new YutaiFailure("auth");
    }
    const abort = new AbortController();
    const onAbort = () => abort.abort();
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) abort.abort();
    const timer = setTimeout(onAbort, 15_000);
    try {
      // Pin this request to the checked session, even if the shared client switches
      // accounts while its asynchronous token provider is running.
      const response = await client.rpc(name, args)
        .setHeader("Authorization", `Bearer ${data.session.access_token}`)
        .abortSignal(abort.signal);
      if (response.error) throw response.error;
      return response.data;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    }
  }
  const refresh = () => {
    if (disposed || !owner || browser.document.visibilityState === "hidden") return;
    for (const month of watched.keys()) void repository.load(month, true).catch(() => undefined);
  };
  // Auth callbacks must remain synchronous; RPC work is deferred outside the auth lock.
  let scheduled: ReturnType<typeof setTimeout> | undefined;
  const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
    if (disposed) return;
    const next = session?.user.id ?? null;
    if (next !== owner) {
      generation++;
      owner = next;
    }
    if (repository.setOwner(next)) {
      clearTimeout(scheduled);
      scheduled = setTimeout(refresh, 0);
    }
  });
  const offline = () => {
    repository.invalidate();
    for (const month of watched.keys()) void repository.load(month).catch(() => undefined);
  };
  browser.window.addEventListener("focus", refresh);
  browser.window.addEventListener("online", refresh);
  browser.window.addEventListener("offline", offline);
  browser.document.addEventListener("visibilitychange", refresh);
  return {
    repository,
    watch(month: number) {
      if (disposed) throw new Error("DISPOSED");
      checkMonth(month);
      watched.set(month, (watched.get(month) ?? 0) + 1);
      void repository.load(month).catch(() => undefined);
      return () => {
        const count = watched.get(month) ?? 0;
        if (count <= 1) watched.delete(month);
        else watched.set(month, count - 1);
      };
    },
    dispose() {
      disposed = true;
      generation++;
      owner = null;
      clearTimeout(scheduled);
      subscription.unsubscribe();
      browser.window.removeEventListener("focus", refresh);
      browser.window.removeEventListener("online", refresh);
      browser.window.removeEventListener("offline", offline);
      browser.document.removeEventListener("visibilitychange", refresh);
      watched.clear();
      repository.setOwner(null);
    },
  };
}
