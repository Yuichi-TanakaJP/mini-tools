import { isObject, type Workspace } from "./contracts";
import { canonical, collections, rowKey, validateExportWorkspace, type Collection } from "./transfer";

export type Snapshot = Pick<Workspace, Collection>;
export type Change = { id: string; action: "add" | "delete" | "change"; before: Record<string, unknown> | null; after: Record<string, unknown> | null };
export interface RestorePreview {
  schema_version: 1; plan_id: string; replayed: boolean; expires_at: string;
  before: Snapshot; after: Snapshot; changes: Record<Collection, Change[]>; confirmation_hash: string;
}
export interface RestoreReceipt {
  schema_version: 1; plan_id: string; replayed: boolean; verified: true; after: Snapshot; applied_at: string;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid = () => { throw new Error("復元APIの応答を検証できません。プランIDで結果を再確認してください。"); };
function date(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}
export function snapshotWorkspace(raw: unknown, at = new Date().toISOString()): Workspace {
  if (!isObject(raw) || Object.keys(raw).length !== collections.length || collections.some(k => !Array.isArray(raw[k]))) return invalid();
  return validateExportWorkspace({ ...raw, schema_version: 1, selected_month: 1, as_of: at,
    counts: { ...Object.fromEntries(collections.map(k => [k, (raw[k] as unknown[]).length])), effective_selections: 0 }, effective_selections: [] });
}
export function snapshotOf(w: Workspace): Snapshot {
  return Object.fromEntries(collections.map(k => [k, w[k]])) as Snapshot;
}
export function snapshotChanges(before: Snapshot, after: Snapshot): Record<Collection, Change[]> {
  return Object.fromEntries(collections.map(k => {
    const b = new Map(before[k].map(row => [rowKey(k, row), row] as const)), a = new Map(after[k].map(row => [rowKey(k, row), row] as const));
    return [k, [...new Set([...b.keys(), ...a.keys()])].sort().flatMap(id => {
      const old = b.get(id) ?? null, next = a.get(id) ?? null;
      return canonical(old) === canonical(next) ? [] : [{ id, action: !old ? "add" : !next ? "delete" : "change", before: old, after: next }];
    })];
  })) as Record<Collection, Change[]>;
}
export function snapshotsEqual(before: Snapshot, after: Snapshot) {
  return Object.values(snapshotChanges(before, after)).every(rows => !rows.length);
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
}
export function parseRestorePreview(raw: unknown): RestorePreview {
  if (!isObject(raw) || raw.schema_version !== 1 || typeof raw.plan_id !== "string" || !uuid.test(raw.plan_id) ||
      typeof raw.replayed !== "boolean" || !date(raw.expires_at) || typeof raw.confirmation_hash !== "string" || !/^[0-9a-f]{64}$/.test(raw.confirmation_hash) || !isObject(raw.changes)) return invalid();
  const before = snapshotOf(snapshotWorkspace(raw.before)), after = snapshotOf(snapshotWorkspace(raw.after));
  const changes = snapshotChanges(before, after);
  // Check every reported field and row, irrespective of DB collation/array order.
  if (Object.keys(raw.changes).length !== collections.length) return invalid();
  for (const k of collections) {
    const rows = raw.changes[k];
    if (!Array.isArray(rows) || rows.some(row => !isObject(row) || typeof row.id !== "string") ||
        canonical([...rows].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) !== canonical(changes[k])) return invalid();
  }
  // Hash is an opaque server JSONB binding, not the export format's JS checksum.
  return freeze(JSON.parse(JSON.stringify({ ...raw, before, after, changes })) as RestorePreview);
}
export function parseRestoreReceipt(raw: unknown, preview: RestorePreview): RestoreReceipt {
  if (!isObject(raw) || raw.schema_version !== 1 || raw.plan_id !== preview.plan_id || raw.verified !== true ||
      typeof raw.replayed !== "boolean" || !date(raw.applied_at)) return invalid();
  const after = snapshotOf(snapshotWorkspace(raw.after));
  if (!snapshotsEqual(after, preview.after)) return invalid();
  return freeze(JSON.parse(JSON.stringify({ ...raw, after })) as RestoreReceipt);
}
export function parseRestoreStatus(raw: unknown, planId: string) {
  if (!isObject(raw) || raw.schema_version !== 1 || !["prepared", "expired", "applied"].includes(String(raw.status))) return invalid();
  const preview = parseRestorePreview(raw.preview);
  if (preview.plan_id !== planId) return invalid();
  const receipt = raw.receipt === null ? null : parseRestoreReceipt(raw.receipt, preview);
  if ((raw.status === "applied") !== !!receipt) return invalid();
  return { preview, receipt, status: raw.status as "prepared" | "expired" | "applied" };
}
