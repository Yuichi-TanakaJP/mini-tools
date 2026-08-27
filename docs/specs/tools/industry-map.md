# 業界マップ 仕様

> **実装状態:** 2026-08-28時点の初回版。`/premium/industry-map` で、Supabaseに保存した産業構造・企業経済圏マップを5表現で閲覧する。編集、書き込み、売買判断はこの画面の責務ではない。

## 結論

ChatGPT + Supabaseを編集チャネル、MiniToolsを閲覧チャネルとする。データはログイン済みユーザーのRLS経由でSupabaseから直接読み、domain単位で **階層ツリー / 放射マップ / 関係ネットワーク / マトリクス / テーブル** を切り替えて表示する。描画ライブラリは追加せず、inline SVGで自前実装する。

## 概要

- URL: `/premium/industry-map`
- 分類: Premium / 業界マップ
- 主な用途: 産業の分解構造、階層をまたぐ依存、保有銘柄とテーマの押さえどころと空白を俯瞰する

## 対象ユーザー

- Premium仮ログイン済み、かつSupabaseにログイン済みの本人

## 画面仕様

### 主な画面要素

| 要素 | 内容 |
|---|---|
| ヘッダー | タイトル、read modelのバージョン（`industry-map.v1`） |
| domainチップ | domainごとの表示名・領域数・関係数。横スクロール。選ぶとマップ全体が切り替わる |
| 集計 | 領域数 / 横断する関係数 / 紐づく銘柄数 / 紐づくテーマ数 |
| 表現切り替え | 階層・放射・関係・マトリクス・表の5ビュー。選択中はインジケータがスライドする |
| 検索 | 表示名・slug・説明の部分一致 |
| 種別フィルタ | 分類 / 製品・事業 / 技術。最後の1つは外せない |
| 詳細パネル | 選択した領域の定義、階層パス、下位領域、横断する関係、紐づく銘柄・テーマ |

domainの表示名は、その階層の起点になっている `classification` の `display_name` を使う。

### ビュー

| ビュー | 内容 | 使う辺 |
|---|---|---|
| 階層ツリー（既定） | 折りたたみ可能な木。初期状態は深さ1まで展開 | `contains` / `part_of` |
| 放射マップ | 中心に最も葉の多い木、外周に葉と未接続領域 | `contains` / `part_of` |
| 関係ネットワーク | force配置。関係種別ごとにON/OFF、「再配置」で初期配置からやり直す | 6種すべて |
| マトリクス | 銘柄 × 領域、テーマ × 領域 | `stock_taxonomy_links` / `theme_taxonomy_links` |
| テーブル | 全領域の一覧。領域・種別・階層・銘柄数・横断関係数で並べ替え | 全件 |

階層系ビュー（階層・放射）は横断する関係を線として描かない。代わりに、横断関係を持つ領域へバッジと印を出し、その図で省いている関係があることを明示する。

放射マップでは、葉をすべて最も外側の環へ揃える。深さのまま内側の狭い円周に置くとラベルが読めなくなるため。

### 入力

- domain選択、ビュー選択、検索語、種別フィルタ、関係種別フィルタ、領域の選択・展開

選択と展開の状態はdomainごとに保持し、domainを切り替えると既定へ戻る。検索中は、ヒットした領域の祖先を一時的に展開する。検索を消すと元の畳み方へ戻る。

### 出力

- 画面表示のみ。ファイル出力、外部送信、書き込みは行わない

## データ仕様

### 取得元

Supabaseから、Server Component内で6テーブルをRLS経由で読む。

| テーブル | 用途 |
|---|---|
| `stock_notes_taxonomy_nodes` | 領域（`classification` / `product_segment` / `technology`） |
| `stock_notes_taxonomy_edges` | 関係（`contains` / `part_of` / `depends_on` / `enables` / `used_for` / `related_to`） |
| `stock_notes_stock_taxonomy_links` | 銘柄との紐付け。`valid_to is null` の現行行だけ |
| `stock_notes_theme_taxonomy_links` | テーマとの紐付け |
| `stock_notes_stocks` | 銘柄コード・名称 |
| `stock_notes_themes` | テーマ表示名 |

