import { describe, expect, it, vi } from "vitest";
import { RewardV2Repository } from "./reward-v2-repository";

function ledger(asOf = "2026-09-13T00:00:00Z") {
  return { schema_version:2, as_of:asOf, today:"2026-09-13", counts:{accounts:0,entitlements:0,unassigned_rewards:0}, accounts:[], entitlements:[], unassigned_rewards:[] };
}
function fixture() {
  let owner: string | null = "A";
  const getSession = vi.fn(async () => ({ data:{ session: owner ? { user:{id:owner} } : null } }));
  const rpc = vi.fn(async (name:string,args:Record<string,unknown>): Promise<{ data: unknown; error: { message?: string; code?: string } | null }> => {
    if (name === "stock_notes_get_yutai_reward_ledger_v2") return { data:ledger(), error:null };
    const input = args.p_input as Record<string,unknown>;
    return { data:{ schema_version:2, request_id:input.request_id, replayed:false, command_type:input.command_type, target_id:"target", revision:1 }, error:null };
  });
  const repository = new RewardV2Repository({ auth:{getSession}, rpc });
  repository.setIdentity("A",1);
  return { repository,rpc,getSession,setOwner:(id:string|null)=>{owner=id;} };
}

describe("Reward Model v2 repository", () => {
  it("pins reads to the expected owner and clears data immediately on owner change", async () => {
    const f=fixture(); await f.repository.load("2026-09-13");
    expect(f.repository.getSnapshot()).toMatchObject({status:"ready",ownerId:"A"});
    expect(f.rpc).toHaveBeenCalledWith("stock_notes_get_yutai_reward_ledger_v2",{p_today:"2026-09-13"});
    f.setOwner("B"); f.repository.setIdentity("B",2);
    expect(f.repository.getSnapshot()).toMatchObject({ownerId:"B",status:"idle",ledger:null});
  });
  it("does not publish a delayed A response after the session changes to B", async () => {
    const f=fixture(); let release!:(v:{data:ReturnType<typeof ledger>;error:null})=>void;
    f.rpc.mockImplementationOnce(() => new Promise(resolve=>{release=resolve;}));
    const pending=f.repository.load("2026-09-13");
    await vi.waitFor(() => expect(f.rpc).toHaveBeenCalledTimes(1));
    f.setOwner("B"); f.repository.setIdentity("B",2); release({data:ledger(),error:null}); await pending;
    expect(f.repository.getSnapshot()).toMatchObject({ownerId:"B",ledger:null});
  });
  it("does not let an older same-owner read overwrite a newer read", async () => {
    const f=fixture(); let release!:(v:{data:ReturnType<typeof ledger>;error:null})=>void;
    f.rpc.mockImplementationOnce(() => new Promise(resolve=>{release=resolve;}));
    const first=f.repository.load("2026-09-13");
    await vi.waitFor(() => expect(f.rpc).toHaveBeenCalledTimes(1));
    f.rpc.mockResolvedValueOnce({data:ledger("2026-09-13T02:00:00Z"),error:null});
    await f.repository.load("2026-09-13");
    release({data:ledger("2026-09-13T01:00:00Z"),error:null});
    await first;
    expect(f.repository.getSnapshot().ledger?.as_of).toBe("2026-09-13T02:00:00Z");
  });
  it("retains request_id and occurred_at for an uncertain retry, even across a refresh, and blocks a different write", async () => {
    const f=fixture(); f.rpc.mockImplementationOnce(async()=>{ throw new Error("fetch failed"); });
    const draft = {command_type:"create_account" as const,target:{},payload:{},expected_revision:0,note:"test"};
    await f.repository.save(draft);
    const wire=f.repository.getSnapshot().uncertain;
    expect(wire?.request_id).toBeTruthy();
    expect(wire?.occurred_at).toBeTruthy();

    await f.repository.load("2026-09-13");
    expect(f.repository.getSnapshot().uncertain?.request_id).toBe(wire?.request_id);

    const beforeBlocked = f.rpc.mock.calls.length;
    const blocked = await f.repository.save({command_type:"create_account",target:{},payload:{},expected_revision:0,note:"different"});
    expect(blocked).toBeNull();
    expect(f.rpc.mock.calls.length).toBe(beforeBlocked);

    f.rpc.mockImplementationOnce(async(_name,args)=>{const input=args.p_input as Record<string,unknown>;return {data:{schema_version:2,request_id:input.request_id,replayed:true,command_type:input.command_type,target_id:"target",revision:1},error:null};});
    await f.repository.retryUncertain();
    const calls=f.rpc.mock.calls.filter(([name])=>name==="stock_notes_record_yutai_v2_command");
    const first = calls[0][1].p_input as Record<string,unknown>;
    const second = calls[1][1].p_input as Record<string,unknown>;
    expect(second.request_id).toBe(first.request_id);
    expect(second.occurred_at).toBe(first.occurred_at);
  });
  it("retries an uncertain entitlement usage with the original command and occurrence time", async () => {
    const f = fixture();
    await f.repository.load("2026-09-13");
    f.rpc.mockImplementationOnce(async () => { throw new Error("fetch failed"); });
    const occurredAt = "2026-09-12T12:30:00.000Z";
    const draft = {
      command_type: "record_entitlement_usage" as const,
      target: { id: "entitlement-1" },
      payload: { value_yen: 2000, native_quantity: 2, native_unit: "人" },
      expected_revision: 3,
    };
    expect(await f.repository.save(draft, undefined, occurredAt)).toBeNull();
    const pending = f.repository.getSnapshot().uncertain;
    expect(pending).toMatchObject({ ...draft, occurred_at: occurredAt });
    expect(await f.repository.save(draft)).toBeNull();

    f.rpc.mockImplementationOnce(async (_name, args) => {
      const input = args.p_input as Record<string, unknown>;
      return { data: { schema_version: 2, request_id: input.request_id, replayed: true,
        command_type: input.command_type, target_id: "entitlement-1", revision: 4 }, error: null };
    });
    expect(await f.repository.retryUncertain()).toMatchObject({ command_type: "record_entitlement_usage", replayed: true });
    const writes = f.rpc.mock.calls.filter(([name]) => name === "stock_notes_record_yutai_v2_command");
    expect(writes).toHaveLength(2);
    expect(writes[1][1].p_input).toEqual(writes[0][1].p_input);
    expect(f.repository.getSnapshot().uncertain).toBeNull();
  });
  it("treats a malformed successful write reply as uncertain but a database rejection as definitely not saved", async () => {
    const f=fixture();
    f.rpc.mockImplementationOnce(async()=>({data:{schema_version:2},error:null}));
    await f.repository.save({command_type:"create_account",target:{},payload:{},expected_revision:0,note:"malformed"});
    expect(f.repository.getSnapshot().uncertain?.command_type).toBe("create_account");

    f.setOwner("B"); f.repository.setIdentity("B",2); f.setOwner("A"); f.repository.setIdentity("A",3);
    f.rpc.mockImplementationOnce(async()=>({data:null,error:{message:"REVISION_CONFLICT",code:"40001"}}));
    await f.repository.save({command_type:"create_account",target:{},payload:{},expected_revision:0,note:"conflict"});
    expect(f.repository.getSnapshot().uncertain).toBeNull();
  });
  it("keeps a transport failure returned as an RPC error uncertain", async () => {
    const f = fixture();
    f.rpc.mockResolvedValueOnce({ data: null, error: { message: "TypeError: Failed to fetch", code: "" } });
    await f.repository.save({ command_type: "record_entitlement_usage", target: { id: "entitlement-1" },
      payload: { value_yen: 2000 }, expected_revision: 1 });
    expect(f.repository.getSnapshot().uncertain?.command_type).toBe("record_entitlement_usage");
  });
});
