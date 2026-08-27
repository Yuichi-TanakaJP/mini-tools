# 業界マップの表現選択とデータ経路

## 結論

`/premium/industry-map` は、Supabase の `stock_notes_taxonomy_*` を **ログイン済みユーザーの RLS 経由で直接読み**、domain 単位で **階層ツリー / 放射マップ / 関係ネットワーク / マトリクス / テーブル の5表現を切り替えて**閲覧する。編集機能は持たない。追加の npm 依存は入れず、既存の inline SVG 方式で自前描画する。

## 背景

業界マップ（半導体・自動運転・企業経済圏・合成燃料）は ChatGPT との対話で Supabase に整備されてきたが、閲覧手段が SQL しかなかった。MiniTools から見られるようにする。

表現方法の候補は無数にあるため、実データを計測してから決めた。計測結果と手法16種の網羅比較は [表現手法サーベイ](../devlog/2026-08-28-industry-map-visualization-survey.md) に記録した。

## 決めたこと

### データ経路は Supabase 直読み

- `createSupabaseServerClient()` + `supabase.auth.getUser()` で、`/premium/portfolio` と同じ経路を使う
- RLS `select own` に依拠し、Server Component 内でのみ読む
- **stock-notes の Viewer API は使わない**

### 表現は5ビューの切り替え

| ビュー | 担当する問い |
|---|---|
| 階層ツリー（既定） | この業界はどう分解されるか |
| 放射マップ | 全体はどんな形か |
| 関係ネットワーク | 階層をまたぐ依存は何か |
| マトリクス | 保有銘柄はどこを押さえ、どこが空白か |
| テーブル | 個別の定義を正確に確認する |

### 採らなかった表現

- **レーダーチャート** — 軸に置ける数値指標がノードにもリンクにも存在しない
- **サンバースト / ツリーマップ / circle packing** — 量を持たないため面積・角度が無意味になる
- **全ノード隣接行列** — 115×115 で密度約1%。ほぼ空白の格子になる

### npm 依存を追加しない

React Flow / Cytoscape.js / Sigma.js / react-force-graph / d3 系をいずれも入れず、tidy tree・放射配置・簡易 force を純関数として自前実装する。

### 表示上の禁止事項

- 業界マップから売買推奨を生成・表示しない
- `strategic_role` / `control_type` / `confidence` を数値スコアへ変換しない
- 取得失敗と 0件を同じ表示にしない

## 理由

### なぜ Supabase 直読みか

stock-notes の Viewer API（`GET /viewer/themes/{id}`）が返す `taxonomyMap` は**そのテーマに紐づくノードだけ**に絞られる。業界マップは domain 全体（115ノード）が対象で、テーマ未接続のノードも含む。Viewer API では業界マップ全体を取得できない。

taxonomy 系テーブルは `select own` の RLS が設定済みで、`/premium/portfolio` が同じ経路で既に読んでいる。新しい経路を作らずに済む。

### なぜ5ビュー切り替えか

計測の結果、エッジの 62.5% が階層系（`contains`/`part_of`）、37.5% が横断系（`depends_on`/`enables`/`used_for`/`related_to`）だった。階層表現だけでは横断エッジ51件が落ち、ネットワーク表現だけでは背骨が読めない。さらに domain ごとに形が違う（半導体＝深い木、企業経済圏＝二部マトリクス、合成燃料＝工程フロー）。単一表現では必ず情報が落ちるため、切り替えを機能要件とした。

### なぜ依存を足さないか

既存の `dependencies` は7個で、日経225寄与度・TOPIX33・優待候補の図はすべて手書き SVG である。115ノード・136エッジはグラフ描画ライブラリを要する規模ではない。PWA のバンドルサイズと、既存ツールとの実装様式の一貫性を優先した。

### なぜダークテーマにしないか

`app/globals.css` のライトトークンで全ツールが統一されている。業界マップだけ配色系統を変えると PWA 内で浮く。モダンさは配色の変更ではなく、余白・階調・モーション・状態遷移で作る。

## 影響と残課題

- Supabase 未設定、未ログイン、0件は、それぞれ別の状態として表示する。サンプルデータへの fallback は行わない
- ノードに数値指標（metric snapshot）が紐づいた時点で、レーダー / サンバースト / ツリーマップを再評価する
- `valid_to` による履歴が溜まったらタイムライン表現を検討する

## 関連

- 調査: [業界マップ 表現手法サーベイ](../devlog/2026-08-28-industry-map-visualization-survey.md)
- 仕様: [業界マップ仕様](../specs/tools/industry-map.md)
- UAT: [業界マップ UAT](../uat/industry-map.md)
- 関連判断: [テーマViewerの読み取り契約と責任境界](./2026-08-27-theme-viewer-read-model.md)
