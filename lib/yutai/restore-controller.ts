import { getSessionActionRunner } from "./action-runner";
import { classifyFailure, YutaiFailure, type YutaiRepository } from "./repository";
import { createWorkspaceExport, parseWorkspaceExport } from "./transfer";
import { parseRestorePreview, parseRestoreReceipt, parseRestoreStatus, snapshotOf, snapshotWorkspace, snapshotsEqual, type RestorePreview, type RestoreReceipt } from "./restore-contracts";
import type { createRestoreTransport } from "./restore-transport";

export interface RestoreState {
  status: "idle" | "busy" | "preview" | "uncertain" | "verified" | "different" | "error";
  message: string; preview: RestorePreview | null; receipt: RestoreReceipt | null;
  planId: string; backupReady: boolean; locked: boolean; appliedAttempt: boolean;
}
const initial: RestoreState = { status: "idle", message: "", preview: null, receipt: null, planId: "", backupReady: false, locked: false, appliedAttempt: false };
/** Session-scoped, survives client navigation; no private payloads in web storage. */
export class RestoreController {
  private state = initial;
  private listeners = new Set<() => void>();
  private release: (() => void) | null = null;
  private identity;
  constructor(private repo: YutaiRepository, private transport: ReturnType<typeof createRestoreTransport>, private project: string, private now = Date.now) {
    this.identity = repo.getIdentity();
    const unsubscribe = repo.subscribe(() => {
      if (!this.valid()) { unsubscribe(); this.release?.(); this.release = null; this.state = initial; this.listeners.forEach(f => f()); }
    });
  }
  private valid = () => { const id = this.repo.getIdentity(); return !!this.identity.owner && id.owner === this.identity.owner && id.sessionRevision === this.identity.sessionRevision; };
  getSnapshot = () => this.state;
  subscribe = (f: () => void) => { this.listeners.add(f); return () => { this.listeners.delete(f); }; };
  private publish(patch: Partial<RestoreState>) { if (this.valid()) { this.state = { ...this.state, ...patch }; this.listeners.forEach(f => f()); } }
  private lock() {
    if (!this.valid()) throw new YutaiFailure("auth");
    const daily = getSessionActionRunner(this.repo, this.identity.sessionRevision).getSnapshot().status;
    if (daily === "running" || daily === "paused") throw new Error("日常の保存が未完了です。元の画面で結果を確定してください。");
    this.release ??= this.repo.acquireMaintenance(this.identity.sessionRevision);
  }
  private unlock() { this.release?.(); this.release = null; this.publish({ locked: false }); }
  reset() {
    if (this.state.status === "busy" || this.state.appliedAttempt && !["verified", "different"].includes(this.state.status)) return;
    this.unlock(); this.publish(initial);
  }
  async preview(text: string, reason: string) {
    if (this.state.status === "busy" || this.state.appliedAttempt || this.state.preview) return;
    try {
      this.lock(); this.publish({ status: "busy", locked: true, message: "変更前データを保全し、差分を検査しています。業務データはまだ変更しません。" });
      const raw = await this.transport.preview(text, this.project, reason, crypto.randomUUID(), this.identity, new AbortController().signal);
      if (!this.valid()) return;
      const preview = parseRestorePreview(raw);
      this.publish({ status: "preview", preview, planId: preview.plan_id, backupReady: false, message: "差分を確認し、変更前バックアップを保存してください。まだ復元していません。" });
    } catch (error) {
      this.unlock(); this.publish({ status: "error", message: error instanceof YutaiFailure ? "プレビューできません。通信・ログイン・復元API設定を確認してください。業務データの復元は実行していません。" : error instanceof Error ? error.message : "プレビューを確認できません。" });
    }
  }
  async backup() {
    const p = this.state.preview;
    if (!p || !this.valid()) throw new YutaiFailure("auth");
    const file = await createWorkspaceExport(snapshotWorkspace(p.before), { owner_id: this.identity.owner!, project_url: this.project }, new Date(this.now()).toISOString());
    const text = JSON.stringify(file); await parseWorkspaceExport(text);
    if (!this.valid() || this.state.preview !== p) throw new YutaiFailure("auth");
    return { text, filename: `mini-tools-yutai-before-${p.plan_id}.json` };
  }
  markBackupDownloaded(planId: string) {
    if (this.state.planId === planId) this.publish({ backupReady: true });
  }
  async apply(planId: string, confirmed: boolean) {
    const p = this.state.preview;
    if (this.state.status !== "preview" || !p || p.plan_id !== planId || !confirmed || !this.state.backupReady) return;
    if (!this.state.appliedAttempt && Date.parse(p.expires_at) <= this.now()) { this.publish({ message: "有効期限が切れました。結果確認またはプレビューのやり直しが必要です。" }); return; }
    try {
      this.lock(); this.publish({ status: "busy", locked: true, appliedAttempt: true, message: "復元中です。応答がなくても失敗とは限りません。この画面で結果を確認してください。" });
      this.repo.invalidate();
      const receipt = parseRestoreReceipt(await this.transport.apply(p.plan_id, p.confirmation_hash, this.identity, new AbortController().signal), p);
      if (!this.valid()) return;
      this.publish({ receipt }); await this.verify();
    } catch (error) {
      if (!this.valid()) return;
      // Even definite rejection of a retry does not prove an earlier attempt failed.
      const kind = classifyFailure(error).kind;
      if (kind === "conflict" || kind === "rejected") {
        this.unlock(); this.publish({ status: "error", appliedAttempt: false, message: "復元要求はDBで拒否されました。今回の適用は行われていません。最新データから差分を確認し直してください。" }); return;
      }
      this.publish({ status: "uncertain", message: "復元結果を確定できません。同じプランの結果を確認してください。新しい復元は開始しません。" });
    }
  }
  async recover(planId: string) {
    if (this.state.status === "busy" || this.state.appliedAttempt && this.state.planId !== planId) return;
    try {
      this.lock(); this.publish({ status: "busy", locked: true, planId, message: "同じプランの結果を取得しています。復元は実行しません。" });
      const result = parseRestoreStatus(await this.transport.get(planId, this.identity, new AbortController().signal), planId);
      if (!this.valid()) return;
      const old = this.state.preview;
      if (old && (old.plan_id !== result.preview.plan_id || old.confirmation_hash !== result.preview.confirmation_hash)) throw new Error("PLAN_CHANGED");
      // Reloaded plans can have an earlier apply still in flight. Resolve that plan,
      // rather than allowing a new restore to race it.
      this.publish({ preview: result.preview, receipt: result.receipt, backupReady: false, appliedAttempt: true });
      if (result.receipt) { this.publish({ appliedAttempt: true }); await this.verify(); }
      else if (result.status === "expired") {
        this.publish({ status: "preview", message: "プランは期限切れです。結果再確認、またはバックアップと差分を確認して同じプランを明示再送してください。DBは適用済みなら記録だけを返し、未適用なら期限切れとして拒否します。" });
      }
      else {
        // A concurrently in-flight apply may finish later. Keep the gate and same plan.
        this.publish({ status: "preview", message: "まだ適用済みの記録はありません。実行中の可能性もあるため、結果再確認または同じプランの明示再実行だけを行ってください。" });
      }
    } catch {
      if (this.state.appliedAttempt) this.publish({ status: "uncertain", message: "結果を取得できません。同じプランIDで再確認してください。" });
      else { this.unlock(); this.publish({ status: "error", message: "プランを取得できません。ID・本人ログイン・通信状態を確認してください。" }); }
    }
  }
  async verify() {
    const receipt = this.state.receipt, p = this.state.preview;
    if (!receipt || !p || !this.valid()) return;
    this.publish({ status: "busy", message: "復元済みの記録を確認しました。DBの全8種類を再取得して照合しています。" });
    try {
      this.repo.invalidate(); const w = await this.repo.load(1, true);
      if (!this.valid()) return;
      if (this.repo.getSnapshot(1).stale || this.repo.getSnapshot(1).data !== w) throw new Error("STALE");
      const equal = snapshotsEqual(snapshotOf(w), p.after);
      this.unlock(); this.publish({ status: equal ? "verified" : "different", message: equal ? "復元完了。DBを再取得し、全8種類・全フィールドの一致を確認しました。" : "復元済みですが、現在DBと差分があります。復元後の別更新の可能性があります。再適用せず、現在DBを出力して確認してください。" });
    } catch { this.publish({ status: "uncertain", message: "復元済みの記録はありますが、再取得・全件照合が未完了です。復元を重ねず結果を再確認してください。" }); }
  }
}
