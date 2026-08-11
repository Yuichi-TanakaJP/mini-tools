# 2026-08-11 銘柄分析ダッシュボード（stock-notes 連携）の設計判断

## 背景

別リポジトリ [stock-notes](https://github.com/Yuichi-TanakaJP/stock-notes) で、ChatGPT のカスタムGPT から銘柄の分析・投資判断をコピペなしで Supabase に記録する仕組みを構築した（設計の発端は ideas#31）。

2026-08-11 時点の実データ:

- 銘柄 16件（保有 9 / ウォッチ 7）
- 分析 17件（構造化サマリー＋会話原文、合計約16万文字）
- 見立て 17件（当時の日付 `as_of` つき、2026-01〜08）

分析の入口・出口はカスタムGPT だけで成立しているが、**チャットは「1銘柄を深掘る」には強い一方、「全体で何をどこまで分析したか」の俯瞰には向かない**（聞けば答えるが、一覧性・網羅性が保証されない）。状況判断のための俯瞰ビューを mini-tools 側に持たせることにした。

さらに、mini-tools 既存ツール `my-stocks` の保有リスト（`tool_data` の `my_stocks_items_v1`、保有31銘柄・取得単価/数量/口座つき）と stock-notes のデータを突き合わせたところ、次が判明した。

| 区分 | 件数 |
|---|---|
| 保有していて分析もある | 9 |
| **保有しているのに分析が無い** | **22** |
| 分析はあるが保有していない | 7 |

トヨタ・三菱商事・JT・東京海上・オリックスなど主力を保有しながら分析の記録が1件も無い状態で、**この「保有だが未分析」はチャットでは絶対に表面化しない情報**だった。これがダッシュボードを作る一番の動機。

## 今回決めたこと

1. **`my-stocks` に統合せず、別ツールとして新設する**
2. **stock-notes API を経由せず、Supabase を直接読む**（既存の anon キー＋ログインセッション＋RLS）
3. **トップに「保有だが未分析」を置く**。ツールの主目的をここに置く
4. 保有の正本は `my-stocks`（`my_stocks_items_v1`）、分析の正本は stock-notes の Supabase テーブル。**ダッシュボードは両者を突き合わせて表示するだけで、どちらの正本も書き換えない**
5. 当面は**読み取り専用**とする（分類変更や分析の追加は行わない）

## 判断理由

### なぜ `my-stocks` に統合しないのか

`my-stocks` は「取得単価・数量・口座区分の管理」という別の役割で既に完成している。ここに分析機能を混ぜると、localStorage ベースの保有メモと Supabase のリレーショナルな分析データという**性質の違うデータモデルが1画面に同居**し、両方が中途半端になる。役割を分けたまま、新ツール側が `my-stocks` のデータを読む片方向の依存にとどめる。

### なぜ stock-notes API を経由しないのか

stock-notes API は**全利用者共通の Bearer トークン1本**で認証している（MVP は本人のみの想定）。これをブラウザで使うとトークンがクライアントに露出するため、Web UI からは使えない。

一方、mini-tools の Supabase ログインユーザーと stock-notes が書き込みに使っている `SUPABASE_OWNER_USER_ID` は**同一ユーザー**（確認済み）。`stock_notes_*` テーブルには `auth.uid() = user_id` の RLS が設定済みなので、**既存の anon キー＋ログインセッションのままで、本人の行だけが読める**。追加の認証機構もサーバー側プロキシも不要。

### なぜ「保有だが未分析」を主役にするのか

チャットは問われたことに答える。「何が抜けているか」は問われないので出てこない。一覧にして初めて分かる情報こそ、ダッシュボードが担うべき価値だと判断した。分類タブや検索を主役にすると、既存のチャット体験に対する上乗せが薄くなる。

### なぜ読み取り専用にするのか

書き込みを入れると、保有の正本（`my-stocks`）と分析の正本（stock-notes）のどちらを更新するのかという整合問題が発生する。まず「見えること」の価値を確認し、書き込みが本当に要るかは使ってから決める。

## 影響範囲

- 新規: `app/tools/stock-notes/`（ツール本体）、`lib/tools-catalog.ts` への追加
- 参照のみ: Supabase の `stock_notes_stocks` / `stock_notes_analyses` / `stock_notes_theses` / `stock_notes_actions`、および `tool_data` の `my_stocks_items_v1`
- 既存ツールへの変更なし（`my-stocks` は無改修）
- ログイン必須。未ログイン時は他のクラウド同期ツールと同じ導線に合わせる
- stock-notes 側のスキーマ変更があると表示が壊れうる。スキーマの正本は stock-notes リポの `supabase/schema.sql`

## 残課題

- **書き込み（分類変更・アクション消化）を mini-tools から行うか**は未決。当面は読み取り専用
- 分析件数が増えたときの表示件数制御。stock-notes 側でも同じ問題を [stock-notes#10](https://github.com/Yuichi-TanakaJP/stock-notes/issues/10) として起票済み（検索が件数に比例して肥大化する / 保存した原文を読み出す手段が無い）
- 会話原文（`body`、最大45,740文字）の閲覧手段。ダッシュボードで直接読むか、stock-notes#10 の `get_analysis` を待つか
- `stock_notes_stocks.category` と `my-stocks` の保有リストの同期は現状手動（2026-08-11 に一括更新して holding 9 / watch 7 にした）。ズレたときの再同期方法は未定

## 関連

- Issue: #446
- 関連リポジトリ: [stock-notes](https://github.com/Yuichi-TanakaJP/stock-notes)、発端は ideas#31
- 参照 docs: stock-notes 側の `docs/design.md`（全体アーキテクチャ）、`docs/custom-gpt.md`（チャット側の運用）

## 実装時の追加判断（2026-08-11）

Issue #446 の実装で、設計時点では未確定だった細部を以下のとおり決めた。

### テーブルの突き合わせ方法

`stock_notes_stocks` / `stock_notes_analyses` / `stock_notes_theses` / `stock_notes_actions` は
Supabase の SQL join（`select("*, stock_notes_analyses(*)")` のような埋め込み select）を使わず、
4本の独立したクエリで取得し、`stock_id` をキーに **クライアント側（純関数）で突き合わせる** ことにした。
件数が少なく（銘柄・分析・見立てとも数十件規模）join のパフォーマンス上の利点が薄いのに対し、
埋め込み select は返却 shape が複雑になりテストしにくい。素朴な配列 + `Map` の方が
`app/tools/stock-notes/logic.ts` の純関数として単体テストしやすいことを優先した。

### 鮮度バッジの閾値（90日 / 180日）

stock-notes 側の分析頻度は決算・ニュース起点で不定期（実績: 2026-01〜08 の8ヶ月で17件、銘柄あたり月1回に満たない）。
四半期決算1回分＝約90日を「そろそろ確認」、半年（決算2回分）＝約180日を「要更新」の目安とした。
将来、分析頻度の実績が変わったら `app/tools/stock-notes/logic.ts` の `FRESHNESS_WARN_DAYS` /
`FRESHNESS_DANGER_DAYS` を見直す。

### 保有リストの取得経路

「保有だが未分析」の判定に使う `my_stocks_items_v1` は、`my-stocks` の LocalStorage を直接読まず、
既存の `/api/sync`（`tool_data` テーブル経由）から取得することにした。
このダッシュボードは外出先（別端末）から見る想定であり、この端末の LocalStorage には
保有データが無い場合があるため。`lib/sync/registry.ts` の `SYNCED_KEYS` は変更していない
（`/api/sync` の GET はユーザーの `tool_data` 全件を返すため、registry に無いキーでも読める）。

### 会話原文（body）の取得

一覧・タイムラインの select には `body` を含めず、詳細画面で「原文を表示」を押したときだけ
`stock_notes_analyses` を `id` 指定・`select("id, body")` で再クエリする方式にした
（`stock-notes#10` の `get_analysis` 実装を待たず、Supabase 直読みで対応）。
