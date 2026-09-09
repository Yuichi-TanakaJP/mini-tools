import { checkMonth, isObject, parseReceipt, parseWorkspace, type Command, type CommandDraft, type CommandReceipt, type Workspace } from "./contracts";

export type FailureKind = "auth" | "offline" | "conflict" | "rejected" | "unknown";
export class YutaiFailure extends Error {
  constructor(public readonly kind: FailureKind) {
    super({ auth: "ログイン状態が変わりました。再取得してください。", offline: "オフラインでは保存できません。",
      conflict: "別の更新があります。最新データを確認してください。", rejected: "保存要求が拒否されました。入力を確認してください。",
      unknown: "通信結果を確認できません。同じ要求IDで再確認してください。" }[kind]);
  }
}
export function classifyFailure(error: unknown): YutaiFailure {
  if (error instanceof YutaiFailure) return error;
  const code = isObject(error) && typeof error.code === "string" ? error.code : "";
  if (["42501", "PGRST301", "PGRST302", "PGRST303"].includes(code)) return new YutaiFailure("auth");
  if (code === "40001") return new YutaiFailure("conflict");
  if (/^(22|23)/.test(code) || code === "P0002") return new YutaiFailure("rejected");
  return new YutaiFailure("unknown");
}
export interface Transport {
  read(owner: string, month: number, signal: AbortSignal): Promise<unknown>;
  write(owner: string, command: Command, signal: AbortSignal): Promise<unknown>;
}
export interface ViewState {
  readonly sessionRevision: number;
  readonly data: Workspace | null;
  readonly status: "signed_out" | "idle" | "loading" | "ready" | "error";
  readonly stale: boolean;
  readonly fetchedAt: number | null;
  readonly error: YutaiFailure | null;
}
export const EMPTY_STATE: ViewState = Object.freeze({ sessionRevision: 0, data: null, status: "signed_out", stale: true, fetchedAt: null, error: null });
type Entry = { state: ViewState; pending?: Promise<Workspace>; abort?: AbortController; version: number };
export interface PreparedCommand { readonly requestId: string }
type Prepared = { owner: string; epoch: number; command: Command; pending?: Promise<SaveResult> };
export type SaveResult =
  | { status: "saved" | "saved_refresh_failed"; receipt: CommandReceipt }
  | { status: "not_saved" | "uncertain"; error: YutaiFailure };

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

