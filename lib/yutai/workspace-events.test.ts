import { describe, expect, it, vi } from "vitest";
import { parseWorkspace, type Workspace } from "./contracts";
import { calendarProjection } from "./calendar";
import { YutaiRepository, type Transport } from "./repository";
import { createWorkspaceExport, parseWorkspaceExport } from "./transfer";

const date = "2026-10-18T00:00:00Z";
function fixture(month = 10): Workspace {
  return {
    schema_version: 1, selected_month: month, as_of: date,
    counts: { profiles: 0, month_states: 0, cycles: 0, tags: 0, profile_tags: 0,
      rewards: 1, reward_events: 1, selections: 0, effective_selections: 0 },
    profiles: [], month_states: [], cycles: [], tags: [], profile_tags: [],
    selections: [], effective_selections: [],
    rewards: [{ id: "reward", profile_id: null, cycle_id: null, title: "fixture", company: "",
      expires_on: "2026-09-30", track_mode: "count", initial_value: 2, remaining_value: 0,
      unit_yen: null, archived_at: null, memo: "", link: null, revision: 1,
      created_at: date, updated_at: date }],
    reward_events: [{ id: "expired-event", reward_id: "reward", track_mode: "count",
      event_type: "expired", delta_value: -2, occurred_at: date, note: null, created_at: date }],
  };
}

describe("workspace with legitimate expiry history", () => {
  it("retains signed expiry history and stored balance without replaying the delta", () => {
    const raw = fixture();
    const before = JSON.stringify(raw);
    const read = parseWorkspace(raw, 10);
    expect(read.reward_events).toEqual(raw.reward_events);
    expect(read.reward_events[0]).toMatchObject({ event_type: "expired", delta_value: -2, note: null });
    expect(() => calendarProjection(read, 2026)).not.toThrow();
    expect(read.rewards[0].remaining_value).toBe(0);
    expect(JSON.stringify(raw)).toBe(before);
  });

  it.each(["received", "consumed", "restocked", "adjusted"] as const)("still reads existing %s events", type => {
    const raw = fixture(); raw.reward_events[0].event_type = type;
    expect(parseWorkspace(raw, 10).reward_events[0].event_type).toBe(type);
  });

  it.each(["unexpected", "EXPIRED", "", null])("still rejects unknown event kind %s", type => {
    const raw = fixture();
    expect(() => parseWorkspace({ ...raw, reward_events: [{ ...raw.reward_events[0], event_type: type }] }, 10)).toThrow("INVALID_RESPONSE");
  });

  it("does not turn malformed expiry history into successful empty data", () => {
    const raw = fixture();
    expect(() => parseWorkspace({ ...raw, counts: { ...raw.counts, reward_events: 0 } }, 10)).toThrow("INVALID_RESPONSE");
    expect(() => parseWorkspace({ ...raw, reward_events: [{ ...raw.reward_events[0], delta_value: "-2" }] }, 10)).toThrow("INVALID_RESPONSE");
  });

  it("loads different calendar months without losing events or issuing writes", async () => {
    const transport = { read: vi.fn<Transport["read"]>(async (_owner, month) => fixture(month)), write: vi.fn<Transport["write"]>() };
    const repo = new YutaiRepository(transport); repo.setOwner("synthetic-owner");
    for (const month of [10, 9, 10]) {
      const read = await repo.load(month);
      expect(read.reward_events[0].event_type).toBe("expired");
      expect(repo.getSnapshot(month).status).toBe("ready");
      expect(repo.getSnapshot(month).error).toBeNull();
      expect(read.rewards[0].remaining_value).toBe(0);
    }
    expect(transport.write).not.toHaveBeenCalled();
  });

  it("exports and parses expired history losslessly without changing balance", async () => {
    const raw = fixture();
    const file = await createWorkspaceExport(raw, {
      project_url: "https://fixture.supabase.co", owner_id: "00000000-0000-4000-8000-000000000001",
    }, date, date);
    const read = await parseWorkspaceExport(JSON.stringify(file));
    expect(read.workspace).toEqual(raw);
    expect(read.workspace.reward_events[0].event_type).toBe("expired");
    expect(read.workspace.rewards[0].remaining_value).toBe(0);
  });
});
