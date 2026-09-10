import { checkMonth, isObject, parseWorkspace, type Workspace } from "./contracts";
import { YutaiFailure, type YutaiRepository } from "./repository";

export const EXPORT_SCHEMA = "mini-tools-yutai-workspace-export";
export const MAX_EXPORT_BYTES = 10 * 1024 * 1024;
export const collections = ["profiles", "month_states", "cycles", "tags", "profile_tags", "rewards", "reward_events", "selections"] as const;
export type Collection = typeof collections[number];
export const collectionLabels: Record<Collection, string> = { profiles: "銘柄メモ", month_states: "月別設定", cycles: "全年度の仕込み履歴",
  tags: "タグ", profile_tags: "タグ割当", rewards: "優待残高（アーカイブ含む）", reward_events: "残高履歴", selections: "選択（全月・共通）" };
export interface ExportSource { project_url: string; owner_id: string }
export interface WorkspaceExport {
  schema: typeof EXPORT_SCHEMA; version: 1; source: ExportSource; exported_at: string; fetched_at: string;
  coverage: "workspace_current_state"; workspace: Workspace; sha256: string;
}

export function canonical(value: unknown, depth = 0): string {
  if (depth > 32) throw new Error("データの階層が深すぎます。");
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(v => canonical(v, depth + 1)).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k], depth + 1)}`).join(",")}}`;
  throw new Error("JSONに保存できない値があります。");
}
async function digest(value: unknown) {
  const bytes = new TextEncoder().encode(canonical(value));
  if (bytes.length > MAX_EXPORT_BYTES) throw new Error("データが10MBを超えています。");
  const result = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(result), b => b.toString(16).padStart(2, "0")).join("");
}
function checkSource(value: unknown): asserts value is ExportSource {
  if (!isObject(value) || typeof value.project_url !== "string" || typeof value.owner_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.owner_id)) throw new Error("取得元の識別情報が不正です。");
  const url = new URL(value.project_url);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.origin !== value.project_url) throw new Error("取得元URLが不正です。");
}
function checkDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error("取得・出力日時が不正です。");
}
export function rowKey(collection: Collection, row: Record<string, unknown>) {
  return collection === "profile_tags" ? `${row.profile_id}:${row.tag_id}` : String(row.id);
}
export function validateExportWorkspace(raw: unknown): Workspace {
  if (!isObject(raw) || !Number.isInteger(raw.selected_month)) throw new Error("優待データの形式が不正です。");
  checkMonth(raw.selected_month as number);
  const w = parseWorkspace(raw, raw.selected_month as number);
  for (const name of collections) {
    const keys = w[name].map(row => rowKey(name, row));
    if (keys.some(k => !k || k === "undefined") || new Set(keys).size !== keys.length) throw new Error(`${collectionLabels[name]}に重複IDがあります。`);
  }
  const profiles = new Set(w.profiles.map(p => p.id)), tags = new Set(w.tags.map(t => t.id));
  const cycles = new Map(w.cycles.map(c => [c.id, c])), rewards = new Set(w.rewards.map(r => r.id));
  if (w.month_states.some(s => !profiles.has(s.profile_id)) || w.cycles.some(c => !profiles.has(c.profile_id)) ||
      w.profile_tags.some(t => !profiles.has(t.profile_id) || !tags.has(t.tag_id)) ||
      w.rewards.some(r => (r.profile_id !== null && !profiles.has(r.profile_id)) || (r.cycle_id !== null && (!cycles.has(r.cycle_id) || (r.profile_id !== null && cycles.get(r.cycle_id)!.profile_id !== r.profile_id)))) ||
      w.reward_events.some(e => !rewards.has(e.reward_id))) throw new Error("参照先が欠落・不一致のデータがあります。");
  for (const keys of [w.profiles.map(p => p.stock_code), w.month_states.map(s => `${s.profile_id}:${s.entitlement_month}`),
    w.cycles.map(c => `${c.profile_id}:${c.entitlement_year}:${c.entitlement_month}`), w.selections.map(s => `${s.stock_code}:${s.entitlement_month}`)]) {
    if (new Set(keys).size !== keys.length) throw new Error("同一銘柄・対象年月のデータが重複しています。");
  }
  return w;
}
export async function createWorkspaceExport(workspace: Workspace, source: ExportSource, fetchedAt: string, exportedAt = new Date().toISOString()): Promise<WorkspaceExport> {
  checkSource(source); checkDate(fetchedAt); checkDate(exportedAt);
  // Clone first: async hashing must not allow caller mutation to change the exported body.
  const body = JSON.parse(canonical({ schema: EXPORT_SCHEMA, version: 1, source, exported_at: exportedAt, fetched_at: fetchedAt,
    coverage: "workspace_current_state", workspace: validateExportWorkspace(workspace) }));
  return { ...body, sha256: await digest(body) };
}
export async function parseWorkspaceExport(text: string): Promise<WorkspaceExport> {
  if (new TextEncoder().encode(text).length > MAX_EXPORT_BYTES) throw new Error("ファイルが10MBを超えています。");
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("JSONファイルとして読み込めません。"); }
  if (!isObject(raw) || raw.schema !== EXPORT_SCHEMA || raw.version !== 1 || raw.coverage !== "workspace_current_state") throw new Error("優待DBの専用出力形式ではありません。旧端末バックアップは別形式です。");
  checkSource(raw.source); checkDate(raw.exported_at); checkDate(raw.fetched_at);
  validateExportWorkspace(raw.workspace);
  const { sha256, ...body } = raw;
  if (typeof sha256 !== "string" || sha256 !== await digest(body)) throw new Error("ファイルのチェックサムが一致しません。元のファイルからやり直してください。");
  return raw as unknown as WorkspaceExport;
}
export function compareWorkspaceExport(file: WorkspaceExport, current: Workspace, source: ExportSource) {
  checkSource(source);
  if (file.source.owner_id !== source.owner_id || file.source.project_url !== source.project_url) throw new Error("別のアカウントまたはDBのファイルです。現在のDBとは照合できません。");
  validateExportWorkspace(current);
  return collections.map(collection => {
    const stored = new Map(file.workspace[collection].map(row => [rowKey(collection, row), row] as const));
    const live = new Map(current[collection].map(row => [rowKey(collection, row), row] as const));
    const fileOnly = [...stored.keys()].filter(id => !live.has(id));
    const currentOnly = [...live.keys()].filter(id => !stored.has(id));
    const changed = [...stored.keys()].filter(id => live.has(id) && canonical(stored.get(id)) !== canonical(live.get(id)));
    return { collection, fileCount: stored.size, currentCount: live.size, fileOnly, currentOnly, changed,
      equal: stored.size - fileOnly.length - changed.length };
  });
}
/** Force a fresh owner-scoped read; never silently export stale cache after failure. */
export async function freshWorkspaceExport(repository: YutaiRepository, projectUrl: string, expectedEpoch: number, assertIdle: () => void) {
  const identity = repository.getIdentity();
  const check = () => {
    const current = repository.getIdentity();
    if (!identity.owner || identity.sessionRevision !== expectedEpoch || current.owner !== identity.owner || current.sessionRevision !== expectedEpoch) throw new YutaiFailure("auth");
    assertIdle();
  };
  check();
  const workspace = await repository.load(1, true);
  check();
  const view = repository.getSnapshot(1);
  if (view.stale || view.fetchedAt === null || view.data !== workspace) throw new Error("最新データの取得を確認できません。");
  const file = await createWorkspaceExport(workspace, { project_url: projectUrl, owner_id: identity.owner! }, new Date(view.fetchedAt).toISOString());
  check();
  if (repository.getSnapshot(1).data !== workspace || repository.getSnapshot(1).stale) throw new Error("取得中に更新がありました。もう一度出力してください。");
  return file;
}