/** One instance per browser runtime. No LocalStorage writes or offline write queue. */
export class YutaiRepository {
  private owner: string | null = null;
  private epoch = 0;
  private entries = new Map<number, Entry>();
  private listeners = new Set<() => void>();
  private prepared = new WeakMap<PreparedCommand, Prepared>();
  constructor(private transport: Transport, private options: {
    now?: () => number; online?: () => boolean; uuid?: () => string; ttlMs?: number; activeMonths?: () => number[];
  } = {}) {}
  private now = () => (this.options.now ?? Date.now)();
  private online = () => (this.options.online ?? (() => true))();
  private emit = () => { for (const listener of this.listeners) listener(); };
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  setOwner(owner: string | null): boolean {
    if (owner === this.owner) return false;
    this.epoch++;
    this.owner = owner;
    for (const entry of this.entries.values()) entry.abort?.abort();
    this.entries.clear();
    this.emit();
    return true;
  }
  private entry(month: number): Entry {
    checkMonth(month);
    let entry = this.entries.get(month);
    if (!entry) {
      entry = { state: { ...EMPTY_STATE, sessionRevision: this.epoch, status: this.owner ? "idle" : "signed_out" }, version: 0 };
      this.entries.set(month, entry);
    }
    return entry;
  }
  getSnapshot = (month: number): ViewState => this.entry(month).state;
  /** Non-secret export provenance; never returns an access token or session object. */
  getIdentity = () => ({ owner: this.owner, sessionRevision: this.epoch });
  private assertOwner(owner: string, epoch: number): void {
    if (!owner || owner !== this.owner || epoch !== this.epoch) throw new YutaiFailure("auth");
  }
  private publish(entry: Entry, patch: Partial<ViewState>): void {
    entry.state = Object.freeze({ ...entry.state, ...patch });
    this.emit();
  }
  invalidate(): void {
    for (const entry of this.entries.values()) {
      entry.version++;
      entry.abort?.abort();
      entry.pending = undefined;
      this.publish(entry, { stale: true, status: entry.state.data ? "ready" : "idle" });
    }
  }
  /** force bypasses freshness, but coalesces an already-current in-flight read. */
  load(month: number, force = false): Promise<Workspace> {
    const entry = this.entry(month), owner = this.owner, epoch = this.epoch;
    if (!owner) return Promise.reject(new YutaiFailure("auth"));
    if (!this.online()) {
      const error = new YutaiFailure("offline");
      this.publish(entry, { stale: true, status: "error", error });
      return Promise.reject(error);
    }
    if (entry.pending) return entry.pending;
    if (!force && entry.state.data && !entry.state.stale && this.now() - entry.state.fetchedAt < (this.options.ttlMs ?? 30_000)) {
      return Promise.resolve(entry.state.data);
    }
    const version = ++entry.version;
    const abort = new AbortController();
    entry.abort = abort;
    this.publish(entry, { status: "loading", error: null, stale: true });
    const pending = (async () => {
      await Promise.resolve(); // Also handle a synchronously throwing transport safely.
      try {
        const raw = await this.transport.read(owner, month, abort.signal);
        this.assertOwner(owner, epoch);
        if (version !== entry.version) throw new YutaiFailure("unknown");
        const data = freeze(parseWorkspace(raw, month));
        this.publish(entry, { data, status: "ready", stale: false, error: null, fetchedAt: this.now() });
        return data;
      } catch (raw) {
        const error = classifyFailure(raw);
        if (epoch === this.epoch && version === entry.version) {
          if (error.kind === "auth") this.setOwner(null);
          else this.publish(entry, { status: "error", error, stale: true });
        }
        throw error;
      } finally {
        if (version === entry.version) entry.pending = undefined;
      }
    })();
    entry.pending = pending;
    return pending;
  }
  prepare(draft: CommandDraft): PreparedCommand {
    if (!this.owner) throw new YutaiFailure("auth");
    if (!Number.isSafeInteger(draft.expected_revision) || draft.expected_revision < 0) throw new YutaiFailure("rejected");
    // JSON snapshot removes caller mutability; request identity and timestamp never change on retry.
    const command = freeze(JSON.parse(JSON.stringify({ ...draft, schema_version: 1,
      request_id: (this.options.uuid ?? (() => crypto.randomUUID()))(), occurred_at: new Date(this.now()).toISOString(), source: "mini_tools" }, (_key, value) => {
      if (value === undefined || (typeof value === "number" && !Number.isFinite(value))) throw new YutaiFailure("rejected");
      return value;
    })) as Command);
    const token = Object.freeze({ requestId: command.request_id });
    this.prepared.set(token, { command, owner: this.owner, epoch: this.epoch });
    return token;
  }
  save(token: PreparedCommand, month: number): Promise<SaveResult> {
    checkMonth(month);
    const prepared = this.prepared.get(token);
    if (!prepared || prepared.owner !== this.owner || prepared.epoch !== this.epoch) {
      return Promise.resolve({ status: "not_saved", error: new YutaiFailure("auth") });
    }
    if (prepared.pending) return prepared.pending;
    if (!this.online()) return Promise.resolve({ status: "not_saved", error: new YutaiFailure("offline") });
    const pending = this.send(prepared, month);
    prepared.pending = pending;
    void pending.finally(() => { prepared.pending = undefined; });
    return pending;
  }
  private async send(prepared: Prepared, month: number): Promise<SaveResult> {
    let receipt: CommandReceipt;
    try {
      const raw = await this.transport.write(prepared.owner, prepared.command, new AbortController().signal);
      // A write may have committed even if auth changed while awaiting it.
      if (prepared.epoch !== this.epoch) return { status: "uncertain", error: new YutaiFailure("auth") };
      receipt = freeze(parseReceipt(raw, prepared.command));
    } catch (raw) {
      const error = classifyFailure(raw);
      if (prepared.epoch === this.epoch) {
        if (error.kind === "auth") this.setOwner(null);
        else {
          this.invalidate();
          if (error.kind === "conflict") await this.load(month, true).catch(() => undefined);
        }
      }
      return { status: error.kind === "unknown" ? "uncertain" : "not_saved", error };
    }
    this.invalidate();
    try {
      await Promise.all([...new Set([month, ...(this.options.activeMonths?.() ?? [])])].map(m => this.load(m, true)));
      return { status: "saved", receipt };
    } catch {
      // Never let a prior account's receipt escape after an account switch.
      if (prepared.epoch !== this.epoch) return { status: "uncertain", error: new YutaiFailure("auth") };
      return { status: "saved_refresh_failed", receipt };
    }
  }
}
