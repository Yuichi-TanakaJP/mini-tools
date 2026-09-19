import { describe, expect, it, vi } from "vitest";
import { parseWorkspace, type Command, type CommandDraft, type Workspace } from "./contracts";
import { YutaiRepository, type Transport } from "./repository";

export function workspace(month = 9): Workspace {
  return { schema_version: 1, selected_month: month, as_of: "2026-09-09T00:00:00Z",
    counts: { profiles: 0, month_states: 0, cycles: 0, tags: 0, profile_tags: 0, rewards: 0, reward_events: 0, selections: 0, effective_selections: 0 },
    profiles: [], month_states: [], cycles: [], tags: [], profile_tags: [], rewards: [], reward_events: [], selections: [], effective_selections: [] };
}
export const draft: CommandDraft = { command_type: "set_selection", expected_revision: 0,
  target: { stock_code: "1234", entitlement_month: 9 }, payload: { selection_status: "picked" } };
export function receipt(command: Command) {
  return { schema_version: 1, request_id: command.request_id, command_type: command.command_type,
    target_id: "target", event_id: "event", revision: 1, replayed: false, before: null, after: {} };
}
function deferred<T>() {
  let resolve: (value: T) => void;
  let reject: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve: (value: T) => resolve(value), reject: (error: unknown) => reject(error) };
}
function setup(options: ConstructorParameters<typeof YutaiRepository>[1] = {}) {
  const transport = { read: vi.fn<Transport["read"]>(async (_owner, month) => workspace(month)),
    write: vi.fn<Transport["write"]>(async (_owner, command) => receipt(command)) };
  const repo = new YutaiRepository(transport, { uuid: () => "request-1", ...options });
  repo.setOwner("owner-A");
  return { repo, transport };
}

