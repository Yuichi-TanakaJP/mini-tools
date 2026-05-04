# Docs Writing Workflow

このメモは、会話やレビューで固まった仕様・設計判断・運用判断を docs に残すための最小ルールです。

## 目的

- 会話で決まった仕様がコードにしか残らない状態を減らす
- 「なぜそうしたか」を後から追えるようにする
- PR やレビューのたびに同じ議論を繰り返さないようにする

## いつ docs を更新するか

次のどれかに当てはまるときは、原則 docs を更新する。

- 仕様を新しく決めたとき
- 既存仕様を変更したとき
- tool ごとの差分を意図的に残すと決めたとき
- 実装方針ではなく運用方針を決めたとき
- レビューや会話で「これは後から見返したい」と感じる判断が出たとき

## どこに書くか

docs は次の役割で分ける。

| 種類 | 場所 | 役割 | 追加タイミング |
|---|---|---|---|
| Product Spec | `docs/product-spec.md` | mini-tools 全体の現在仕様 | 全体方針や分類が変わったとき |
| Tool Spec | `docs/specs/tools/*.md` | ツールごとの現在仕様 | 新規ツール追加、既存ツールの仕様変更 |
| UAT | `docs/uat/*.md` | リリース前・PR確認時の確認手順 | 確認観点や期待挙動が変わったとき |
| Decision Log | `docs/decision-log/*.md` | なぜそう決めたかの判断理由 | 仕様判断、設計判断、運用判断が固まったとき |
| Dev Log | `docs/devlog/*.md` | 作業ログ、調査ログ、引き継ぎ | 試行錯誤や一時メモを残したいとき |
| Cross-cutting Spec | `docs/*.md` | 複数ツールにまたがる安定仕様 | URL、データ取得、SSR、共有導線などを横断整理するとき |

### 1. Product Spec

`docs/product-spec.md` は `mini-tools` 全体の現在仕様の入口にする。

向いている内容:

- ツール分類
- 共通 UI / routing / 保存 / error 方針
- premium の全体位置づけ
- 仕様書、UAT、decision-log の読み分け

書かない内容:

- ツール固有の細かい項目
- 一度きりの作業ログ
- 判断に至る詳細な経緯

### 2. Tool Spec

ツールごとの現在仕様は `docs/specs/tools/` に置く。

向いている内容:

- URL
- 画面要素
- 入力 / 出力
- データ取得元
- 保存先
- fallback
- 空状態 / エラー表示
- premium / 権限制御

テンプレート:

- `docs/specs/tools/_template.md`

### 3. UAT

動作確認手順は `docs/uat/` に置く。

向いている内容:

- 本番 / Preview / ローカルの確認 URL
- 正常系チェックリスト
- 異常系チェックリスト
- 環境ごとの確認注意点

UAT は「仕様そのもの」ではなく「確認手順」として扱う。
仕様と UAT がずれた場合は、Tool Spec を現在仕様の正として見直し、UAT を確認手順として補正する。

### 4. Decision Log

設計判断や仕様判断は `docs/decision-log/` に置く。

向いている内容:

- UI 仕様の判断
- データ contract の判断
- 休場日や初期表示など、表示ルールの判断
- global に効く CSS / hydration / localStorage / fetch 方針

テンプレート:

- `docs/decision-log/_template.md`

### 5. Dev Log

試行錯誤の作業記録は `docs/devlog/` に置く。

向いている内容:

- 何を試したか
- どこで詰まったか
- 一時調査メモ

### 6. Cross-cutting Spec

複数ツールにまたがる長期参照の仕様は `docs/` 直下の spec メモへ切り出す。

向いている内容:

- URL 仕様
- 外部データ shape
- CLI 入出力仕様
- 複数 decision log をまたいで安定した仕様
- React Server / Client の分担
- market tools のデータ取得経路

## 書き方の最小ルール

- 結論を先に書く
- 「背景」「決めたこと」「理由」「影響範囲」は最低限残す
- 実装事実と、意図した仕様を混ぜすぎない
- 将来変わりうる部分は「現時点の仕様」と書く
- 他 tool と差分がある場合は、差分を明示する

## docs 間リンクのルール

ファイル乱立を防ぐため、リンクの向きを固定する。

### 入口

- `docs/index.md` は docs 全体の入口
- 新しい恒久 docs を追加したら、原則 `docs/index.md` か該当カテゴリの index にリンクする
- ツール別仕様を追加したら、必ず `docs/specs/index.md` にリンクする
- UAT を追加したら、必ず `docs/uat/index.md` にリンクする

### Tool Spec

ツール別仕様には、原則として次のリンクを置く。

- 対応する UAT
- 関連する Decision Log
- 関連する実装ファイル
- 横断仕様がある場合は該当する Cross-cutting Spec

### UAT

UAT には、原則として次のリンクを置く。

- 対応する Tool Spec
- 関連する Decision Log

### Decision Log

Decision Log は判断理由の記録なので、仕様の全文コピーを避ける。
現在仕様が Tool Spec や Cross-cutting Spec に昇格した場合は、decision-log からも関連仕様へリンクする。

### Cross-cutting Spec

横断仕様には、対象範囲と関連 tool を明記する。
個別ツール差分がある場合は、詳細を Tool Spec 側へ寄せる。

## 追加前チェック

新しい docs ファイルを作る前に、次を確認する。

1. 既存の Tool Spec / Cross-cutting Spec に追記できないか
2. 判断理由だけなら Decision Log で足りるか
3. 確認手順だけなら UAT で足りるか
4. 一時メモなら Dev Log で足りるか
5. 新規ファイルにする場合、どの index から辿れるようにするか

## 作業フロー

1. 会話やレビューで判断が固まったら、その場で docs 更新の要否を確認する
2. 現在仕様が変わるなら、該当する Tool Spec / Cross-cutting Spec を更新する
3. 確認観点が変わるなら、該当する UAT を更新する
4. 判断理由を残す必要があるなら、`decision-log` に 1 ファイル追加する
5. 新規ファイルを作ったら、該当 index にリンクを足す
6. `docs/index.md` から主要 docs へ辿れることを確認する

## 整理の優先順位

当面は次の順で docs 整理を進める。

1. market tools の表示ルール
2. データ取得と fallback ルール
3. localStorage / hydration / SSR の横断ルール
4. share / QR / mobile tap など UI 共通ルール

## 迷ったとき

- 一度しか出ない作業メモなら `devlog`
- 「これが今の仕様です」と後で言いたいものは Tool Spec / Cross-cutting Spec
- 「なぜそう決めたか」を残したいものは Decision Log
- 「どう確認するか」を残したいものは UAT
