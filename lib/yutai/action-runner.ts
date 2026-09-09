import type { CommandStep } from "./calendar";
import type { CommandReceipt } from "./contracts";
import { type PreparedCommand, type YutaiRepository } from "./repository";

export interface ActionState {
  status: "idle" | "running" | "paused" | "saved";
  message: string; completed: number; total: number; retryable: boolean; month: number | null;
}
const initial: ActionState = { status: "idle", message: "", completed: 0, total: 0, retryable: false, month: null };
/** Multi-command UI actions are NOT a DB transaction. Preserve each committed step. */
export class YutaiActionRunner {
  private state = initial;
  private listeners = new Set<() => void>();
  private job: { steps: CommandStep[]; tokens: PreparedCommand[]; receipts: CommandReceipt[];
    month: number; epoch: number; refresh: boolean } | null = null;
  constructor(private repository: YutaiRepository) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<ActionState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener());
  }
  async start(steps: CommandStep[], month: number): Promise<void> {
    if (this.job || this.state.status === "running") return;
    const view = this.repository.getSnapshot(month);
    if (!view.data || view.stale) {
      this.publish({ ...initial, message: "最新データを取得してから保存してください。" }); return;
    }
    this.job = { steps, tokens: [], receipts: [], month, epoch: view.sessionRevision, refresh: false };
    this.publish({ ...initial, total: steps.length, month });
    await this.run();
  }
  async retry(): Promise<void> {
    if (this.state.status !== "paused" || !this.state.retryable) return;
    await this.run();
  }
  /** Only definite rejection can be abandoned here. An uncertain request must be resolved. */
  async reviewRejected(): Promise<void> {
    if (this.state.status !== "paused" || this.state.retryable || !this.job) return;
    try {
      await this.repository.load(this.job.month, true);
      this.job = null;
      this.publish({ ...initial, message: "最新データを取得しました。編集を開き直して確認してください。" });
    } catch {
      this.publish({ message: "最新データを取得できません。保存済みの内容は取り消していません。" });
    }
  }
  private async run(): Promise<void> {
    const job = this.job;
    if (!job) return;
    this.publish({ status: "running", message: "Supabaseへ保存しています。", retryable: false });
    try {
      if (job.epoch !== this.repository.getSnapshot(job.month).sessionRevision) throw new Error("AUTH_CHANGED");
      if (job.refresh) {
        await this.repository.load(job.month, true);
        job.refresh = false;
      }
      while (job.receipts.length < job.steps.length) {
        if (job.epoch !== this.repository.getSnapshot(job.month).sessionRevision) throw new Error("AUTH_CHANGED");
        const index = job.receipts.length;
        job.tokens[index] ??= this.repository.prepare(job.steps[index](job.receipts));
        const result = await this.repository.save(job.tokens[index], job.month);
        if ("receipt" in result) {
          job.receipts.push(result.receipt);
          this.publish({ completed: job.receipts.length });
          if (result.status === "saved_refresh_failed") {
            job.refresh = true;
            this.publish({ status: "paused", retryable: true, message: `保存済み ${job.receipts.length}/${job.steps.length}。再取得に失敗しました。保存を重ねず、表示を再取得します。` });
            return;
          }
        } else {
          const uncertain = result.status === "uncertain";
          this.publish({ status: "paused", retryable: uncertain || result.error.kind === "offline",
            message: `保存済み ${job.receipts.length}/${job.steps.length}。${uncertain ? "今回の保存結果は不明です。同じ要求IDで再確認してください。" : result.error.message}` });
          return;
        }
      }
      this.job = null;
      this.publish({ status: "saved", message: "Supabaseへ保存し、表示を更新しました。", retryable: false });
    } catch {
      this.publish({ status: "paused", retryable: job.refresh,
        message: `保存済み ${job.receipts.length}/${job.steps.length}。処理を停止しました。ログイン状態・最新データを確認してください。` });
    }
  }
}

// Keep an unresolved action across client-side history navigation/remounts.
// Scope it to the repository's auth epoch; never reuse it after logout/login.
const runners = new WeakMap<YutaiRepository, { epoch: number; runner: YutaiActionRunner }>();
export function getSessionActionRunner(repository: YutaiRepository, epoch: number) {
  const current = runners.get(repository);
  if (current?.epoch === epoch) return current.runner;
  const runner = new YutaiActionRunner(repository);
  runners.set(repository, { epoch, runner });
  return runner;
}
