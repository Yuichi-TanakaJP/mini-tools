# 優待銘柄メモ帳 仕様

## Supabase接続の隔離検証（工程4・基本編集）

`NEXT_PUBLIC_YUTAI_MEMO_DB_PREVIEW=true` の場合のみ、同じURLでDB用の基本編集画面を表示する。
フラグ未設定の本番動作は以下の従来仕様のまま。単独で本番有効化しない。
DB検証モードでは旧ToolClientをマウントせず、LocalStorage読込・書戻し・タグ自動移行・
月替わりアーカイブを起動しない。DBへのfallback書込みや初回再importはない。

接続済み操作:

- 銘柄一覧・検索・非表示を含む表示、銘柄新規追加、メモ/方針/優先度/長期条件/URL/1株開始日の編集
- 権利月1〜12の追加と月別設定編集（株数、優待価値、仕込み開始、長期フラグ、月別メモ）
- 非表示/再表示。物理削除せず、月別設定・履歴・残高を保持する
- タグ名と全年度cycleの読み取り表示

既存銘柄コードは変更不可。新規時は方針未設定、優先度★★。
月別未設定はNULL、仕込み開始0は権利月。株数/優待価値の小数を丸めず、入力の空欄はNULLにする。
月編集は対象月だけ、メモ編集は変更したprofile項目だけを送る。銘柄既定リード月数や
旧1株開始の原文など、フォーム対象外の情報は更新しない。曖昧な旧開始日に日を補完しない。
編集を開いた時のrevisionを保持し、保存成功後の再取得が終わるまで編集を止める。
競合は上書きせず再編集、応答不明は同じ要求IDで再確認する。

未接続: タグ編集、一括操作、履歴編集/アーカイブ、旧import/export、信用情報の個人別表示、通知。
これらを削除した完成版ではなく接続途中の検証画面であり、メモ帳全体/工程4を完了とはしない。
実端末確認・復旧確認・全画面の同時切替は工程5/6。

実装: [DatabaseMemo](../../../app/tools/yutai-memo/DatabaseMemo.tsx)、
[編集command](../../../lib/yutai/memo.ts)。
[共通層](../cross-cutting/yutai-repository.md)、
[導入判断](../../decision-log/2026-09-09-yutai-memo-db-basics.md)も参照。

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

- 「取得済み」はユーザー運用では「売り・買いを仕込んだ」ことを表す。`acquired` を true にした時刻を `acquiredMarkedAt` に記録し、その時点から次に到来する権利月（当月を含む）を `acquiredEntitlementMonthKey` に固定保存する。仕込み開始設定の有無には依存せず、アーカイブ時にも再計算しない。通常は自動選択のまま使い、誤っている場合だけ取得カードの対象年月から変更できる。取得履歴の取得日には仕込み日を使う（[2026-08-07 次回権利月の固定](../../decision-log/2026-08-07-yutai-acquired-entitlement-lock.md)）。
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