1テーブルあたり最大2000行。並びは `created_at` 昇順（銘柄はコード順、テーマは表示名順）で、登録順の意味が保たれる。

`metadata` からは `layer` だけを読む。文字列でなければ `null` にする。

### 変換

- DBのsnake_caseはloaderの中だけで扱い、UIへは `industry-map.v1` のcamelCase read modelを渡す
- 必須項目が欠けた行、未知の種別・関係、自己ループの辺は落とす
- 辺は、両端が同じdomainのノードである場合だけ採用する
- 銘柄・テーマは、この業界マップに紐付いているものだけ返す
- 階層の起点は「`contains` で指されず、`part_of` を出していない」領域。全領域が親を持つ場合でも起点を1つ返し、画面を空にしない

### 保存先

- なし。閲覧専用

### fallback

- サンプルデータ・推測値へのfallbackは行わない

## 状態・エラー表示

| 状態 | 表示・挙動 |
|---|---|
| 初回表示 | 最も領域数の多いdomainの階層ツリー |
| Premium未ログイン | `/premium/login?next=/premium/industry-map` へリダイレクト |
| Supabase未設定 | 「Supabase連携が未設定です」 |
| Supabase未ログイン | 「Supabaseにログインしてください」 |
| データなし | 「業界マップがまだありません」 |
| 取得失敗 | 「取得できませんでした」＋失敗したテーブル名。0件と明確に区別する |
| 検索・フィルタで0件 | 表ビューで「条件に一致する領域がありません」 |
| 銘柄・テーマの紐付けなし | マトリクスで「まだありません」。空セルは紐付けなしを表すだけで優劣を表さない |

## 表示上の禁止事項

- 業界マップから売買推奨を生成・表示しない
- `strategic_role` / `control_type` / `confidence` を数値スコアへ変換しない（レーダー等を作らない理由）
- 取得失敗と0件を同じ表示にしない
- この画面から保存・編集・削除を行わない

## premium / 権限制御

- Premium仮ログイン（`mini_tools_premium` cookie）必須
- Supabase Authのセッション必須。RLS `select own` により本人の行だけが返る
- `robots: noindex, nofollow`

## 実装

| ファイル | 役割 |
|---|---|
| `app/premium/industry-map/page.tsx` | 認証確認とSupabase読み取りの起点 |
| `app/premium/industry-map/data-loader.ts` | Supabase取得と read model への変換 |
| `app/premium/industry-map/graph-layout.ts` | 木の組み立て、放射配置、force配置（純関数） |
| `app/premium/industry-map/context.ts` | ビュー共通の索引、検索・フィルタ |
| `app/premium/industry-map/presentation.ts` | 表示ラベルと配色 |
| `app/premium/industry-map/IndustryMapClient.tsx` | 画面全体と状態 |
| `app/premium/industry-map/views/*.tsx` | 5ビューと詳細パネル |

`graph-layout.ts` は Next.js の予約ファイル名 `layout.ts` を避けるための名前。ルートディレクトリ配下で `layout.ts` を作るとレイアウト規約として解釈されビルドが落ちる。

npm依存は追加していない。放射配置と簡易forceは自前実装で、`app/premium/industry-map/graph-layout.test.ts` と `data-loader.test.ts` で検証する。

## 関連 docs

- 調査: [業界マップ 表現手法サーベイ](../../devlog/2026-08-28-industry-map-visualization-survey.md)
- Decision Log: [業界マップの表現選択とデータ経路](../../decision-log/2026-08-28-industry-map-view-selection.md)
- UAT: [業界マップ UAT](../../uat/industry-map.md)
- 関連仕様: [テーマViewer仕様](./theme-viewer.md)
