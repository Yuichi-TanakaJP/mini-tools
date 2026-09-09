import { describe, expect, it } from "vitest";
import { assignTags, deleteTag, saveTag } from "./tags";
import type { Workspace } from "./contracts";
const tag = { id: "t", name: "長期", revision: 3, created_at: "2026-09-09", updated_at: "2026-09-09" };
const snapshot = { profiles: [{ id: "p", revision: 9 }, { id: "other", revision: 2 }], tags: [tag],
  profile_tags: [{ profile_id: "other", tag_id: "t", created_at: "2026-09-09" }] } as Workspace;
describe("DB tag commands", () => {
  it("creates a trimmed name", () => expect(saveTag(null, " 新規 ", [tag])).toEqual({ command_type: "create_tag", target: {}, expected_revision: 0, payload: { name: "新規" } }));
  it("renames with the captured tag revision", () => expect(saveTag(tag, "変更", [tag])).toMatchObject({ command_type: "update_tag", target: { id: "t" }, expected_revision: 3 }));
  it("does not write unchanged names", () => expect(saveTag(tag, "長期", [tag])).toBeNull());
  it("rejects empty and duplicate names", () => {
    expect(() => saveTag(null, " ", [tag])).toThrow(); expect(() => saveTag(null, "長期", [tag])).toThrow();
  });
  it("assigns only the target profile with captured revision and deduplicated IDs", () => {
    expect(assignTags(snapshot, "p", ["t", "t"])).toEqual({ command_type: "set_profile_tags", target: { id: "p" }, expected_revision: 9, payload: { tag_ids: ["t"] } });
    expect(snapshot.profile_tags[0].profile_id).toBe("other");
  });
  it("explicitly clears only the selected profile's tags", () => expect(assignTags(snapshot, "other", [])).toMatchObject({ target: { id: "other" }, payload: { tag_ids: [] } }));
  it("does not write unchanged assignments", () => expect(assignTags(snapshot, "other", ["t"])).toBeNull());
  it("rejects missing profiles and unknown tags", () => {
    expect(() => assignTags(snapshot, "missing", [])).toThrow(); expect(() => assignTags(snapshot, "p", ["missing"])).toThrow();
  });
  it("deletes only the tag with a reason and captured revision", () => expect(deleteTag(tag)).toMatchObject({ command_type: "delete_tag", expected_revision: 3, target: { id: "t" }, payload: {}, note: expect.any(String) }));
});
