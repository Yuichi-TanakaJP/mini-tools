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
- タグの作成・名称変更・削除、銘柄への付け外し、タグ名の表示
- 全年度cycleの一覧、追加、編集、理由・確認付き削除

既存銘柄コードは変更不可。新規時は方針未設定、優先度★★。
月別未設定はNULL、仕込み開始0は権利月。株数/優待価値の小数を丸めず、入力の空欄はNULLにする。
月編集は対象月だけ、メモ編集は変更したprofile項目だけを送る。銘柄既定リード月数や
旧1株開始の原文など、フォーム対象外の情報は更新しない。曖昧な旧開始日に日を補完しない。
編集を開いた時のrevisionを保持し、保存成功後の再取得が終わるまで編集を止める。
競合は上書きせず再編集、応答不明は同じ要求IDで再確認する。

タグ編集はフォームを開いたworkspace/revisionに固定する。付与変更は対象profileのrevisionを使い、
名前の変更/削除はtagのrevisionを使う。付け外しは他銘柄のタグを変更しない。
タグ削除は確認後にタグと全銘柄への付与を削除するが、銘柄メモ・月別設定・履歴・残高を削除しない。
空欄/同名タグは入力時に拒否し、最終的な同時更新の整合性はDB制約で確認する。
更新成功後は共通repositoryで再取得し、LocalStorageへタグや付与をコピーしない。

履歴編集は銘柄ごとの権利年・月を明示必須とし、同じ年月の重複を拒否する。
状態、各日時、仕込み株数、口座、履歴メモを保存できる。日時は端末時間帯で入力し、
変更しない日時はDBの元文字列（精度・offsetを含む）を保持する。日時の自動補完/消去はしない。
仕込み済みには仕込み日時が必須。株数は正の整数または未設定で、月別の簡易効率用株数とは別。
追加/変更は対象履歴だけ。削除は理由と確認が必要で、紐付いた優待（archive含む）があれば拒否する。
DBも関連行・revisionを確認し、他の履歴/月/メモ/残高を削除せず、削除前の行を監査へ保持する。

一覧接続（工程4-E）: 権利月/仕込み月、対象月、タグ、非表示を含む検索、作成日/銘柄コード/銘柄名の昇降順。
初期値は権利月・全月・全タグ・作成日降順。表示設定はメモリのみ。仕込み月は各月の
`preparation_months_before`を使用し、NULLは対象外、0は当月、年またぎを循環計算する。
銘柄既定値で月別NULLを補完しない。検索はNFKC/前後空白/大文字小文字を正規化し、メモ・月メモ・タグ名・方針・関連情報を含む。
月の絞込は銘柄一覧の選択に使い、選択銘柄の他月や全年度履歴を保存時に消去しない。

信用売り残高は従来の公開市場データをサーバから受け取り、DB本人銘柄に対応づける。基準日、未取得と0株を区別。
取得依頼は明示ボタンから既存premium保護APIへ表示中の重複除去済みコードだけをPOSTする。
0件/100件超は停止し、100件超では絞込を案内する（黙って100件に切り捨てない）。メモ本文は送らない。
受付成功を取得完了と表示せず、後ほどページ再読込を案内する。15秒タイムアウト/認証拒否/通信失敗で成功表示せず自動再送しない。

未接続: 一括操作/月替わりアーカイブ、旧import/export、通知。
これらを削除した完成版ではなく接続途中の検証画面であり、メモ帳全体/工程4を完了とはしない。
実端末確認・復旧確認・全画面の同時切替は工程5/6。

実装: [DatabaseMemo](../../../app/tools/yutai-memo/DatabaseMemo.tsx)、
[編集command](../../../lib/yutai/memo.ts)。
[共通層](../cross-cutting/yutai-repository.md)、
[導入判断](../../decision-log/2026-09-09-yutai-memo-db-basics.md)も参照。
[タグ接続の判断](../../decision-log/2026-09-09-yutai-tags-db.md)も参照。
[履歴接続の判断](../../decision-log/2026-09-10-yutai-cycles-db.md)も参照。

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
