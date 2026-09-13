import { describe, expect, it, vi } from "vitest";
import { RewardV2Repository } from "./reward-v2-repository";

function ledger() {
  return { schema_version:2, as_of:"2026-09-13T00:00:00Z", today:"2026-09-13", counts:{accounts:0,entitlements:0,unassigned_rewards:0}, accounts:[], entitlements:[], unassigned_rewards:[] };
}
function fixture() {
  let owner: string | null = "A";
  const getSession = vi.fn(async () => ({ data:{ session: owner ? { user:{id:owner} } : null } }));
  const rpc = vi.fn(async (name:string,args:Record<string,unknown>) => {
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
    const pending=f.repository.load("2026-09-13"); await Promise.resolve();
    f.setOwner("B"); f.repository.setIdentity("B",2); release({data:ledger(),error:null}); await pending;
    expect(f.repository.getSnapshot()).toMatchObject({ownerId:"B",ledger:null});
  });
  it("retains the exact request_id for an uncertain retry", async () => {
    const f=fixture(); f.rpc.mockImplementationOnce(async()=>({data:null,error:{message:"fetch failed"}}));
    await f.repository.save({command_type:"create_account",target:{},payload:{},expected_revision:0,note:"test"});
    const wire=f.repository.getSnapshot().uncertain; expect(wire?.request_id).toBeTruthy();
    f.rpc.mockImplementationOnce(async(_name,args)=>{const input=args.p_input as Record<string,unknown>;return {data:{schema_version:2,request_id:input.request_id,replayed:true,command_type:input.command_type,target_id:"target",revision:1},error:null};});
    await f.repository.retryUncertain();
    const calls=f.rpc.mock.calls.filter(([name])=>name==="stock_notes_record_yutai_v2_command");
    expect((calls[0][1].p_input as Record<string,unknown>).request_id).toBe((calls[1][1].p_input as Record<string,unknown>).request_id);
  });
});
