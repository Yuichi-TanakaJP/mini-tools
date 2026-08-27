# 業界マップ 表現手法サーベイ

調査日: 2026-08-28
対象: Supabase の `stock_notes_taxonomy_*` 系テーブル（業界マップ / 企業経済圏マップ）
目的: 「表・レーダー・マインドマップ等、どの表現で見せるか」を、実データの形に基づいて決める

## 1. 前提 — 実データの形

推測を避けるため、実装前に本番 Supabase を read-only で計測した（2026-08-28 時点）。

| テーブル | 件数 |
|---|---|
| `stock_notes_taxonomy_nodes` | 115 |
| `stock_notes_taxonomy_edges` | 136 |
| `stock_notes_stock_taxonomy_links` | 44（対象銘柄 4） |
| `stock_notes_theme_taxonomy_links` | 63 |

### 1.1 domain（マップの単位）

| domain | ノード数 | 中身の性格 |
|---|---|---|
| `semiconductors` | 52 | 産業→工程→製品→技術の深い階層 |
| `autonomous-driving` | 32 | レイヤー構造 + SAE水準 + ユースケース + 技術 |
| `business-ecosystems` | 22 | 起点6 × サービス領域15 の二部構造 |
| `synthetic-fuels` | 9 | 技術→製品の工程フロー |

### 1.2 kind（ノード種別）

`classification` 36 / `product_segment` 45 / `technology` 34

### 1.3 relation_type（エッジ種別）

| relation | 件数 | 性格 |
|---|---|---|
| `contains` | 75 | 階層（親→子） |
| `part_of` | 10 | 階層（子→親） |
| `depends_on` | 26 | 横断 |
| `enables` | 14 | 横断 |
| `used_for` | 7 | 横断（工程フロー） |
| `related_to` | 4 | 横断 |

**階層系 85 件（62.5%） / 横断系 51 件（37.5%）。**

### 1.4 この形から言えること

1. **背骨は木構造だが、木では表しきれない横断エッジが約4割ある。** 階層表現だけでも、ネットワーク表現だけでも情報が落ちる。
2. **ノードに量（value）がない。** `metadata` に入っているのは `layer`（22件）、`theme`（5件）、`related_stock`（3件）等で、面積や半径に割り当てられる数値指標は存在しない。
3. **グラフ全体は極めて疎。** 115×115 に対して 136 エッジ＝密度約1%。
4. **一方、部分的には密な二部構造がある。** `business-ecosystems` の 起点(6) × サービス(15)、および 銘柄(4) × ノード の関係は、行列で見るのに適した密度を持つ。
5. **domain ごとに最適な形が違う。** 半導体は深い木、経済圏はマトリクス、合成燃料は工程フロー。

→ 単一表現では足りない。**表現を切り替えられること自体が要件**である。

## 2. 手法の網羅比較

このデータに当てて評価した。〇=適合 / △=条件付き / ✕=不適合。

| # | 手法 | 何が得意か | このデータへの適合 | 判定 |
|---|---|---|---|---|
| 1 | 表・テーブル | 全件走査、検索、正確な値の読み取り | 115行は表で十分扱える。ただし関係の形は見えない | 〇 |
| 2 | インデント木 / 折りたたみツリー | 階層の把握、深さの理解、モバイル適性 | `contains`/`part_of` 85件の背骨にそのまま一致 | 〇 |
| 3 | 放射ツリー（マインドマップ） | 全体構造の一望、中心からの広がり | 深さ3〜4・幅15程度なので放射に収まる | 〇 |
| 4 | ノードリンク図（force-directed） | 任意の関係、クラスタ、横断の発見 | 横断エッジ51件を表せる唯一の形。115ノードは自前実装で十分軽い | 〇 |
| 5 | ヒートマップ・マトリクス（二部） | 2軸の交差、網羅と空白の発見 | 銘柄×ノード、起点×サービスに最適 | 〇 |
| 6 | 隣接行列（全ノード） | 密グラフのクラスタ発見 | 115×115 で密度1%。ほぼ空白の巨大格子になる | ✕ |
| 7 | サンバースト | 階層 + 量 の同時表現 | 量がないため角度が無意味。深い階層で外周ラベルが潰れる | ✕ |
| 8 | ツリーマップ | 階層 + 量 の比較 | 同上。面積を子孫数で代用すると「重要度」と誤読される | ✕ |
| 9 | アイシクル図 | 階層の帯表現 | 量なしでも成立するが、折りたたみツリーに対する優位が薄い | △ |
| 10 | サンキー図 | 物・工程の流れ | `synthetic-fuels` の `used_for`（技術→製品）に完全一致。ただし全体で7件のみ | △ |
| 11 | レイヤー / スタック図 | バリューチェーンの層 | `autonomous-driving` と `business-ecosystems` の `layer` メタに一致。domain 依存で汎用性が低い | △ |
| 12 | Chord / 円環図 | 少数カテゴリ間の相互関係 | カテゴリが多くエッジが疎。線が中心で潰れる | ✕ |
| 13 | Circle packing / バブル | 入れ子 + 量 | 量がない。7・8と同じ理由 | ✕ |
| 14 | **レーダーチャート** | **1対象の多次元スコア比較** | **軸に置ける数値指標がノードにもリンクにも無い。今は作れない** | ✕ |
| 15 | カード / かんばん列 | 少数の詳細比較 | 選択ノードの詳細パネルとしては有効。主表現にはならない | △ |
| 16 | タイムライン | 時系列変化 | `valid_from`/`valid_to` はあるが、現状ほぼ全件 `valid_to = null`。履歴がまだ無い | ✕ |

