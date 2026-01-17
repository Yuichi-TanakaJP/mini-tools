# yutai-memo ユーザー定義タグ対応と hydration 問題の整理

## 背景

- yutai-memo にユーザー定義タグ（追加/編集/削除）を実装
- localStorage をデータソースとして利用

## 実装内容

- タグマスターを localStorage に保存
- メモは tagIds で参照
- タグ削除時は、付与済みメモから自動で外す（仕様 A）
- タグ管理用モーダル UI を追加

## 発生した問題

- `<select><option>` の内容が SSR と Client で不一致
- hydration error が発生

## 原因

- Server Render 時は localStorage が読めない
- Client 初回描画時にタグ内容が変わるため HTML が不一致

## 対応

- ToolClient を ClientOnly wrapper 経由で読み込む
- next/dynamic + ssr:false を Client Component 内で使用

## 学び

- localStorage 前提のツールは SSR しない方が安全
- App Router では page.tsx は Server Component である点に注意
- Squash merge ではローカルブランチ削除に -D が必要

## 今後の方針

- 同様のツール（charcount / total / yutai-expiry）も確認対象
