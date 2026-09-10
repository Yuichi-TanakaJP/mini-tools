import { describe, expect, it, vi } from "vitest";
import { YutaiRepository } from "./repository";
import { RestoreController } from "./restore-controller";
import { parseRestorePreview, parseRestoreReceipt, parseRestoreStatus, snapshotChanges, snapshotOf, snapshotWorkspace } from "./restore-contracts";
import { collections, parseWorkspaceExport } from "./transfer";
import type { Workspace } from "./contracts";

const id = "00000000-0000-4000-8000-000000000001", now = Date.parse("2026-09-10T00:00:00Z");
function fixture() {
  let clock = now;
  const empty = Object.fromEntries(collections.map(k => [k, []]));
  const before = snapshotOf(snapshotWorkspace({ ...empty, tags: [{ id, name: "before", revision: 1, created_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() }] }));
  const after = structuredClone(before); after.tags[0].name = "after"; after.tags[0].revision = 2;
  const preview = { schema_version: 1, plan_id: id, replayed: false, expires_at: new Date(now + 600_000).toISOString(), before, after,
    changes: snapshotChanges(before, after), confirmation_hash: "a".repeat(64) };
  const receipt = { schema_version: 1, plan_id: id, replayed: false, verified: true, after, applied_at: new Date(now).toISOString() };
  const read = vi.fn(async (): Promise<Workspace> => snapshotWorkspace(after));
  const write = vi.fn(); const repo = new YutaiRepository({ read, write }); repo.setOwner(id);
  const transport = { preview: vi.fn(async (): Promise<unknown> => preview), apply: vi.fn(async (): Promise<unknown> => receipt),
    get: vi.fn(async (): Promise<unknown> => ({ schema_version: 1, preview, receipt, status: "applied" })) };
  const controller = new RestoreController(repo, transport, "https://yutai-test.supabase.co", () => clock);
  const ready = async () => { await controller.preview("checked by transport", "test"); await controller.backup(); controller.markBackupDownloaded(id); };
  return { repo, read, write, controller, transport, ready, preview, receipt, before, after, expire: () => { clock += 600_001; } };
}
describe("restore response validation", () => {
  it("checks all arrays, exact field diffs, immutable preview and receipt identity", () => {
    const f = fixture(); const p = parseRestorePreview(f.preview);
    expect(Object.isFrozen(p.after.tags[0])).toBe(true);
    expect(parseRestoreReceipt(f.receipt, p).verified).toBe(true);
    expect(() => parseRestorePreview({ ...f.preview, after: { tags: [] } })).toThrow();
    expect(() => parseRestorePreview({ ...f.preview, changes: { ...f.preview.changes, tags: [] } })).toThrow();
    expect(() => parseRestoreReceipt({ ...f.receipt, after: f.before }, p)).toThrow();
    expect(() => parseRestoreReceipt({ ...f.receipt, plan_id: "other" }, p)).toThrow();
    expect(() => parseRestoreStatus({ schema_version: 1, preview: f.preview, receipt: null, status: "applied" }, id)).toThrow();
  });
  it("compares additions, deletions and every field independent of row order", () => {
    const f = fixture(), after = structuredClone(f.before);
    after.tags = [{ ...after.tags[0], id: "new" }];
    expect(snapshotChanges(f.before, after).tags.map(c => c.action)).toEqual(["delete", "add"]);
  });
});
describe("restore confirmation lifecycle", () => {
  it("rejects concurrent business changes for additive imports", async () => {
    const f = fixture();
    await f.controller.preview("file", "legacy import", true);
    expect(f.controller.getSnapshot().status).toBe("error");
    await f.controller.apply(id, true);
    expect(f.transport.apply).not.toHaveBeenCalled();
    expect(f.repo.getSnapshot(1).maintenance).toBe(false);
  });
  it("allows revision-only changes for additive imports", async () => {
    const f = fixture();
    f.after.tags[0].name = f.before.tags[0].name;
    f.preview.changes = snapshotChanges(f.before, f.after);
    await f.controller.preview("file", "legacy import", true);
    expect(f.controller.getSnapshot().status).toBe("preview");
    expect(f.transport.apply).not.toHaveBeenCalled();
  });
  it("backs up before rows, requires explicit confirmation, then fresh-read verifies all collections", async () => {
    const f = fixture(); await f.controller.preview("file", "reason");
    expect(f.repo.getSnapshot(1).maintenance).toBe(true);
    await f.controller.apply(id, true); expect(f.transport.apply).not.toHaveBeenCalled();
    const backup = await f.controller.backup(); expect(backup.filename).toContain(id);
    expect((await parseWorkspaceExport(backup.text)).workspace.tags).toEqual(f.before.tags);
    f.controller.markBackupDownloaded(id); await f.controller.apply(id, false); expect(f.transport.apply).not.toHaveBeenCalled();
    await f.controller.apply(id, true);
    expect(f.controller.getSnapshot().status).toBe("verified"); expect(f.read).toHaveBeenCalledOnce();
    expect(f.repo.getSnapshot(1).maintenance).toBe(false);
  });
  it("blocks daily writes while a preview is being reviewed", async () => {
    const f = fixture(); await f.ready();
    const token = f.repo.prepare({ command_type: "set_selection", expected_revision: 0, payload: {} } as never);
    expect(await f.repo.save(token, 1)).toMatchObject({ status: "not_saved", error: { kind: "conflict" } });
    expect(f.write).not.toHaveBeenCalled(); f.controller.reset(); expect(f.repo.getSnapshot(1).maintenance).toBe(false);
  });
  it("does not submit expired or duplicate apply clicks", async () => {
    const f = fixture(); await f.ready(); f.expire(); await f.controller.apply(id, true); expect(f.transport.apply).not.toHaveBeenCalled();
    const g = fixture(); await g.ready(); await Promise.all([g.controller.apply(id, true), g.controller.apply(id, true)]); expect(g.transport.apply).toHaveBeenCalledOnce();
  });
  it("resolves a lost response with GET, never reapplies or starts another preview", async () => {
    const f = fixture(); await f.ready(); f.transport.apply.mockRejectedValueOnce(new Error("lost"));
    await f.controller.apply(id, true); expect(f.controller.getSnapshot().status).toBe("uncertain");
    f.controller.reset(); await f.controller.preview("other", "other"); expect(f.transport.preview).toHaveBeenCalledOnce();
    await f.controller.recover(id); expect(f.controller.getSnapshot().status).toBe("verified"); expect(f.transport.apply).toHaveBeenCalledOnce();
  });
  it("keeps only the same plan available when GET is still prepared", async () => {
    const f = fixture(); await f.ready(); f.transport.apply.mockRejectedValueOnce(new Error("lost"));
    await f.controller.apply(id, true);
    f.transport.get.mockResolvedValueOnce({ schema_version: 1, preview: f.preview, receipt: null, status: "prepared" });
    await f.controller.recover(id); f.controller.reset();
    expect(f.controller.getSnapshot()).toMatchObject({ status: "preview", planId: id, appliedAttempt: true, backupReady: false });
    expect(f.repo.getSnapshot(1).maintenance).toBe(true);
  });
  it("a fresh controller can recover a downloaded plan without an apply request", async () => {
    const f = fixture(); await f.controller.recover(id);
    expect(f.controller.getSnapshot().status).toBe("verified"); expect(f.transport.apply).not.toHaveBeenCalled();
  });
  it("does not claim success with a malformed receipt or failed readback", async () => {
    const f = fixture(); await f.ready(); f.transport.apply.mockResolvedValueOnce({ verified: true });
    await f.controller.apply(id, true); expect(f.controller.getSnapshot().status).toBe("uncertain");
    const g = fixture(); await g.ready(); g.read.mockRejectedValueOnce(new Error("offline"));
    await g.controller.apply(id, true); expect(g.controller.getSnapshot()).toMatchObject({ status: "uncertain", receipt: { verified: true } });
    await g.controller.recover(id); expect(g.controller.getSnapshot().status).toBe("verified"); expect(g.transport.apply).toHaveBeenCalledOnce();
  });
  it("reports later DB changes as different, not restore failure or verified", async () => {
    const f = fixture(); await f.ready(); f.read.mockResolvedValueOnce(snapshotWorkspace(f.before));
    await f.controller.apply(id, true); expect(f.controller.getSnapshot().status).toBe("different");
  });
  it("clears private state on account switch and discards delayed responses", async () => {
    const f = fixture(); await f.ready(); f.transport.apply.mockImplementationOnce(async () => { f.repo.setOwner("other"); return f.receipt; });
    await f.controller.apply(id, true);
    expect(f.controller.getSnapshot()).toMatchObject({ status: "idle", preview: null, receipt: null, planId: "" });
    expect(f.repo.getSnapshot(1).maintenance).toBe(false);
  });
  it("rejects malformed preview without permitting apply", async () => {
    const f = fixture(); f.transport.preview.mockResolvedValueOnce({ schema_version: 1 });
    await f.controller.preview("file", "reason"); await f.controller.apply(id, true);
    expect(f.controller.getSnapshot().status).toBe("error"); expect(f.transport.apply).not.toHaveBeenCalled();
  });
  it("a definite DB conflict permits a fresh preview but never auto-overwrites", async () => {
    const f = fixture(); await f.ready(); f.transport.apply.mockRejectedValueOnce({ code: "40001" });
    await f.controller.apply(id, true);
    expect(f.controller.getSnapshot()).toMatchObject({ status: "error", appliedAttempt: false });
    expect(f.repo.getSnapshot(1).maintenance).toBe(false); expect(f.transport.apply).toHaveBeenCalledOnce();
    f.controller.reset(); await f.controller.preview("new", "new"); expect(f.transport.preview).toHaveBeenCalledTimes(2);
  });
  it("resolves an expired recovered plan only by explicit same-plan request", async () => {
    const f = fixture(); f.preview.expires_at = new Date(now - 1).toISOString();
    f.transport.get.mockResolvedValueOnce({ schema_version: 1, preview: f.preview, receipt: null, status: "expired" });
    await f.controller.recover(id); f.controller.reset();
    expect(f.controller.getSnapshot()).toMatchObject({ status: "preview", appliedAttempt: true });
    await f.controller.backup(); f.controller.markBackupDownloaded(id);
    f.transport.apply.mockRejectedValueOnce({ code: "22023" });
    await f.controller.apply(id, true);
    expect(f.controller.getSnapshot()).toMatchObject({ status: "error", appliedAttempt: false });
    expect(f.transport.preview).not.toHaveBeenCalled();
  });
  it("cannot acquire a restore lease while a daily write is pending", async () => {
    const f = fixture(); let finish: (value: unknown) => void;
    f.write.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const token = f.repo.prepare({ command_type: "set_selection", expected_revision: 0, payload: {} } as never);
    const pending = f.repo.save(token, 1); await f.controller.preview("file", "reason");
    expect(f.transport.preview).not.toHaveBeenCalled(); finish!(null); await pending;
  });
});
