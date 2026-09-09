import { describe, expect, it } from "vitest";
import type { Reward, Workspace } from "./contracts";
import { archiveReward, rewardAction, rewardFields, rewardNumber, saveReward } from "./rewards";
const reward: Reward = { ...rewardFields(), id: "r", title: "優待券", profile_id: "p", cycle_id: "c", track_mode: "count",
  initial_value: 10, remaining_value: 8, unit_yen: 500, archived_at: null, revision: 4, created_at: "2026-09-10", updated_at: "2026-09-10" };
const snapshot = { profiles: [{ id: "p" }], cycles: [{ id: "c", profile_id: "p" }], reward_events: [
  { id: "e", reward_id: "r", track_mode: "count", event_type: "consumed", delta_value: -2 },
  { id: "other", reward_id: "other", delta_value: -1 }] } as Workspace;
const input = { value: "2", reason: "訂正理由", mode: "amount" as const, unit: "" };
const creation = { initial: "10", mode: "count" as const, profileId: "p", cycleId: "c" };
describe("reward decimal input", () => {
  it.each(["0", "0.29", "1000.01", "1.2"])("keeps decimal %s", value => expect(rewardNumber(value, "amount")).toBe(Number(value)));
  it.each(["", "-1", "1.001", "1e3", "NaN", "Infinity", "0x10", "90071992547409.91"])("rejects invalid or lossy amount %s", value => expect(() => rewardNumber(value, "amount")).toThrow());
  it("rejects fractions in count and unsafe integers", () => { expect(() => rewardNumber("1.5", "count")).toThrow(); expect(() => rewardNumber("9007199254740992", "count")).toThrow(); });
  it("zero is allowed for a corrected balance but not usage", () => { expect(rewardNumber("0", "count")).toBe(0); expect(() => rewardNumber("0", "count", true)).toThrow(); });
});
describe("reward commands", () => {
  it("creates linked rewards without guessing initial balance", () => {
    expect(saveReward(snapshot, null, rewardFields(reward), creation)).toMatchObject({ command_type: "create_reward", expected_revision: 0, payload: { initial_value: 10, profile_id: "p", cycle_id: "c" } });
    expect(() => saveReward(snapshot, null, rewardFields(reward), { ...creation, initial: "" })).toThrow();
  });
  it("rejects wrong cycle/profile links", () => expect(() => saveReward(snapshot, null, rewardFields(reward), { ...creation, profileId: null })).toThrow());
  it("patches only changed metadata and retains balances/history/links", () => expect(saveReward(snapshot, reward, { ...rewardFields(reward), memo: "追記" }, creation)).toEqual({ command_type: "update_reward", target: { id: "r" }, expected_revision: 4, payload: { memo: "追記" } }));
  it("does not write unchanged metadata", () => expect(saveReward(snapshot, reward, rewardFields(reward), creation)).toBeNull());
  it("keeps legacy URLs on unrelated edits but refuses new unsafe URLs", () => {
    const legacy = { ...reward, link: "example.com" };
    expect(saveReward(snapshot, legacy, { ...rewardFields(legacy), memo: "追記" }, creation)).toMatchObject({ payload: { memo: "追記" } });
    expect(() => saveReward(snapshot, reward, { ...rewardFields(reward), link: "javascript:alert(1)" }, creation)).toThrow();
  });
  it("rejects invalid dates and empty titles", () => {
    expect(() => saveReward(snapshot, reward, { ...rewardFields(reward), expires_on: "2026-02-30" }, creation)).toThrow();
    expect(() => saveReward(snapshot, reward, { ...rewardFields(reward), title: " " }, creation)).toThrow();
  });
  it.each(["consume", "restock", "adjust"] as const)("uses captured revision for %s", kind => expect(rewardAction(snapshot, reward, kind, input)).toMatchObject({ target: { id: "r" }, expected_revision: 4, payload: { value: 2 } }));
  it("rejects overspending", () => expect(() => rewardAction(snapshot, reward, "consume", { ...input, value: "9" })).toThrow("残高"));
  it("omits absent optional notes rather than passing undefined into prepare", () => {
    for (const kind of ["consume", "restock"] as const) expect(rewardAction(snapshot, reward, kind, { ...input, reason: "" })).not.toHaveProperty("note");
  });
  it.each(["consume", "restock", "adjust", "mode", "remove"] as const)("blocks %s while archived", kind => expect(() => rewardAction(snapshot, { ...reward, archived_at: "2026-09-10" }, kind, input)).toThrow("アーカイブ"));
  it("archive retains balance/history", () => expect(archiveReward(reward)).toEqual({ command_type: "set_reward_archived", target: { id: "r" }, expected_revision: 4, payload: { archived: true } }));
  it("can restore an archived reward", () => expect(archiveReward({ ...reward, archived_at: "2026-09-10" })).toMatchObject({ payload: { archived: false } }));
  it.each(["adjust", "mode", "delete", "remove"] as const)("requires a reason for %s", kind => expect(() => rewardAction(snapshot, reward, kind, { ...input, reason: " " })).toThrow("理由"));
  it("cancels only the selected reward's event", () => {
    expect(rewardAction(snapshot, reward, "remove", { ...input, eventId: "e" })).toMatchObject({ command_type: "remove_reward_event", payload: { event_id: "e" }, expected_revision: 4 });
    expect(() => rewardAction(snapshot, reward, "remove", { ...input, eventId: "other" })).toThrow();
  });
  it("rejects cancellation making balance negative", () => expect(() => rewardAction({ ...snapshot, reward_events: [{ ...snapshot.reward_events[0], delta_value: 9 }] }, reward, "remove", { ...input, eventId: "e" })).toThrow("マイナス"));
  it("changes mode with explicit value, never automatic conversion", () => expect(rewardAction(snapshot, reward, "mode", { ...input, value: "123.45" })).toMatchObject({ command_type: "change_reward_mode", payload: { track_mode: "amount", value: 123.45, unit_yen: null } }));
  it("refuses same-mode reset", () => expect(() => rewardAction(snapshot, reward, "mode", { ...input, mode: "count" })).toThrow());
  it("deletes only selected reward via reasoned command", () => expect(rewardAction(snapshot, reward, "delete", input)).toMatchObject({ command_type: "delete_reward", target: { id: "r" }, payload: {}, note: "訂正理由" }));
});
