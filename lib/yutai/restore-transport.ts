import { classifyFailure, YutaiFailure } from "./repository";
import { parseWorkspaceExport } from "./transfer";

type Identity = { owner: string | null; sessionRevision: number };
type Rpc = (owner: string, name: string, args: object, signal: AbortSignal) => Promise<unknown>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Narrow transport only: callers must validate responses and obtain confirmation.
 * Never retries an apply, creates a replacement plan, or stores files locally.
 */
export function createRestoreTransport(rpc: Rpc, identity: () => Identity, online: () => boolean) {
  const check = (expected: Identity) => {
    const current = identity();
    if (!expected.owner || current.owner !== expected.owner || current.sessionRevision !== expected.sessionRevision) {
      throw new YutaiFailure("auth");
    }
  };
  const send = async (expected: Identity, name: string, args: object, signal: AbortSignal) => {
    check(expected);
    if (!online()) throw new YutaiFailure("offline");
    if (signal.aborted) throw new YutaiFailure("rejected");
    try {
      const result = await rpc(expected.owner!, name, args, signal);
      // A successful response for an old login must never reach the new user's UI.
      // For writes this also means the outcome cannot be claimed as "not saved".
      try { check(expected); } catch { throw new YutaiFailure("unknown"); }
      return result;
    } catch (error) {
      try { check(expected); } catch { throw new YutaiFailure("unknown"); }
      throw classifyFailure(error);
    }
  };
  return {
    async preview(text: string, project: string, reason: string, requestId: string, expected: Identity, signal: AbortSignal) {
      check(expected);
      if (!uuid.test(requestId) || !reason.trim() || reason.trim().length > 1000) throw new YutaiFailure("rejected");
      // Revalidate the actual bytes, not an object that may have changed after selection.
      const file = await parseWorkspaceExport(text);
      check(expected);
      if (file.source.owner_id !== expected.owner || file.source.project_url !== project) throw new YutaiFailure("rejected");
      return send(expected, "stock_notes_preview_yutai_restore", { p_input: {
        schema_version: 1, request_id: requestId, source_owner: file.source.owner_id,
        source_project: file.source.project_url, workspace: file.workspace, reason: reason.trim(),
      } }, signal);
    },
    apply(planId: string, confirmationHash: string, expected: Identity, signal: AbortSignal) {
      if (!uuid.test(planId) || !/^[0-9a-f]{64}$/.test(confirmationHash)) return Promise.reject(new YutaiFailure("rejected"));
      return send(expected, "stock_notes_apply_yutai_restore", { p_plan_id: planId, p_confirmation_hash: confirmationHash }, signal);
    },
    get(planId: string, expected: Identity, signal: AbortSignal) {
      if (!uuid.test(planId)) return Promise.reject(new YutaiFailure("rejected"));
      return send(expected, "stock_notes_get_yutai_restore", { p_plan_id: planId }, signal);
    },
  };
}
