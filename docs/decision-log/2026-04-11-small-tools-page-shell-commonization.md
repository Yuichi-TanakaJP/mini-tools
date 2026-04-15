# 2026-04-11 小さな入力系 tool の page shell 共通化

## 結論

`charcount` と `total` は、固有ロジックは各 `ToolClient.tsx` に残しつつ、ページ骨格だけ `components/SimpleInputToolLayout.tsx` に共通化する。

## 背景

- `charcount` と `total` は UI 骨格がかなり近い
- 共通点は、戻るナビ、ヒーロー見出し、2カラムレイアウト、下部の共有導線
- 一方で、入力欄や結果カードの中身はそれぞれ独自で、過度な抽象化は保守性を下げやすい

## 決めたこと

- 共通化対象は page shell に限定する
- shell は `badge` / `title` / `description` / `inputPanel` / `resultPanel` / `shareText` を props で受ける
- レイアウト差分は `maxWidth` / `resultColumnWidth` / `mobileBreakpoint` で吸収する
- 各 tool の入力状態、計算、ボタン挙動、注記文言は引き続き各 `ToolClient.tsx` 側で持つ

## 理由

- 新規の小さな入力系 tool を追加するとき、まず shell を再利用できる
- 見た目の統一感を出しつつ、tool 固有の UI 変更をしやすい
- `charcount` のように入力欄の高さ固定や補足注記が少し特殊でも、slot 方式なら無理なく対応できる

## 影響範囲

- `app/tools/charcount/ToolClient.tsx`
- `app/tools/total/ToolClient.tsx`
- `components/SimpleInputToolLayout.tsx`

## 補足

- 現時点では `charcount` と `total` を対象にする
- 他の小さな入力系 tool へ広げる場合も、まずは page shell の一致度を見てから適用する

## 実装完了（#219）

- `components/SimpleInputToolLayout.tsx` として実装済み
- `app/tools/charcount/ToolClient.tsx` / `app/tools/total/ToolClient.tsx` に適用済み