### 2.1 レーダーマップを採らない理由（明記）

依頼で候補に挙がっていたので個別に記す。レーダーチャートは「1つの対象を、共通の複数軸のスコアで見る」ための形である。今回のデータには、

- ノードに数値属性がない
- 銘柄×ノードのリンクが持つのは `strategic_role` / `control_type` / `confidence` という**順序尺度でないカテゴリ値**

しかない。これを無理に 0〜1 に数値化して軸に置くと、DB に存在しない「スコア」を UI が捏造することになる。stock-notes 側の `theme_metric_snapshots` が業界マップのノードに紐づくようになれば成立するので、**将来の再検討対象として残す**。

### 2.2 サンバースト / ツリーマップを採らない理由

どちらも「階層 × 量」の図であり、量が主役である。量がないまま使うと、面積・角度という最も強い視覚チャネルが子孫数（＝登録作業の進み具合）を表してしまい、「半導体製造装置は設計・EDA より重要」といった存在しない意味を読ませる。

## 3. 採用する表現

domain を選び、**5つのビューを切り替える**構成にする。

| ビュー | 担当する問い | 使う辺 |
|---|---|---|
| **階層ツリー**（既定） | この業界はどう分解されるか | `contains` / `part_of` |
| **放射マップ** | 全体はどんな形をしているか | `contains` / `part_of` |
| **関係ネットワーク** | 階層をまたぐ依存は何か | 全6種（種別フィルタ付き） |
| **マトリクス** | 保有銘柄はどこを押さえ、どこが空白か | `stock_taxonomy_links` / `theme_taxonomy_links` |
| **テーブル** | 個別の定義を正確に確認する | 全件 |

階層系ビュー（ツリー・放射）では、横断エッジを持つノードにバッジを出し、「この図で省かれている関係がある」ことを隠さない。

## 4. 実装ライブラリの判断 — 依存追加なし

mini-tools の `dependencies` は現在7個（`@supabase/ssr`, `@supabase/supabase-js`, `next`, `next-pwa`, `qrcode.react`, `react`, `react-dom`）で、既存の図（日経225寄与度、TOPIX33、優待候補）はすべて手書きの inline SVG である。

検討した候補と不採用理由:

| 候補 | 不採用理由 |
|---|---|
| React Flow | ノード編集UI向け。閲覧専用の本用途には過剰で、バンドルが重い |
| Cytoscape.js | 高機能だが React 統合にボイラープレートが要る。グラフ解析機能は使わない |
| Sigma.js + graphology | WebGL。数万ノード向けで、115ノードには不釣り合い |
| react-force-graph | 同上。PWA のバンドルサイズに響く |
| d3-hierarchy / d3-force | 必要なのは tidy tree と簡易 force のみ。両方とも自前で100行程度 |

**結論: 依存を増やさず、既存の inline SVG 方式を踏襲して自前実装する。** 115ノード・136エッジは、requestAnimationFrame ベースの簡易 force 計算で問題なく動く規模である。レイアウト計算は純関数として切り出し、vitest で検証する。

## 5. デザイン参考（参照のみ・コード流用なし）

