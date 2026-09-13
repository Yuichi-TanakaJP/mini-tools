import type { RewardLedgerV2, RewardV2CommandDraft, RewardV2CommandResult, RewardV2CommandWire } from "./reward-v2-contracts";
import { parseRewardLedgerV2, parseRewardV2CommandResult } from "./reward-v2-contracts";

export type RewardV2State = {
  ownerId: string | null;
  sessionRevision: number;
  status: "idle" | "signed_out" | "loading" | "ready" | "saving" | "error";
  ledger: RewardLedgerV2 | null;
  error: string | null;
  uncertain: RewardV2CommandWire | null;
  today: string | null;
};
export const EMPTY_REWARD_V2_STATE: RewardV2State = { ownerId:null, sessionRevision:0, status:"idle", ledger:null, error:null, uncertain:null, today:null };

type RpcValue = { data: unknown; error: { message?: string; code?: string } | null };
export interface RewardV2ClientLike {
  auth: { getSession(): Promise<{ data: { session: { user: { id: string } } | null } }> };
  rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcValue>;
}

function message(error: unknown) { return error instanceof Error ? error.message : String(error); }
function networkLike(error: unknown) { const m = message(error).toLowerCase(); return m.includes("fetch") || m.includes("network") || m.includes("timeout") || m.includes("failed"); }
function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  const bytes = new Uint8Array(16); crypto.getRandomValues(bytes); bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, b => b.toString(16).padStart(2,"0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
async function withTimeout<T>(value: PromiseLike<T>, milliseconds = 15_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(value),
      new Promise<T>((_resolve,reject)=>{ timer=setTimeout(()=>reject(new Error("RPC_TIMEOUT")),milliseconds); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

export class RewardV2Repository {
  #state: RewardV2State = EMPTY_REWARD_V2_STATE;
  #listeners = new Set<() => void>();
  #client: RewardV2ClientLike;
  constructor(client: RewardV2ClientLike) { this.#client = client; }
  subscribe = (listener: () => void) => { this.#listeners.add(listener); return () => this.#listeners.delete(listener); };
  getSnapshot = () => this.#state;
  #emit(next: RewardV2State) { this.#state = next; this.#listeners.forEach(l => l()); }
  setIdentity(ownerId: string | null, sessionRevision: number) {
    if (ownerId === this.#state.ownerId && sessionRevision === this.#state.sessionRevision) return;
    this.#emit({ ...EMPTY_REWARD_V2_STATE, ownerId, sessionRevision, status: ownerId ? "idle" : "signed_out" });
  }
  async #assertOwner(ownerId: string, revision: number) {
    const { data } = await this.#client.auth.getSession();
    if (this.#state.ownerId !== ownerId || this.#state.sessionRevision !== revision || data.session?.user.id !== ownerId) throw new Error("SESSION_CHANGED");
  }
  async load(today: string) {
    const { ownerId, sessionRevision } = this.#state;
    if (!ownerId) { this.#emit({ ...this.#state, status:"signed_out", ledger:null, error:null, today }); return; }
    this.#emit({ ...this.#state, status:"loading", error:null, today });
    try {
      await this.#assertOwner(ownerId, sessionRevision);
      const { data, error } = await withTimeout(this.#client.rpc("stock_notes_get_yutai_reward_ledger_v2", { p_today: today }));
      if (error) throw new Error(error.code ? `${error.code}:${error.message ?? "RPC_ERROR"}` : error.message ?? "RPC_ERROR");
      await this.#assertOwner(ownerId, sessionRevision);
      const ledger = parseRewardLedgerV2(data);
      this.#emit({ ownerId, sessionRevision, status:"ready", ledger, error:null, uncertain:null, today });
    } catch (e) {
      if (message(e)==="SESSION_CHANGED") return;
      if (this.#state.ownerId===ownerId && this.#state.sessionRevision===sessionRevision) this.#emit({ ...this.#state, status:"error", error:message(e), ledger:null });
    }
  }
  async save(draft: RewardV2CommandDraft, requestId?: string): Promise<RewardV2CommandResult | null> {
    const { ownerId, sessionRevision, today } = this.#state;
    if (!ownerId) throw new Error("AUTH_REQUIRED");
    const wire: RewardV2CommandWire = { ...draft, schema_version:2, request_id:requestId ?? uuid(), occurred_at:new Date().toISOString(), source:"mini_tools" };
    this.#emit({ ...this.#state, status:"saving", error:null, uncertain:null });
    try {
      await this.#assertOwner(ownerId, sessionRevision);
      const { data, error } = await withTimeout(this.#client.rpc("stock_notes_record_yutai_v2_command", { p_input: wire }));
      if (error) throw new Error(error.code ? `${error.code}:${error.message ?? "RPC_ERROR"}` : error.message ?? "RPC_ERROR");
      await this.#assertOwner(ownerId, sessionRevision);
      const result = parseRewardV2CommandResult(data);
      if (today) await this.load(today);
      return result;
    } catch (e) {
      if (message(e)==="SESSION_CHANGED") return null;
      if (this.#state.ownerId===ownerId && this.#state.sessionRevision===sessionRevision) {
        this.#emit({ ...this.#state, status:"error", error:message(e), uncertain:networkLike(e) ? wire : null });
      }
      return null;
    }
  }
  async retryUncertain() {
    const wire = this.#state.uncertain;
    if (!wire) return null;
    const { schema_version: _sv, request_id, occurred_at: _at, source: _source, ...draft } = wire;
    return this.save(draft, request_id);
  }
}
