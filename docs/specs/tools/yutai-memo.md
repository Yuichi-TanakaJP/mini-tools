# 優待銘柄メモ帳 仕様

## 概要

- URL: `/tools/yutai-memo`
- 分類: LocalStorage 系ツール
- 主な用途: 株主優待銘柄の候補、取得状況、長期条件、タグ、関連リンクを端末内で管理する

## 対象ユーザー

- 株主優待銘柄を自分用に整理したいユーザー
- 権利月、長期条件、取得済み履歴、注意メモをブラウザ内で管理したいユーザー
- サーバー保存ではなく、端末ローカルで個人メモを完結させたいユーザー

## 画面仕様

### 主な画面要素

- 銘柄一覧
- 銘柄追加・編集フォーム
- タグ管理
- タグ / 状態による絞り込み
- 取得済み銘柄の月別アコーディオン
- 優待カレンダーからの取り込み項目表示
- 優待カレンダー上での追加済みメモ簡易編集

### 入力

銘柄メモは主に次の項目を持つ。

- 銘柄名
- 銘柄コード
- 権利月
- タグ
- クロス種別
- 早打ち目安
- 仕込み開始時期（権利月の0〜11か月前）
- 関連リンク
- 任期条件
- 取得済み状態
- 1株保有開始月
- 優先度
- メモ
- 取り込み元情報
- みんかぶ優待 URL
- 公式優待 URL
- 最低投資金額テキスト
- 優待カテゴリタグ

### 出力

- 登録済み銘柄の一覧
- 権利月軸と仕込み月軸による月別一覧
- タグや取得状態に応じた表示切替
- 取得済み銘柄の年月別一覧
- 関連 URL へのリンク
- 優待カレンダー側から追加済みメモの本文・任期条件・早打ち目安・取得済み状態などを更新できる
- 優待カレンダー側から誤追加を解除できる。単月メモは削除し、複数月メモは対象月だけを外す

## 取得（＝仕込み）と月替わりアーカイブ

- 「取得済み」はユーザー運用では「売り・買いを仕込んだ」ことを表す。`acquired` を true にした時刻を `acquiredMarkedAt` に記録し、取得履歴（アーカイブ）の取得日にはこの仕込み日を使う（未設定の旧データはアーカイブ時刻でフォールバック）。取得日から権利月への紐づけはリード期間を当年に寄せる（[2026-07-12 取得実績のひもづけ](../../decision-log/2026-07-12-yutai-entitlement-attribution-lead-time.md)）。
- 月替わりの一括アーカイブ提案は、**権利月に到達／経過した取得済みだけ**を対象にする。権利月より前の事前仕込みは `acquired` のまま維持し、リセットしない（[2026-07-12 取得＝仕込みの一本化](../../decision-log/2026-07-12-yutai-acquisition-equals-prep-lifecycle.md)）。

## データ仕様

### 取得元

- サーバー API は使わない
- 初期表示時は Client Component 側で LocalStorage を読む
- SSR では LocalStorage を参照しない

### 保存先

- ブラウザの LocalStorage
- データは端末・ブラウザごとに独立する
- サーバー DB には保存しない

### fallback

- LocalStorage にデータがない場合は空状態を表示する
- LocalStorage 読み込みに失敗しても、ページ全体をクラッシュさせない

## 状態・エラー表示

| 状態 | 表示・挙動 |
|---|---|
| 初回表示 | ClientOnly ラッパーで hydration 後にツール UI を表示する |
| データなし | 銘柄なしの空状態を表示する |
| 保存失敗 | 可能な範囲でエラー表示または空状態に留め、ページ全体を落とさない |
| 別タブ利用 | 同じブラウザの同じ LocalStorage を参照する |

## premium / 権限制御

- premium 制限なし
- ログイン不要で利用できる

## 関連実装

- [app/tools/yutai-memo/page.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/yutai-memo/page.tsx)
- [app/tools/yutai-memo/ToolClient.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/yutai-memo/ToolClient.tsx)
- [app/tools/yutai-memo/storage.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/yutai-memo/storage.ts)
- [app/tools/yutai-memo/types.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/yutai-memo/types.ts)
- [app/tools/yutai-candidates/ToolClient.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/yutai-candidates/ToolClient.tsx)

## 関連 docs

- UAT: [優待銘柄メモ帳 UAT](../../uat/yutai-memo.md)
- Decision Log:
  - [yutai-memo タグ対応と hydration 問題](../../decision-log/2026-01-17-yutai-memo-user-tags-and-hydration.md)
  - [yutai-memo 取得リスト年月アコーディオン設計](../../decision-log/2026-03-13-yutai-memo-acquired-list-accordion-design.md)
  - [yutai-memo と優待カレンダー連携フィールド整理](../../decision-log/2026-05-04-yutai-memo-calendar-import-field-policy.md)
  - [SSR / Hydration / localStorage 運用ガイド](../../decision-log/2026-03-12-ssr-localstorage-hydration-guidelines.md)
