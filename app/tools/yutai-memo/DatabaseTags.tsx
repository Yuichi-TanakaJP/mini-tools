"use client";
import { useState } from "react";
import type { CommandDraft, Workspace } from "@/lib/yutai/contracts";
import { assignTags, deleteTag, saveTag } from "@/lib/yutai/tags";
import styles from "./DatabaseMemo.module.css";

export function DatabaseTags({ snapshot, profileId, onSave, onClose }: { snapshot: Workspace; profileId: string | null;
  onSave: (command: CommandDraft | null) => void; onClose: () => void }) {
  const [tagId, setTagId] = useState("");
  const [name, setName] = useState("");
  const [selected, setSelected] = useState(() => snapshot.profile_tags.filter(t => t.profile_id === profileId).map(t => t.tag_id));
  const [error, setError] = useState("");
  const original = snapshot.tags.find(tag => tag.id === tagId) ?? null;
  const execute = (make: () => CommandDraft | null) => { try { onSave(make()); } catch (e) { setError((e as Error).message); } };
  return <section role="dialog" aria-label={profileId ? "銘柄タグ編集" : "タグ管理"} className={styles.editor}>
    <h2>{profileId ? "銘柄へのタグ付与" : "タグ管理"}</h2>
    {profileId ? <form onSubmit={e => { e.preventDefault(); execute(() => assignTags(snapshot, profileId, selected)); }}>
      <p>{snapshot.profiles.find(p => p.id === profileId)?.display_name}のタグだけを変更します。</p>
      {snapshot.tags.length === 0 && <p>タグがありません。閉じて「タグ管理」から作成してください。</p>}
      {snapshot.tags.map(tag => <label key={tag.id}><input type="checkbox" checked={selected.includes(tag.id)}
        onChange={e => setSelected(prev => e.target.checked ? [...prev, tag.id] : prev.filter(id => id !== tag.id))} />{tag.name}</label>)}
      <button type="submit">タグ付与を保存</button>
    </form> : <form onSubmit={e => { e.preventDefault(); execute(() => saveTag(original, name, snapshot.tags)); }}>
      <label>編集するタグ<select autoFocus value={tagId} onChange={e => { setTagId(e.target.value); setName(snapshot.tags.find(t => t.id === e.target.value)?.name ?? ""); setError(""); }}>
        <option value="">新規作成</option>{snapshot.tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
      </select></label>
      <label>タグ名<input value={name} onChange={e => setName(e.target.value)} /></label>
      <button type="submit">タグを保存</button>
      {original && <button type="button" onClick={() => {
        const count = snapshot.profile_tags.filter(t => t.tag_id === original.id).length;
        if (window.confirm(`「${original.name}」と${count}銘柄への付与を削除します。銘柄メモ・月別設定・仕込み履歴・優待残高は残ります。よろしいですか？`)) execute(() => deleteTag(original));
      }}>タグを削除</button>}
    </form>}
    {error && <p role="alert">{error}</p>}<button type="button" onClick={onClose}>閉じる</button>
  </section>;
}
