import { describe, expect, it, vi } from "vitest";
import { collections, compareWorkspaceExport, createWorkspaceExport, freshWorkspaceExport, MAX_EXPORT_BYTES, parseWorkspaceExport, validateExportWorkspace } from "./transfer";
import { YutaiRepository } from "./repository";
import type { Workspace } from "./contracts";

const date = "2026-09-10T00:00:00.123456Z";
const source = { project_url: "https://yutai-test.supabase.co", owner_id: "00000000-0000-4000-8000-000000000001" };
function fixture(): Workspace {
  const row = { id: "p", revision: 2, created_at: date, updated_at: date };
  const w: Workspace = { schema_version: 1, selected_month: 1, as_of: date, counts: {},
    profiles: [{ ...row, stock_code: "1234", display_name: "test", portfolio_instrument_id: null, cross_strategy: "未設定", priority: 2, memo: "本人のメモ", active: false,
      one_share_started_on: null, one_share_started_legacy_text: "開始年不明", entry_timing: null, default_preparation_months_before: 2, tenure_rule: null, related_url: null, official_benefit_url: null }],
    month_states: [8, 9].map(month => ({ ...row, id: `m${month}`, profile_id: "p", entitlement_month: month, preparation_months_before: month === 8 ? null : 0,
      required_shares: month === 8 ? null : 100, benefit_value_yen: month === 8 ? 0 : 1234.5, long_term_required: false, long_term_benefit: true, month_memo: "各月を保持" })),
    cycles: [2025, 2026].map(year => ({ ...row, id: `c${year}`, profile_id: "p", entitlement_year: year, entitlement_month: 9, status: "received", planned_at: null, prepared_at: `${year}-08-01T00:00:00.123456Z`, rights_secured_at: null, settled_at: null, received_at: null, skipped_at: null, quantity: 100, account_label: null, note: "履歴" })),
    tags: [{ ...row, id: "tag", name: "保持" }], profile_tags: [{ profile_id: "p", tag_id: "tag", created_at: date }],
    rewards: [{ ...row, id: "reward", title: "優待", profile_id: "p", cycle_id: "c2026", company: "test", expires_on: null, unit_yen: null,
      memo: "保持", link: null, track_mode: "amount", initial_value: 100, remaining_value: 99.5, archived_at: date }],
    reward_events: [{ id: "event", reward_id: "reward", track_mode: "amount", event_type: "consumed", delta_value: -0.5, occurred_at: date, note: "履歴", created_at: date }],
    selections: [null, 8, 9].map(month => ({ ...row, id: `s${month}`, stock_code: "1234", entitlement_month: month, selection_status: month === 9 ? "unreviewed" : "picked" })),
    effective_selections: [{ stock_code: "1234", selection_status: "picked", selection_scope: "global" }],
  };
  for (const key of [...collections, "effective_selections" as const]) w.counts[key] = w[key].length;
  return w;
}
describe("lossless yutai workspace export and read-only comparison", () => {
  it("roundtrips all collections, inactive/archived rows, null/zero, decimals and exact timestamps", async () => {
    const w = fixture();
    const output = await createWorkspaceExport(w, source, date, date);
    const read = await parseWorkspaceExport(JSON.stringify(output, null, 2));
    expect(read.workspace).toEqual(w);
    expect(read.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(compareWorkspaceExport(read, w, source)).toHaveLength(8);
    expect(compareWorkspaceExport(read, w, source).every(r => !r.fileOnly.length && !r.currentOnly.length && !r.changed.length)).toBe(true);
    expect(JSON.stringify(output)).not.toMatch(/access_token|refresh_token|anonKey|service_role/);
  });
  it("freezes the async export payload and preserves additive fields", async () => {
    const w = fixture(); Object.assign(w.profiles[0], { future_field: { preserved: "yes" } });
    const output = createWorkspaceExport(w, source, date, date);
    w.profiles[0].memo = "later";
    expect((await output).workspace.profiles[0]).toMatchObject({ memo: "本人のメモ", future_field: { preserved: "yes" } });
  });
  it("ignores object/row ordering and derived month view, but compares every stored field", async () => {
    const w = fixture(), file = await createWorkspaceExport(w, source, date, date);
    w.month_states.reverse(); w.selected_month = 9; w.as_of = "2026-09-11T00:00:00Z";
    w.effective_selections = []; w.counts.effective_selections = 0;
    expect(compareWorkspaceExport(file, w, source).every(r => r.changed.length === 0)).toBe(true);
    w.profiles[0].memo = "変更"; w.profiles[0].revision++;
    w.month_states.pop(); w.counts.month_states--;
    w.selections.push({ ...w.selections[0], id: "new", stock_code: "9999" }); w.counts.selections++;
    const diff = compareWorkspaceExport(file, w, source);
    expect(diff.find(r => r.collection === "profiles")?.changed).toEqual(["p"]);
    expect(diff.find(r => r.collection === "month_states")?.fileOnly).toEqual(["m8"]);
    expect(diff.find(r => r.collection === "selections")?.currentOnly).toEqual(["new"]);
    expect(file.workspace.profiles[0].memo).toBe("本人のメモ");
  });
  it("detects a changed body even if counts still match", async () => {
    const file = await createWorkspaceExport(fixture(), source, date, date);
    file.workspace.profiles[0].memo = "tampered";
    await expect(parseWorkspaceExport(JSON.stringify(file))).rejects.toThrow("チェックサム");
  });
  it("rejects old/unknown format, invalid JSON and over-limit files", async () => {
    await expect(parseWorkspaceExport("{" )).rejects.toThrow("JSON");
    await expect(parseWorkspaceExport('{"schema":"mini-tools-localstorage-backup"}')).rejects.toThrow("別形式");
    const file = await createWorkspaceExport(fixture(), source, date, date);
    await expect(parseWorkspaceExport(JSON.stringify({ ...file, version: 2 }))).rejects.toThrow("専用");
    await expect(parseWorkspaceExport("あ".repeat(MAX_EXPORT_BYTES / 3 + 1))).rejects.toThrow("10MB");
  });
  it.each(["cycles", "rewards", "selections"] as const)("rejects missing %s rather than replacing it with an empty array", async collection => {
    const w = fixture(); delete w[collection];
    await expect(createWorkspaceExport(w, source, date)).rejects.toThrow();
  });
  it("rejects wrong counts, duplicate IDs/natural keys and invalid month", () => {
    const w = fixture(); w.counts.profiles = 0;
    expect(() => validateExportWorkspace(w)).toThrow();
    w.counts.profiles = 1; w.selected_month = 13;
    expect(() => validateExportWorkspace(w)).toThrow();
    w.selected_month = 1; w.selections.push({ ...w.selections[0] }); w.counts.selections++;
    expect(() => validateExportWorkspace(w)).toThrow("重複ID");
    w.selections.at(-1)!.id = "other";
    expect(() => validateExportWorkspace(w)).toThrow("重複");
  });
  it.each(["month", "cycle", "tag", "reward", "event"])("rejects missing references: %s", kind => {
    const w = fixture();
    if (kind === "month") w.month_states[0].profile_id = "missing";
    if (kind === "cycle") w.cycles[0].profile_id = "missing";
    if (kind === "tag") w.profile_tags[0].tag_id = "missing";
    if (kind === "reward") w.rewards[0].cycle_id = "missing";
    if (kind === "event") w.reward_events[0].reward_id = "missing";
    expect(() => validateExportWorkspace(w)).toThrow("参照先");
  });
  it("does not compare another owner or project", async () => {
    const w = fixture(), file = await createWorkspaceExport(w, source, date, date);
    expect(() => compareWorkspaceExport(file, w, { ...source, owner_id: source.owner_id.replace(/1$/, "2") })).toThrow("別の");
    expect(() => compareWorkspaceExport(file, w, { ...source, project_url: "https://other.supabase.co" })).toThrow("別の");
  });
  it("rejects invalid provenance, dates and non-JSON values", async () => {
    await expect(createWorkspaceExport(fixture(), { ...source, project_url: "https://user:secret@example.com" }, date)).rejects.toThrow();
    await expect(createWorkspaceExport(fixture(), source, "unknown")).rejects.toThrow();
    const w = fixture(); Object.assign(w.profiles[0], { invalid: undefined });
    await expect(createWorkspaceExport(w, source, date)).rejects.toThrow("JSON");
  });
});

describe("fresh owner-bound export", () => {
  function setup() {
    const transport = { read: vi.fn(async () => fixture()), write: vi.fn() };
    const repo = new YutaiRepository(transport, { now: () => Date.parse(date) }); repo.setOwner(source.owner_id);
    return { repo, transport, epoch: repo.getIdentity().sessionRevision };
  }
  it("forces a read even with fresh cache and never writes", async () => {
    const { repo, transport, epoch } = setup(); await repo.load(1);
    const file = await freshWorkspaceExport(repo, source.project_url, epoch, () => {});
    expect(transport.read).toHaveBeenCalledTimes(2); expect(transport.write).not.toHaveBeenCalled();
    expect(file.source).toEqual(source); expect(Object.keys(repo.getIdentity()).sort()).toEqual(["owner", "sessionRevision"]);
  });
  it("refuses stale cache when the forced read fails", async () => {
    const { repo, transport, epoch } = setup(); await repo.load(1); transport.read.mockRejectedValueOnce(new Error("network"));
    await expect(freshWorkspaceExport(repo, source.project_url, epoch, () => {})).rejects.toThrow();
    expect(repo.getSnapshot(1).data).not.toBeNull();
  });
  it("refuses an account change during read or an old session's export", async () => {
    const { repo, transport, epoch } = setup();
    transport.read.mockImplementationOnce(async () => { repo.setOwner(source.owner_id.replace(/1$/, "2")); return fixture(); });
    await expect(freshWorkspaceExport(repo, source.project_url, epoch, () => {})).rejects.toThrow();
    repo.setOwner(source.owner_id);
    await expect(freshWorkspaceExport(repo, source.project_url, epoch, () => {})).rejects.toThrow();
    expect(transport.write).not.toHaveBeenCalled();
  });
  it("refuses export when an unresolved save exists, including one started during read", async () => {
    const { repo, transport, epoch } = setup();
    await expect(freshWorkspaceExport(repo, source.project_url, epoch, () => { throw new Error("pending"); })).rejects.toThrow("pending");
    expect(transport.read).not.toHaveBeenCalled();
    let calls = 0;
    await expect(freshWorkspaceExport(repo, source.project_url, epoch, () => { if (++calls > 1) throw new Error("pending"); })).rejects.toThrow("pending");
  });
});
