import type { CommandDraft, Workspace } from "./contracts";
export type YutaiTag = Workspace["tags"][number];
export function saveTag(original: YutaiTag | null, name: string, tags: readonly YutaiTag[]): CommandDraft | null {
  name = name.trim();
  if (!name) throw new Error("タグ名を入力してください。");
  if (tags.some(tag => tag.id !== original?.id && tag.name === name)) throw new Error("同名のタグがあります。");
  if (original?.name === name) return null;
  return original ? { command_type: "update_tag", target: { id: original.id }, expected_revision: original.revision, payload: { name } } :
    { command_type: "create_tag", target: {}, expected_revision: 0, payload: { name } };
}
export function assignTags(snapshot: Workspace, profileId: string, ids: readonly string[]): CommandDraft | null {
  const profile = snapshot.profiles.find(p => p.id === profileId);
  if (!profile) throw new Error("銘柄を再取得してください。");
  const next = [...new Set(ids)].sort();
  if (next.length > 100 || next.some(id => !snapshot.tags.some(tag => tag.id === id))) throw new Error("タグの選択を確認してください。");
  const previous = snapshot.profile_tags.filter(t => t.profile_id === profileId).map(t => t.tag_id).sort();
  if (JSON.stringify(next) === JSON.stringify(previous)) return null;
  return { command_type: "set_profile_tags", target: { id: profileId }, expected_revision: profile.revision, payload: { tag_ids: next } };
}
export function deleteTag(original: YutaiTag): CommandDraft {
  return { command_type: "delete_tag", target: { id: original.id }, expected_revision: original.revision,
    payload: {}, note: "タグ管理から削除。タグと銘柄への付与を解除し、銘柄メモ・月別設定・履歴・残高は保持。" };
}