いずれも設計判断の根拠として参照した。実装コードの複製は行っていない。

### 表現手法の根拠

- [Multivariate Network Visualization Techniques — Utah VDL](https://vdl.sci.utah.edu/mvnv/techniques/) — ノードリンク図と行列表現を併置する設計根拠
- [Dynamic graph exploration by interactively linked node-link diagrams and matrix visualizations](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8423958/) — 疎グラフ＝ノードリンク、密な部分＝行列、という使い分け
- [Interactive Visualisation of Hierarchical Quantitative Data: An Evaluation](https://arxiv.org/pdf/1908.01277) — 階層表現の比較評価
- [Sunburst: A Circular Visualization Technique — think.design](https://think.design/services/data-visualization-data-design/sunburst/) — サンバーストが深い階層で破綻する条件
- [d3-hierarchy | D3 by Observable](https://d3js.org/d3-hierarchy) — tidy tree / radial layout のアルゴリズム
- [D3 Hierarchies — d3indepth](https://www.d3indepth.com/hierarchies/) — 同上

### 業界マップ・エコシステム図のレイアウト

- [Market Ecosystem Map Template — Miroverse](https://miro.com/miroverse/market-ecosystem-map-template/) — 中心エンティティ + ティア分割の構図
- [Ecosystem Mapping Templates & Examples — Miroverse](https://miro.com/templates/ecosystem-mapping/)
- [What are Ecosystem Maps? — IxDF](https://ixdf.org/literature/topics/ecosystem-maps) — 関係種別を線種で描き分ける指針
- [Ecosystem Mapping Guide — Xtensio](https://xtensio.com/how-to-do-ecosystem-mapping/)

### ライブラリ比較

- [Top 13 JavaScript graph visualization libraries — Linkurious](https://linkurious.com/blog/top-javascript-graph-libraries/)
- [React Graph Visualization Guide — Cambridge Intelligence](https://cambridge-intelligence.com/blog/react-graph-visualization-library/)
- [Cytoscape.js vs vis-network vs Sigma.js 2026 — PkgPulse](https://www.pkgpulse.com/guides/cytoscape-vs-vis-network-vs-sigma-graph-visualization-2026)
- [A Comparison of Javascript Graph / Network Visualisation Libraries — Cylynx](https://www.cylynx.io/blog/a-comparison-of-javascript-graph-network-visualisation-libraries/)

### 日本語記事（Zenn）

- [エルデンリングのナレッジグラフをLLMで作る](https://zenn.dev/seihmd/articles/eldenring_knowledgegraph) — 知識グラフ描画に react-force-graph を採用した事例。今回は規模が小さく不採用と判断した比較材料
- [React Flow の紹介と導入](https://zenn.dev/b13o/articles/tutorial-react-flow) — React Flow の適性（編集UI向き）の確認
- [Mermaid.jsでクリック可能なマインドマップを実装する（Next.js）](https://zenn.dev/nomhiro/articles/mindmap-node-click-nextjs) — マインドマップのクリック導線
- [ナレッジグラフ入門](https://zenn.dev/knowledge_graph/articles/knowledge-graph-intro) — ノード/エッジのモデリング整理

### UI トーン

- [Best Dashboard Design Examples & Inspirations for 2026 — Muzli](https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/)
- [UI Design Trends 2026 — Lucky Graphics](https://lucky.graphics/learn/ui-design-trends-2026/)

トレンドとして挙がるダークグラスモーフィズムは採用しない。mini-tools は `app/globals.css` のライトトークン（`--color-bg: #eef2f7` 等）で全ツールを統一しており、1ツールだけ配色系統を変えると PWA 内で浮くため。**既存トークンを守ったうえで、余白・階調・モーション・状態遷移で「モダン」を作る**方針とする。

## 6. 残課題

- ノードに数値指標が入った時点で、レーダー / サンバースト / ツリーマップを再評価する
- `valid_to` による履歴が蓄積したら、タイムライン表現を検討する
- `synthetic-fuels` のような工程フロー domain が増えたら、サンキー表現の追加を検討する

## 関連

- 判断記録: [業界マップの表現選択](../decision-log/2026-08-28-industry-map-view-selection.md)
- 仕様: [業界マップ仕様](../specs/tools/industry-map.md)
- UAT: [業界マップ UAT](../uat/industry-map.md)