describe("workspace contract", () => {
  it("validates empty data, counts, month and schema without treating an error as empty", () => {
    expect(parseWorkspace(workspace(), 9).profiles).toEqual([]);
    for (const value of [null, {}, { ...workspace(), schema_version: 2 }, { ...workspace(), selected_month: 8 },
      { ...workspace(), profiles: null }, { ...workspace(), counts: {} }]) expect(() => parseWorkspace(value, 9)).toThrow();
  });
  it("preserves null and zero preparation, manual shares/value and boolean benefit flags", () => {
    const data = workspace();
    data.month_states = [null, 0].map((preparation, index) => ({ id: `month-${index}`, profile_id: "p",
      entitlement_month: index + 8, preparation_months_before: preparation, required_shares: 100,
      benefit_value_yen: 5000, long_term_required: false, long_term_benefit: true, month_memo: "memo",
      revision: 1, created_at: data.as_of, updated_at: data.as_of }));
    data.counts.month_states = 2;
    expect(parseWorkspace(data, 9).month_states.map(row => row.preparation_months_before)).toEqual([null, 0]);
    expect(parseWorkspace(data, 9).month_states[0].benefit_value_yen).toBe(5000);
    expect(() => parseWorkspace({ ...data, month_states: [{ ...data.month_states[0], revision: 0 }, data.month_states[1]] }, 9)).toThrow();
  });
  it("rejects invalid enums rather than casting them into a UI type", () => {
    const data = workspace();
    data.counts.effective_selections = 1;
    expect(() => parseWorkspace({ ...data, effective_selections: [{ stock_code: "1234", selection_status: "bad", selection_scope: "global" }] }, 9)).toThrow();
  });
});
describe("repository cache and reads", () => {
  it("coalesces concurrent loads and keeps immutable stable snapshots", async () => {
    const { repo, transport } = setup();
    const first = repo.load(9), second = repo.load(9);
    expect(first).toBe(second);
    const data = await first;
    const state = repo.getSnapshot(9);
    expect(repo.getSnapshot(9)).toBe(state);
    expect(await repo.load(9)).toBe(data);
    expect(transport.read).toHaveBeenCalledTimes(1);
    expect(Object.isFrozen(data.profiles)).toBe(true);
  });
  it("expires after 30s, forces manual refresh and separates months", async () => {
    let now = 0;
    const { repo, transport } = setup({ now: () => now });
    await repo.load(9); now = 29_999; await repo.load(9);
    expect(transport.read).toHaveBeenCalledTimes(1);
    now = 30_000; await repo.load(9); await repo.load(9, true); await repo.load(8);
    expect(transport.read).toHaveBeenCalledTimes(4);
    expect(repo.getSnapshot(9).data.selected_month).toBe(9);
    expect(repo.getSnapshot(8).data.selected_month).toBe(8);
  });
  it("retains last fetched time and display data on offline/read failure", async () => {
    let online = true;
    const { repo, transport } = setup({ online: () => online, now: () => 123 });
    const data = await repo.load(9);
    online = false;
    await expect(repo.load(9)).rejects.toMatchObject({ kind: "offline" });
    expect(repo.getSnapshot(9)).toMatchObject({ data, fetchedAt: 123, stale: true, status: "error" });
    online = true; transport.read.mockRejectedValueOnce(new Error("network"));
    await expect(repo.load(9)).rejects.toMatchObject({ kind: "unknown" });
    expect(repo.getSnapshot(9).data).toBe(data);
  });
  it("rejects signed-out and invalid-month loads without RPC", async () => {
    const { repo, transport } = setup();
    for (const month of [0, 13, 1.5, NaN]) expect(() => repo.load(month)).toThrow();
    repo.setOwner(null);
    await expect(repo.load(9)).rejects.toMatchObject({ kind: "auth" });
    expect(transport.read).not.toHaveBeenCalled();
  });
  it("drops late prior-account reads, including signout then same-user login", async () => {
    const { repo, transport } = setup();
    const old = deferred<Workspace>(); transport.read.mockReturnValueOnce(old.promise);
    const load = repo.load(9); await Promise.resolve();
    repo.setOwner(null); repo.setOwner("owner-A");
    old.resolve(workspace());
    await expect(load).rejects.toMatchObject({ kind: "auth" });
    expect(repo.getSnapshot(9).data).toBeNull();
  });
  it("does not publish a pre-invalidation result over a newer result", async () => {
    const { repo, transport } = setup();
    const old = deferred<Workspace>(); transport.read.mockReturnValueOnce(old.promise);
    const first = repo.load(9); await Promise.resolve();
    repo.invalidate(); await repo.load(9);
    const fresh = repo.getSnapshot(9);
    old.resolve(workspace()); await expect(first).rejects.toThrow();
    expect(repo.getSnapshot(9)).toBe(fresh);
  });
  it("clears all cached months on auth rejection", async () => {
    const { repo, transport } = setup(); await repo.load(8); await repo.load(9);
    transport.read.mockRejectedValueOnce({ code: "42501", message: "private SQL" });
    await expect(repo.load(9, true)).rejects.toMatchObject({ kind: "auth" });
    expect(repo.getSnapshot(8).data).toBeNull();
    expect(repo.getSnapshot(9).status).toBe("signed_out");
  });
});
describe("daily command submission", () => {
  const id = { id: "target" }, empty = {}, revision = 1;
  const catalog: CommandDraft[] = [draft,
    { command_type: "update_profile", target: id, payload: { cross_strategy: "未設定", priority: 2 }, expected_revision: revision },
    { command_type: "update_month_state", target: id, payload: { required_shares: 100, benefit_value_yen: 5000 }, expected_revision: revision },
    { command_type: "update_cycle", target: id, payload: { entitlement_year: 2026, entitlement_month: 9 }, expected_revision: revision },
    { command_type: "update_reward", target: id, payload: { memo: "test" }, expected_revision: revision },
    { command_type: "consume_reward", target: id, payload: { value: 1 }, expected_revision: revision },
    { command_type: "restock_reward", target: id, payload: { value: 1 }, expected_revision: revision },
    { command_type: "adjust_reward_balance", target: id, payload: { value: 0 }, expected_revision: revision, note: "reason" },
    { command_type: "set_reward_archived", target: id, payload: { archived: true }, expected_revision: revision },
    { command_type: "create_profile", target: empty, payload: { stock_code: "1234", display_name: "test", cross_strategy: "未設定", priority: 2 }, expected_revision: 0 },
    { command_type: "create_month_state", target: empty, payload: { profile_id: "profile", entitlement_month: 9 }, expected_revision: 0 },
    { command_type: "create_cycle", target: empty, payload: { profile_id: "profile", entitlement_year: 2026, entitlement_month: 9, status: "prepared", prepared_at: "2026-09-09T00:00:00Z" }, expected_revision: 0 },
    { command_type: "create_reward", target: empty, payload: { title: "test", track_mode: "count", initial_value: 10 }, expected_revision: 0 },
    { command_type: "create_tag", target: empty, payload: { name: "test" }, expected_revision: 0 },
    { command_type: "update_tag", target: id, payload: { name: "test" }, expected_revision: revision },
    { command_type: "set_profile_tags", target: id, payload: { tag_ids: [] }, expected_revision: revision },
    { command_type: "delete_profile", target: id, payload: empty, expected_revision: revision, note: "reason" },
    { command_type: "delete_month_state", target: id, payload: empty, expected_revision: revision, note: "reason" },
    { command_type: "delete_cycle", target: id, payload: empty, expected_revision: revision, note: "reason" },
    { command_type: "delete_reward", target: id, payload: empty, expected_revision: revision, note: "reason" },
    { command_type: "delete_tag", target: id, payload: empty, expected_revision: revision, note: "reason" },
    { command_type: "clear_selection", target: id, payload: empty, expected_revision: revision, note: "reason" },
    { command_type: "remove_reward_event", target: id, payload: { event_id: "history" }, expected_revision: revision, note: "reason" },
    { command_type: "change_reward_mode", target: id, payload: { track_mode: "amount", value: 1000, unit_yen: null }, expected_revision: revision, note: "reason" },
  ];
  it.each(catalog)("transports $command_type without changing its fields", async operation => {
    expect(new Set(catalog.map(item => item.command_type)).size).toBe(24);
    const { repo, transport } = setup();
    transport.write.mockImplementationOnce(async (_owner, command) => ({ ...receipt(command),
      ...(command.command_type.startsWith("delete_") || command.command_type === "clear_selection" ? { revision: null, after: null } : {}) }));
    expect(await repo.save(repo.prepare(operation), 9)).toMatchObject({ status: "saved" });
    expect(transport.write.mock.calls[0][1]).toMatchObject({ ...operation, schema_version: 1, source: "mini_tools" });
  });
  it("reads back success and invalidates other cached months", async () => {
    const { repo, transport } = setup(); await repo.load(8); await repo.load(9);
    const token = repo.prepare(draft);
    expect(await repo.save(token, 9)).toMatchObject({ status: "saved" });
    expect(transport.write).toHaveBeenCalledTimes(1);
    expect(repo.getSnapshot(8).stale).toBe(true);
    expect(repo.getSnapshot(9).stale).toBe(false);
  });
  it("accepts deletion receipts whose after and revision are null", async () => {
    const { repo, transport } = setup();
    transport.write.mockImplementationOnce(async (_owner, command) => ({ ...receipt(command), revision: null, after: null }));
    expect(await repo.save(repo.prepare({ command_type: "delete_tag", target: { id: "tag" },
      payload: {}, expected_revision: 1, note: "remove unused tag" }), 9)).toMatchObject({ status: "saved", receipt: { revision: null } });
  });
  it("refreshes all active months after a save", async () => {
    const { repo } = setup({ activeMonths: () => [8, 9] });
    await repo.load(8);
    expect(await repo.save(repo.prepare(draft), 9)).toMatchObject({ status: "saved" });
    expect(repo.getSnapshot(8).stale).toBe(false);
  });
  it("distinguishes committed save / failed read-back", async () => {
    const { repo, transport } = setup(); await repo.load(9);
    transport.read.mockRejectedValueOnce(new Error("timeout"));
    expect(await repo.save(repo.prepare(draft), 9)).toMatchObject({ status: "saved_refresh_failed", receipt: { event_id: "event" } });
    expect(repo.getSnapshot(9).stale).toBe(true);
  });
  it("retries an uncertain result with identical ID, timestamp and payload; never auto-retries", async () => {
    const { repo, transport } = setup();
    const mutable = structuredClone(draft), token = repo.prepare(mutable);
    mutable.payload.selection_status = "passed";
    transport.write.mockRejectedValueOnce(new Error("lost response"));
    expect(await repo.save(token, 9)).toMatchObject({ status: "uncertain" });
    expect(transport.write).toHaveBeenCalledTimes(1);
    expect(await repo.save(token, 9)).toMatchObject({ status: "saved" });
    expect(transport.write.mock.calls[0][1]).toBe(transport.write.mock.calls[1][1]);
    expect(transport.write.mock.calls[1][1].payload).toEqual({ selection_status: "picked" });
  });
  it("coalesces a double-click of the same prepared command", async () => {
    const { repo, transport } = setup();
    const token = repo.prepare(draft), first = repo.save(token, 9);
    expect(repo.save(token, 9)).toBe(first); await first;
    expect(transport.write).toHaveBeenCalledTimes(1);
  });
  it("reports conflict, fetches latest, and does not overwrite automatically", async () => {
    const { repo, transport } = setup(); transport.write.mockRejectedValueOnce({ code: "40001" });
    expect(await repo.save(repo.prepare(draft), 9)).toMatchObject({ status: "not_saved", error: { kind: "conflict" } });
    expect(transport.write).toHaveBeenCalledTimes(1); expect(transport.read).toHaveBeenCalledTimes(1);
  });
  it("rejects offline save without a queue", async () => {
    const { repo, transport } = setup({ online: () => false });
    expect(await repo.save(repo.prepare(draft), 9)).toMatchObject({ status: "not_saved", error: { kind: "offline" } });
    expect(transport.write).not.toHaveBeenCalled();
  });
  it("rejects prior-owner prepared tokens and forged tokens", async () => {
    const { repo, transport } = setup(); const token = repo.prepare(draft); repo.setOwner("owner-B");
    for (const candidate of [token, { requestId: token.requestId }]) {
      expect(await repo.save(candidate, 9)).toMatchObject({ status: "not_saved", error: { kind: "auth" } });
    }
    expect(transport.write).not.toHaveBeenCalled();
  });
  it("does not leak a receipt when account changes during a write", async () => {
    const { repo, transport } = setup(); const pending = deferred<unknown>(); transport.write.mockReturnValueOnce(pending.promise);
    const result = repo.save(repo.prepare(draft), 9); repo.setOwner("owner-B");
    pending.resolve(receipt(transport.write.mock.calls[0][1]));
    expect(await result).toEqual({ status: "uncertain", error: expect.objectContaining({ kind: "auth" }) });
    expect(transport.read).not.toHaveBeenCalled();
  });
  it("does not leak receipt when account changes during read-back", async () => {
    const { repo, transport } = setup(); const pending = deferred<Workspace>(); transport.read.mockReturnValueOnce(pending.promise);
    const result = repo.save(repo.prepare(draft), 9);
    await vi.waitFor(() => expect(transport.read).toHaveBeenCalledTimes(1));
    repo.setOwner("owner-B"); pending.resolve(workspace());
    expect(await result).toMatchObject({ status: "uncertain", error: { kind: "auth" } });
    expect(await result).not.toHaveProperty("receipt");
  });
  it("treats malformed write responses as uncertain and hides SQL text", async () => {
    const { repo, transport } = setup(); transport.write.mockResolvedValueOnce({});
    expect(await repo.save(repo.prepare(draft), 9)).toMatchObject({ status: "uncertain" });
    transport.write.mockRejectedValueOnce({ code: "23514", message: "private SQL" });
    const result = await repo.save(repo.prepare(draft), 9);
    expect(result).toMatchObject({ status: "not_saved", error: { kind: "rejected" } });
    expect(JSON.stringify(result)).not.toContain("private SQL");
  });
  it("never converts NaN or undefined payload fields into clear/null writes", () => {
    const { repo } = setup();
    expect(() => repo.prepare({ command_type: "update_month_state", target: { id: "m" }, expected_revision: 1, payload: { required_shares: NaN } })).toThrow();
    expect(() => repo.prepare({ command_type: "update_month_state", target: { id: "m" }, expected_revision: 1, payload: { required_shares: undefined } })).toThrow();
  });
  it("reads back current data even when replay returns an old receipt", async () => {
    const { repo, transport } = setup();
    transport.write.mockImplementationOnce(async (_owner, command) => ({ ...receipt(command), replayed: true, after: { old: true } }));
    expect(await repo.save(repo.prepare(draft), 9)).toMatchObject({ status: "saved", receipt: { replayed: true } });
    expect(repo.getSnapshot(9).data).toEqual(workspace());
  });
});
