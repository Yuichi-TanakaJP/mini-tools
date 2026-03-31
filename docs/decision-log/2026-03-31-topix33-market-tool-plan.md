# 2026-03-31 TOPIX33業種データ追加と market tools 導線の方針

## 背景

- `mini-tools` では `earnings-calendar`、`stock-ranking`、`nikkei-contribution` が `market_info` 由来データを表示する market tools として増えてきた
- 次の候補として、TOPIX33業種の騰落や寄与感を見られるデータ表示を追加したい
- ただし単に tool を 1 つ増やすだけだと、TOP ページ上で「端末保存系ツール」と「market_info 連携ツール」の違いが伝わりにくい
- そのため、TOPIX33 の画面仕様だけでなく、TOP での強調方法と market tools の見せ方も先に整理しておく

## 今回決めたこと

- TOPIX33業種データは、既存の `nikkei-contribution` への機能追加ではなく、独立した market tool として追加する前提で進める
- TOP では、`market_info` 由来のツール群を独立したまとまりとして見せる
- 強調は「market_info という実装都合」を前面に出すのではなく、「毎営業日更新の相場データを見られるツール群」という利用価値で見せる
- `market_info` という名称は補助説明や注記に残し、カードの主見出しには出しすぎない
- 実装は、まず data contract を固め、その後に個別 tool、その後に TOP 導線調整の順で進める

## 判断理由

### 1. `nikkei-contribution` に混ぜない理由

- `nikkei-contribution` は「日経225の指数寄与を銘柄単位で読む」ことに特化している
- TOPIX33業種は「業種単位の地合い・広がり・主導セクターを見る」用途が中心で、比較軸が異なる
- 1 画面に同居させると
  - 日経225寄与
  - TOPIX33業種騰落
  - 銘柄単位
  - 業種単位
  が混ざり、初見で理解しづらくなる
- データ shape も別物になりやすく、`ToolClient` の責務が膨らむ

### 2. TOP で market tools を束ねる理由

- 現状の TOP は、端末保存系ツールと相場データ閲覧系ツールが同じ粒度で並んでいる
- `earnings-calendar`、`stock-ranking`、`nikkei-contribution`、今後の TOPIX33 は使う文脈が近い
- まとまりを作ることで
  - 更新される相場データを見る場所
  - 個人メモや管理に使う場所
  を直感的に分けられる

### 3. 「Market info」をどう強調するか

- ユーザーに刺さるのは `market_info` という内部名称より、「毎営業日更新」「指数・業種・ランキングをまとめて見られる」という便益
- そのため主コピーは
  - `マーケットデータ`
  - `毎営業日更新`
  - `指数・業種・決算をまとめて確認`
  のような価値訴求を優先する
- `market_info` は各 tool の注記や説明文で「データ生成元」として触れる程度に留める

## TOPIX33 tool の想定仕様

- 仮の tool 名は `TOPIX33業種` とする
- 役割は「どの業種が上げ下げを主導したか」「業種全体の強弱を日付ごとに見る」こと
- 初期 UI は `nikkei-contribution` の日付ナビとサマリーカード構成をベースに再利用する
- 可視化は次の順で検討する
  1. 業種別ヒートマップまたはタイル表示
  2. 上昇上位 / 下落上位の業種ランキング
  3. 全33業種一覧テーブル
- 個別銘柄 drilldown までは初期スコープに入れない

## TOP での強調方針

### 採用方針

- TOP のツール一覧を 1 セクション増やし、`Market Tools` あるいは `マーケットデータ` のまとまりを作る
- このセクション内に
  - 決算カレンダー
  - 株価ランキング
  - 日経225寄与度
  - TOPIX33業種
  を並べる
- セクション見出しの近くに、短い補助コピーを置く
  - 例: `market_info 由来の整形データをもとに、毎営業日の相場確認に使えるツールをまとめています。`
- 個々のカードには必要なら小さな badge を付ける
  - `毎営業日更新`
  - `相場データ`
  など、ユーザー向けラベルを使う

### 今回は採らない案

- 全カードに `market_info` バッジを付ける
- `nikkei-contribution` の中に `TOPIX33` タブを増やす
- TOP のヒーロー文言を全面的に相場ツール寄りへ寄せる

## 実装計画

### Phase 1. data contract 整理

- `market_info` 側で TOPIX33 用の `manifest` と日次 JSON shape を定義する
- `mini-tools` 側では必要最小限の型を先に決める
- 想定項目:
  - `date`
  - `index: "topix33"`
  - `summary`
  - `sectors`
  - `top_positive`
  - `top_negative`
- 休場日と日付ナビは既存 market tools と同じ考え方を使う

### Phase 2. `mini-tools` に新規 tool 追加

- `app/tools/topix33/` を新設する
- 構成は `nikkei-contribution` と同様に
  - `page.tsx`
  - `data-loader.ts`
  - `types.ts`
  - `ToolClient.tsx`
  を持たせる
- まずは local fallback ありの loader と、日付切替 + サマリー + 業種一覧までを MVP にする

### Phase 3. TOP 導線の再編

- [`app/page.tsx`](../../app/page.tsx) で tool 一覧を
  - 端末保存系 / 汎用系
  - マーケットデータ系
  に分ける
- 必要なら [`app/ToolGridClient.tsx`](../../app/ToolGridClient.tsx) に section title や badge 表示を足す
- 既存 cards の文言も「何が見られるか」が揃うように微調整する

### Phase 4. docs / 運用補足

- TOPIX33 の data contract 判断を別 decision log か spec に昇格する
- market tools のまとまりが増えたら、`docs/index.md` に `Market Tools` 小見出しを独立させる

## 影響範囲

- TOP 画面: [`app/page.tsx`](../../app/page.tsx)
- カード UI: [`app/ToolGridClient.tsx`](../../app/ToolGridClient.tsx)
- 既存参照実装:
  - [`app/tools/nikkei-contribution/page.tsx`](../../app/tools/nikkei-contribution/page.tsx)
  - [`app/tools/nikkei-contribution/data-loader.ts`](../../app/tools/nikkei-contribution/data-loader.ts)
  - [`app/tools/nikkei-contribution/types.ts`](../../app/tools/nikkei-contribution/types.ts)
  - [`docs/decision-log/2026-03-28-nikkei-contribution-data-and-ui.md`](./2026-03-28-nikkei-contribution-data-and-ui.md)
  - [`docs/decision-log/2026-03-29-market-tools-date-ui-and-holiday-handling.md`](./2026-03-29-market-tools-date-ui-and-holiday-handling.md)

## 残課題

- TOPIX33 で扱う値を「騰落率」「寄与度風スコア」「売買代金加味」のどれにするか
- `market_info` 側でどこまで整形するか
- TOP の section 名を英語にするか日本語にするか
- MVP でヒートマップまで入れるか、まずはランキング + 一覧に絞るか

## 関連

- Issue:
- PR:
- 参照 docs:
  - [`docs/docs-writing-workflow.md`](../docs-writing-workflow.md)
  - [`docs/decision-log/2026-03-28-nikkei-contribution-data-and-ui.md`](./2026-03-28-nikkei-contribution-data-and-ui.md)
  - [`docs/decision-log/2026-03-29-market-tools-date-ui-and-holiday-handling.md`](./2026-03-29-market-tools-date-ui-and-holiday-handling.md)
