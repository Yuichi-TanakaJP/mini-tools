import { describe, expect, it, vi } from "vitest";
import { calendarProjection, cardMemoPatch, editCalendarMemo, ensureCalendarMonth, removeCalendarMonth, selectionCommand } from "./calendar";
import { getSessionActionRunner, YutaiActionRunner } from "./action-runner";
import { YutaiRepository, type Transport } from "./repository";
import type { Command, CommandReceipt, Profile, Workspace } from "./contracts";

const date = "2026-09-09T00:00:00Z";
const profile: Profile = { id: "p", stock_code: "1234", display_name: "test", portfolio_instrument_id: null,
  cross_strategy: "未設定", priority: 2, memo: "preserve", active: true, one_share_started_on: null, one_share_started_legacy_text: null,
  entry_timing: null, default_preparation_months_before: null, tenure_rule: null, related_url: null, official_benefit_url: null,
  revision: 3, created_at: date, updated_at: date };
export function fixture(): Workspace {
  return { schema_version: 1, selected_month: 9, as_of: date,
    counts: { profiles: 1, month_states: 2, cycles: 0, tags: 0, profile_tags: 0, rewards: 0, reward_events: 0, selections: 1, effective_selections: 1 },
    profiles: [{ ...profile }],
    month_states: [8, 9].map(month => ({ id: `m${month}`, profile_id: "p", entitlement_month: month,
      preparation_months_before: month === 9 ? 0 : null, required_shares: 100, benefit_value_yen: 1234.5,
      long_term_required: false, long_term_benefit: true, month_memo: "month-specific", revision: 4, created_at: date, updated_at: date })),
    cycles: [], tags: [], profile_tags: [], rewards: [], reward_events: [],
    selections: [{ id: "s", stock_code: "1234", entitlement_month: null, selection_status: "picked", revision: 9, created_at: date, updated_at: date }],
    effective_selections: [{ stock_code: "1234", selection_status: "picked", selection_scope: "global" }],
  };
}
function receipt(command: Command): CommandReceipt {
  return { schema_version: 1, request_id: command.request_id, command_type: command.command_type,
    target_id: "created", revision: 1, event_id: "audit", replayed: false, before: null, after: {} };
}
describe("calendar DB projection and commands", () => {
  it("preserves unset strategy, months, manual values and zero versus unknown lead", () => {
    const source = fixture(), result = calendarProjection(source, 2026);
    expect(result.memoItems[0]).toMatchObject({ crossType: "未設定", months: [8, 9], preparationMonthsBefore: 0 });
    expect(result.cardMemos["1234:8"].preparationMonthsBefore).toBeUndefined();
    expect(result.cardMemos["1234:9"]).toMatchObject({ requiredShares: 100, benefitValueYen: 1234.5 });
    expect(result.preparationItems.map(item => item.months)).toEqual([[9]]);
    expect(source.profiles[0].memo).toBe("preserve");
  });
  it("month override never overwrites a global pick; explicit unreviewed suppresses fallback", () => {
    expect(selectionCommand(fixture(), "1234", "unreviewed")).toMatchObject({ target: { entitlement_month: 9 }, expected_revision: 0,
      payload: { selection_status: "unreviewed" } });
    const source = fixture(); source.selections.push({ ...source.selections[0], id: "monthly", entitlement_month: 9, revision: 12 });
    expect(selectionCommand(source, "1234", "passed").expected_revision).toBe(12);
  });
  it("does not replace an explicitly unknown month lead with a profile default", () => {
    const source = fixture(); source.selected_month = 8;
    source.profiles[0].default_preparation_months_before = 2;
    const result = calendarProjection(source, 2026);
    expect(result.memoItems[0].preparationMonthsBefore).toBeUndefined();
    expect(result.cardMemos["1234:8"].preparationMonthsBefore).toBeUndefined();
    expect(result.preparationItems).toEqual([]);
    expect(source.profiles[0].default_preparation_months_before).toBe(2);
  });
  it("converts only explicit cleared fields to null; preserves omitted fields", () => {
    expect(cardMemoPatch({ preparationMonthsBefore: 0 })).toEqual({ preparation_months_before: 0 });
    expect(cardMemoPatch({ requiredShares: undefined })).toEqual({ required_shares: null });
    expect(cardMemoPatch({ benefitValueYen: 1234.5 })).toEqual({ benefit_value_yen: 1234.5 });
  });
  it("creates only the missing month for an existing profile", () => {
    const steps = ensureCalendarMonth(fixture(), "1234", "name", 10);
    expect(steps).toHaveLength(1);
    expect(steps[0]([])).toMatchObject({ command_type: "create_month_state", payload: { profile_id: "p", entitlement_month: 10 } });
    expect(ensureCalendarMonth(fixture(), "1234", "name", 9)).toHaveLength(0);
  });
  it("does not invent settings for an inactive profile or silently reactivate it", () => {
    const source = fixture(); source.profiles[0].active = false;
    expect(() => ensureCalendarMonth(source, "1234", "name", 9)).toThrow();
  });
  it("new profile uses approved defaults and a dependent month uses its DB-generated ID", () => {
    const steps = ensureCalendarMonth(fixture(), "9999", "new", 9);
    expect(steps[0]([])).toMatchObject({ command_type: "create_profile", payload: { cross_strategy: "未設定", priority: 2 } });
    expect(steps[1]([{ target_id: "new-id" } as CommandReceipt])).toMatchObject({ payload: { profile_id: "new-id" } });
  });
  it("editing records the explicit entitlement year/month and retains original revisions", () => {
    const source = fixture();
    const steps = editCalendarMemo(source, "p", 2026, 9, { name: "test", crossType: "未設定", priority: 2, memo: "changed",
      entryTiming: "", relatedUrl: "", tenureRule: "", preparationMonthsBefore: "", acquired: true }, date);
    expect(steps.map(step => step([]))).toEqual([
      { command_type: "update_profile", target: { id: "p" }, expected_revision: 3, payload: { memo: "changed" } },
      { command_type: "update_month_state", target: { id: "m9" }, expected_revision: 4, payload: { preparation_months_before: null } },
      { command_type: "create_cycle", target: {}, expected_revision: 0, payload: { profile_id: "p", entitlement_year: 2026, entitlement_month: 9, status: "prepared", prepared_at: date } },
    ]);
  });
  it("removing a month never cascades into profile/history/rewards", () => {
    const command = removeCalendarMonth(fixture(), "p", 9);
    expect(command).toMatchObject({ command_type: "delete_month_state", target: { id: "m9" }, expected_revision: 4 });
  });
});
describe("resumable UI action", () => {
  async function setup() {
    let count = 0;
    const transport = { read: vi.fn<Transport["read"]>(async () => fixture()),
      write: vi.fn<Transport["write"]>(async (_owner, command) => receipt(command)) };
    const repo = new YutaiRepository(transport, { uuid: () => `request-${++count}` }); repo.setOwner("A"); await repo.load(9);
    return { transport, repo, runner: new YutaiActionRunner(repo) };
  }
  it("retains first committed step and retries the second with the same ID", async () => {
    const { runner, transport } = await setup();
    transport.write.mockImplementationOnce(async (_owner, c) => receipt(c)).mockRejectedValueOnce(new Error("network"));
    await runner.start(ensureCalendarMonth(fixture(), "9999", "new", 9), 9);
    expect(runner.getSnapshot()).toMatchObject({ status: "paused", completed: 1, total: 2, retryable: true });
    await runner.retry();
    expect(runner.getSnapshot().status).toBe("saved");
    expect(transport.write.mock.calls.map(call => call[1].command_type)).toEqual(["create_profile", "create_month_state", "create_month_state"]);
    expect(transport.write.mock.calls[1][1]).toBe(transport.write.mock.calls[2][1]);
  });
  it("readback failure resumes with a read, not another write", async () => {
    const { runner, transport } = await setup(); transport.read.mockRejectedValueOnce(new Error("readback"));
    await runner.start([() => selectionCommand(fixture(), "1234", "passed")], 9);
    expect(runner.getSnapshot()).toMatchObject({ status: "paused", completed: 1 });
    await runner.retry(); expect(runner.getSnapshot().status).toBe("saved");
    expect(transport.write).toHaveBeenCalledTimes(1);
  });
  it("stops on a definite conflict without changing the revision or continuing", async () => {
    const { runner, transport } = await setup(); transport.write.mockRejectedValueOnce({ code: "40001" });
    await runner.start(ensureCalendarMonth(fixture(), "9999", "new", 9), 9);
    expect(runner.getSnapshot()).toMatchObject({ status: "paused", completed: 0, retryable: false });
    await runner.retry(); expect(transport.write).toHaveBeenCalledTimes(1);
    await runner.reviewRejected(); expect(runner.getSnapshot().status).toBe("idle");
  });
  it("does not start another action while result is uncertain", async () => {
    const { runner, transport } = await setup(); transport.write.mockRejectedValueOnce(new Error("network"));
    await runner.start([() => selectionCommand(fixture(), "1234", "passed")], 9);
    await runner.start([() => selectionCommand(fixture(), "1234", "picked")], 9);
    expect(transport.write).toHaveBeenCalledTimes(1);
  });
  it("will not prepare a later step for a different logged-in account", async () => {
    const { runner, transport, repo } = await setup(); transport.write.mockRejectedValueOnce(new Error("network"));
    await runner.start(ensureCalendarMonth(fixture(), "9999", "new", 9), 9);
    repo.setOwner("B"); await repo.load(9); await runner.retry();
    expect(transport.write).toHaveBeenCalledTimes(1);
    expect(runner.getSnapshot().status).toBe("paused");
  });
  it("retains unresolved action identity on remount but never across auth epochs", async () => {
    const { repo } = await setup(); const epoch = repo.getSnapshot(9).sessionRevision;
    const runner = getSessionActionRunner(repo, epoch);
    expect(getSessionActionRunner(repo, epoch)).toBe(runner);
    repo.setOwner(null); repo.setOwner("A");
    expect(getSessionActionRunner(repo, repo.getSnapshot(9).sessionRevision)).not.toBe(runner);
  });
});
