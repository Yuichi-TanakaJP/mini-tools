import { isObject, type Reward, type Workspace } from "./contracts";
import { canonical, createWorkspaceExport, MAX_EXPORT_BYTES, validateExportWorkspace, type WorkspaceExport } from "./transfer";
import { monthDraft, profileDraft } from "./memo";
import { cycleDraft } from "./cycles";

async function stableId(key: string) {
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key))), n => n.toString(16).padStart(2, "0")).join("");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function convertLegacyInput(text: string, current: WorkspaceExport): Promise<WorkspaceExport> {
  if (new TextEncoder().encode(text).length > MAX_EXPORT_BYTES) throw new Error("ファイルが10MBを超えています。");
  const raw: unknown = JSON.parse(text);
  if (Array.isArray(raw)) return convertLegacyBenefits(text, current);
  if (!isObject(raw) || raw.schema !== "mini-tools-localstorage-backup" || raw.version !== 1 || !isObject(raw.data)) throw new Error("対応する旧端末バックアップではありません。");
  const recognized = ["yutai_memo_items_v1", "yutai_memo_tags_v1", "yutai_memo_archives_v1", "monthly_yutai_card_memos_v1", "monthly_yutai_picks_v1", "monthly_yutai_passes_v1", "mini-tools:benefits:v2"];
  const data = raw.data;
  if (!recognized.some(k => k in data)) throw new Error("対象の優待データがありません。");
  const values: Record<string, unknown> = {};
  for (const key of recognized) if (key in data) {
    if (typeof data[key] !== "string") throw new Error(`${key}: 保存形式が不正です。`);
    values[key] = JSON.parse(data[key] as string);
  }
  const output: Workspace = JSON.parse(JSON.stringify(current.workspace));
  const stamp = current.fetched_at;
  const base = (id: string) => ({ id, revision: 1, created_at: stamp, updated_at: stamp });
  const list = (key: string): Record<string, unknown>[] => {
    if (!(key in values)) return [];
    if (!Array.isArray(values[key]) || (values[key] as unknown[]).some(v => !isObject(v))) throw new Error(`${key}: 配列形式が不正です。`);
    return values[key] as Record<string, unknown>[];
  };
  const str = (v: unknown, fallback = "") => { if (v === undefined || v === null) return fallback; if (typeof v !== "string") throw new Error("文字列フィールドが不正です。"); return v; };
  const aliases = new Map<string, string>(), tagAliases = new Map<string, string>();
  for (const tag of list("yutai_memo_tags_v1")) {
    const id = str(tag.id), name = str(tag.name);
    if (!id || !name || tagAliases.has(id)) throw new Error("タグID・名称の欠落か重複があります。");
    const existing = output.tags.find(t => t.name === name);
    const target = existing?.id ?? await stableId(`memo-tag:${id}`); tagAliases.set(id, target);
    if (!existing) output.tags.push({ ...base(target), name, created_at: typeof tag.createdAt === "number" && Number.isFinite(tag.createdAt) ? new Date(tag.createdAt).toISOString() : stamp });
  }
  const addCycle = async (profileId: string, ym: unknown, at: unknown, note: string) => {
    if (typeof ym !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(ym) || Number(ym.slice(0,4)) < 1) throw new Error("仕込み履歴の権利年月が未記録です。推測せず元データを確認してください。");
    const prepared = date(at), year = Number(ym.slice(0,4)), month = Number(ym.slice(5));
    const old = output.cycles.find(c => c.profile_id === profileId && c.entitlement_year === year && c.entitlement_month === month);
    if (old) { if (old.prepared_at !== prepared || note && old.note !== note) throw new Error("同じ権利年月の仕込み履歴に差分があります。自動上書きしません。"); return; }
    output.cycles.push({ ...base(await stableId(`memo-cycle:${profileId}:${ym}`)), ...cycleDraft(), profile_id: profileId,
      entitlement_year: year, entitlement_month: month, status: "prepared", prepared_at: prepared, note });
  };
  for (const memo of list("yutai_memo_items_v1")) {
    const mapped = new Set(["id", "code", "name", "months", "tagIds", "crossType", "priority", "memo", "entryTiming", "preparationMonthsBefore", "relatedUrl", "tenureRule", "officialBenefitUrl", "oneShareStartedAt", "oneShareHold", "acquired", "acquiredMarkedAt", "acquiredEntitlementMonthKey", "createdAt", "updatedAt"]);
    if (Object.keys(memo).some(k => !mapped.has(k) && memo[k] !== undefined && memo[k] !== null && memo[k] !== "")) throw new Error("旧メモに未対応の追加情報があります。省略せず移行用の対応付けを確認してください。");
    const sourceId = str(memo.id), code = str(memo.code).toUpperCase(), name = str(memo.name);
    if (!sourceId || aliases.has(sourceId) || !/^[0-9A-Z]{4,5}$/.test(code) || !name) throw new Error("銘柄ID・コード・名称が欠落または重複しています。");
    if (!Array.isArray(memo.months) || memo.months.some(m => !Number.isInteger(m) || m < 1 || m > 12) || new Set(memo.months).size !== memo.months.length) throw new Error("権利月の形式が不正です。");
    if (!Array.isArray(memo.tagIds)) throw new Error("タグ割当が未記録です。");
    const old = output.profiles.find(p => p.stock_code === code);
    const id = old?.id ?? await stableId(`memo-profile:${sourceId}`); aliases.set(sourceId,id);
    const start = str(memo.oneShareStartedAt);
    if (memo.oneShareHold === true && !start) throw new Error("1株保有の開始情報を確認してください。");
    const fields = { ...profileDraft(), display_name: name, cross_strategy: str(memo.crossType, "未設定") as Workspace["profiles"][number]["cross_strategy"],
      priority: (memo.priority ?? 2) as 1|2|3, memo: str(memo.memo), entry_timing: str(memo.entryTiming) || null,
      tenure_rule: str(memo.tenureRule) || null, related_url: str(memo.relatedUrl) || null, official_benefit_url: str(memo.officialBenefitUrl) || null,
      one_share_started_on: /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : null, one_share_started_legacy_text: start && !/^\d{4}-\d{2}-\d{2}$/.test(start) ? start : null };
    if (old) { if (Object.entries(fields).some(([k,v]) => old[k] !== v)) throw new Error(`${code}: 既存メモに差分があります。自動上書きしません。`); }
    else output.profiles.push({ ...base(id), ...fields, stock_code: code, portfolio_instrument_id: null, active: true,
      default_preparation_months_before: memo.preparationMonthsBefore === undefined ? null : number(memo.preparationMonthsBefore,true), created_at: date(memo.createdAt), updated_at: date(memo.updatedAt) });
    for (const month of memo.months as number[]) if (!output.month_states.some(s => s.profile_id === id && s.entitlement_month === month)) {
      output.month_states.push({ ...base(await stableId(`memo-month:${id}:${month}`)), ...monthDraft(), profile_id: id, entitlement_month: month,
        preparation_months_before: memo.preparationMonthsBefore === undefined ? null : number(memo.preparationMonthsBefore,true) });
    }
    for (const key of memo.tagIds) {
      const tagId = tagAliases.get(str(key)); if (!tagId) throw new Error("割当タグの定義がありません。");
      if (!output.profile_tags.some(t => t.profile_id === id && t.tag_id === tagId)) output.profile_tags.push({ profile_id: id, tag_id: tagId, created_at: stamp });
    }
    if (memo.acquired === true) await addCycle(id,memo.acquiredEntitlementMonthKey,memo.acquiredMarkedAt,"");
    else if (memo.acquired !== false) throw new Error("仕込み済み状態が未記録です。");
  }
  for (const archive of list("yutai_memo_archives_v1")) {
    const id = aliases.get(str(archive.memoId)); if (!id) throw new Error("アーカイブに対応するメモがありません。");
    await addCycle(id,archive.entitlementMonthKey,archive.acquiredAt,str(archive.note));
  }
  if ("monthly_yutai_card_memos_v1" in values) {
    const cards = values.monthly_yutai_card_memos_v1;
    if (!isObject(cards)) throw new Error("月別入力が不正です。");
    for (const [key, card] of Object.entries(cards)) {
      if (!isObject(card) || !/^[0-9A-Z]{4,5}:(?:[1-9]|1[0-2])$/.test(key)) throw new Error("月別入力の銘柄・月を確認してください。");
      const [code, monthText] = key.split(":"); const p = output.profiles.find(p => p.stock_code === code);
      if (!p) throw new Error(`${code}: 月別入力に対応するメモがありません。`);
      const month = Number(monthText), old = output.month_states.find(s => s.profile_id === p.id && s.entitlement_month === month);
      const patch = { preparation_months_before: card.preparationMonthsBefore === undefined ? null : number(card.preparationMonthsBefore,true),
        required_shares: card.requiredShares === undefined ? null : number(card.requiredShares), benefit_value_yen: card.benefitValueYen === undefined ? null : number(card.benefitValueYen),
        long_term_required: card.longTermRequired ?? false, long_term_benefit: card.longTermBenefit ?? false };
      if (old && current.workspace.month_states.some(s => s.id === old.id) && Object.entries(patch).some(([k,v]) => old[k] !== v)) throw new Error(`${key}: DBの月別設定と差分があります。`);
      if (old) Object.assign(old,patch); else output.month_states.push({ ...base(await stableId(`memo-month:${p.id}:${month}`)), ...monthDraft(), profile_id: p.id, entitlement_month: month, ...patch } as Workspace["month_states"][number]);
    }
  }
  for (const [key,status] of [["monthly_yutai_picks_v1","picked"],["monthly_yutai_passes_v1","passed"]] as const) if (key in values) {
    const codes = values[key]; if (!Array.isArray(codes) || codes.some(c => typeof c !== "string" || !/^[0-9A-Z]{4,5}$/.test(c))) throw new Error("共通ピック・パスの形式を確認してください。");
    for (const code of codes as string[]) {
      const old = output.selections.find(s => s.stock_code === code && s.entitlement_month === null);
      if (old && old.selection_status !== status) throw new Error(`${code}: 共通ピック・パスが競合しています。`);
      if (!old) output.selections.push({ ...base(await stableId(`selection:${code}:global`)), stock_code: code, entitlement_month: null, selection_status: status });
    }
  }
  for (const key of Object.keys(output.counts)) if (Array.isArray(output[key])) output.counts[key] = output[key].length;
  let result = await createWorkspaceExport(validateExportWorkspace(output),current.source,current.fetched_at);
  if ("mini-tools:benefits:v2" in values && (!Array.isArray(values["mini-tools:benefits:v2"]) || (values["mini-tools:benefits:v2"] as unknown[]).length)) result = await convertLegacyBenefits(JSON.stringify(values["mini-tools:benefits:v2"]),result);
  return result;
}
function number(value: unknown, integer = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER / 100 || (integer ? !Number.isInteger(value) : Math.abs(value * 100 - Math.round(value * 100)) > 0.00001)) throw new Error("旧データの数値・精度を確認してください。");
  return value;
}
function date(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error("旧データの日付を確認してください。");
  return value;
}
/** Additive conversion only. Existing rows and IDs remain; differences are never silently overwritten. */
export async function convertLegacyBenefits(text: string, current: WorkspaceExport): Promise<WorkspaceExport> {
  if (new TextEncoder().encode(text).length > MAX_EXPORT_BYTES) throw new Error("ファイルが10MBを超えています。");
  const raw: unknown = JSON.parse(text);
  if (!Array.isArray(raw) || !raw.length) throw new Error("対応形式は期限帳v2の配列JSONです。全端末バックアップ・旧メモは移行用の照合が必要です。");
  const output: Workspace = JSON.parse(JSON.stringify(current.workspace));
  const sourceIds = new Set<string>();
  for (const row of raw) {
    if (!isObject(row) || typeof row.id !== "string" || !row.id || sourceIds.has(row.id)) throw new Error("旧データのIDが欠落・重複しています。");
    sourceIds.add(row.id);
    if (!["count", "amount"].includes(String(row.trackMode)) || typeof row.title !== "string" || !row.title.trim() || typeof row.company !== "string" || !Array.isArray(row.history)) throw new Error("期限帳v2の全フィールドが必要です。旧データを省略して保存しません。");
    const allowed = new Set(["id", "title", "company", "expiresOn", "isUsed", "trackMode", "unitYen", "initial", "remaining", "history", "archivedAt", "quantity", "amountYen", "memo", "link", "createdAt", "updatedAt"]);
    if (Object.keys(row).some(k => !allowed.has(k))) throw new Error("未知のフィールドがあります。省略せず形式を確認してください。");
    const count = row.trackMode === "count";
    const initial = number(row.initial, count), remaining = number(row.remaining, count);
    if (initial < 0 || remaining < 0 || typeof row.isUsed !== "boolean" || row.isUsed !== (remaining === 0)) throw new Error("旧データの残高・使用済み状態が一致しません。");
    const expires = row.expiresOn === null ? null : date(row.expiresOn);
    if (expires && (!/^\d{4}-\d{2}-\d{2}$/.test(expires) || new Date(expires).toISOString().slice(0, 10) !== expires)) throw new Error("期限日が不正です。");
    const unit = row.unitYen === null ? null : number(row.unitYen);
    if (unit !== null && (unit < 0 || !count)) throw new Error("額面と管理単位が一致しません。");
    if (row.memo !== undefined && typeof row.memo !== "string" || row.link !== undefined && typeof row.link !== "string") throw new Error("メモ・リンク形式が不正です。");
    const id = await stableId(`mini-tools:benefits:v2:${row.id}`);
    const reward: Reward = { id, revision: 1, profile_id: null, cycle_id: null, title: row.title, company: row.company,
      track_mode: count ? "count" : "amount", initial_value: initial, remaining_value: remaining, unit_yen: unit,
      expires_on: expires, archived_at: row.archivedAt === null ? null : date(row.archivedAt),
      memo: row.memo as string ?? "", link: row.link as string || null, created_at: date(row.createdAt), updated_at: date(row.updatedAt) };
    const events: Workspace["reward_events"] = [];
    let cents = Math.round(initial * 100);
    for (const [index, e] of row.history.entries()) {
      if (!isObject(e) || Object.keys(e).some(k => !["at", "deltaQty", "deltaYen", "note"].includes(k)) || e.note !== undefined && typeof e.note !== "string") throw new Error("旧利用履歴の形式を確認してください。");
      const delta = number(e[count ? "deltaQty" : "deltaYen"], count);
      cents += Math.round(delta * 100);
      events.push({ id: await stableId(`${id}:history:${index}`), reward_id: id, track_mode: reward.track_mode,
        event_type: "adjusted", delta_value: delta, occurred_at: date(e.at), created_at: date(e.at), note: e.note as string ?? null });
    }
    if (cents !== Math.round(remaining * 100)) throw new Error(`${row.title}: 初期値＋履歴が残高と一致しません。元ファイルを確認してください。`);
    const sameId = output.rewards.find(r => r.id === id);
    if (sameId) {
      const omit = ({ revision: _r, updated_at: _u, ...v }: Reward) => v;
      if (canonical(omit(sameId)) !== canonical(omit(reward)) || canonical(output.reward_events.filter(e => e.reward_id === id).sort((a,b) => a.id.localeCompare(b.id))) !== canonical([...events].sort((a,b) => a.id.localeCompare(b.id)))) throw new Error(`${row.title}: 以前の取込後に変更があります。自動上書きしません。`);
      continue;
    }
    if (output.rewards.some(r => r.title === reward.title && r.company === reward.company && r.expires_on === reward.expires_on)) throw new Error(`${row.title}: 既存DBに同名・同企業・同期限の優待があります。重複の可能性があるため自動追加しません。`);
    output.rewards.push(reward); output.reward_events.push(...events);
  }
  output.counts.rewards = output.rewards.length; output.counts.reward_events = output.reward_events.length;
  validateExportWorkspace(output);
  return createWorkspaceExport(output, current.source, current.fetched_at);
}
