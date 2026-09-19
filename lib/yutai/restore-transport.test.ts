import { describe, expect, it, vi } from "vitest";
import { createRestoreTransport } from "./restore-transport";
import { collections, createWorkspaceExport } from "./transfer";
import type { Workspace } from "./contracts";

const id = "00000000-0000-4000-8000-000000000001";
const project = "https://yutai-test.supabase.co";
const hash = "a".repeat(64);
function fixture() {
  let current = { owner: id, sessionRevision: 1 };
  let online = true;
  const rpc = vi.fn(async (_owner: string, _name: string, _args: object, _signal: AbortSignal): Promise<unknown> => ({ schema_version: 1 }));
  return { rpc, transport: createRestoreTransport(rpc, () => current, () => online),
    expected: { ...current }, signal: new AbortController().signal,
    logout: () => { current = { owner: "other", sessionRevision: 2 }; },
    offline: () => { online = false; } };
}
async function file() {
  const date = "2026-09-10T00:00:00Z";
  const workspace = { schema_version: 1, selected_month: 1, as_of: date,
    counts: Object.fromEntries([...collections, "effective_selections"].map(key => [key, 0])),
    ...Object.fromEntries([...collections, "effective_selections"].map(key => [key, []])),
  } as unknown as Workspace;
  return JSON.stringify(await createWorkspaceExport(workspace, { owner_id: id, project_url: project }, date, date));
}
describe("restore transport", () => {
  it("validates file bytes and sends only the dedicated preview contract", async () => {
    const f = fixture();
    await f.transport.preview(await file(), project, " 確認用 ", id, f.expected, f.signal);
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith(id, "stock_notes_preview_yutai_restore", {
      p_input: { schema_version: 1, request_id: id, source_owner: id, source_project: project,
        workspace: JSON.parse(await file()).workspace, reason: "確認用" },
    }, f.signal);
  });
  it("rejects tampered files and different project before RPC", async () => {
    const f = fixture(), input = JSON.parse(await file()); input.workspace.as_of = "2026-09-11T00:00:00Z";
    await expect(f.transport.preview(JSON.stringify(input), project, "確認", id, f.expected, f.signal)).rejects.toThrow();
    await expect(f.transport.preview(await file(), "https://other.supabase.co", "確認", id, f.expected, f.signal)).rejects.toMatchObject({ kind: "rejected" });
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("does not submit invalid identifiers, blank or oversized reasons", async () => {
    const f = fixture(), text = await file();
    for (const reason of [" ", "a".repeat(1001)]) {
      await expect(f.transport.preview(text, project, reason, id, f.expected, f.signal)).rejects.toMatchObject({ kind: "rejected" });
    }
    await expect(f.transport.apply(id, "wrong", f.expected, f.signal)).rejects.toMatchObject({ kind: "rejected" });
    await expect(f.transport.get("wrong", f.expected, f.signal)).rejects.toMatchObject({ kind: "rejected" });
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("sends only plan and confirmation to apply, and only plan to recovery", async () => {
    const f = fixture();
    await f.transport.apply(id, hash, f.expected, f.signal);
    await f.transport.get(id, f.expected, f.signal);
    expect(f.rpc.mock.calls.map(call => [call[1], call[2]])).toEqual([
      ["stock_notes_apply_yutai_restore", { p_plan_id: id, p_confirmation_hash: hash }],
      ["stock_notes_get_yutai_restore", { p_plan_id: id }],
    ]);
  });
  it("never automatically retries a lost apply response", async () => {
    const f = fixture(); f.rpc.mockRejectedValueOnce(new Error("network"));
    await expect(f.transport.apply(id, hash, f.expected, f.signal)).rejects.toMatchObject({ kind: "unknown" });
    expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it("does not expose a response from an account that changed during apply", async () => {
    const f = fixture(); f.rpc.mockImplementationOnce(async () => { f.logout(); return { verified: true }; });
    await expect(f.transport.apply(id, hash, f.expected, f.signal)).rejects.toMatchObject({ kind: "unknown" });
  });
  it("refuses stale identity, offline and pre-aborted requests without sending", async () => {
    const f = fixture(); const abort = new AbortController(); abort.abort();
    await expect(f.transport.apply(id, hash, f.expected, abort.signal)).rejects.toMatchObject({ kind: "rejected" });
    f.offline();
    await expect(f.transport.apply(id, hash, f.expected, f.signal)).rejects.toMatchObject({ kind: "offline" });
    f.logout();
    await expect(f.transport.apply(id, hash, f.expected, f.signal)).rejects.toMatchObject({ kind: "auth" });
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("preserves a definite server conflict without retrying", async () => {
    const f = fixture(); f.rpc.mockRejectedValueOnce({ code: "40001" });
    await expect(f.transport.apply(id, hash, f.expected, f.signal)).rejects.toMatchObject({ kind: "conflict" });
    expect(f.rpc).toHaveBeenCalledTimes(1);
  });
});
