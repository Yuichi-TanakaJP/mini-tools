# テーマViewer 仕様

> **実装状態:** 2026-08-27時点の初回版。`/premium/themes` とテーマ詳細を、stock-notesのViewer APIから読み取り専用で表示する。テーマ編集、Supabaseへの書き込み、売買判断の確定はこの画面の責務ではない。

## 結論

ChatGPT + Supabaseを編集チャネル、stock-notesをバージョン付き読み取り契約の提供元、MiniToolsを閲覧チャネルとする。MiniToolsはstock-notesのDBや編集APIを直接読まず、サーバー側loaderを経由して `theme-viewer.v1` のcamelCase read modelだけをUIへ渡す。

## 概要

- 一覧URL: `/premium/themes`
- 詳細URL: `/premium/themes/[themeId]`
- 分類: Premium / テーマViewer
- 主な用途: テーマの概要、仮説、分析履歴、根拠、関連リンク、taxonomy map、metrics、open actionsを、基準日と信頼度付きで確認する

## 画面仕様

### 一覧

- テーマ名、slug、status（`draft` / `active` / `archived`）、概要を表示する
- source、as-of、confidenceを表示する。値がない場合は「未提供」と表示する
- 分析件数とopen action件数は、APIが値を返した場合だけ表示する
- 各カードから `/premium/themes/[themeId]` へ遷移する
- 対象が0件のときは「テーマなし」と表示し、取得失敗とは区別する

### 詳細

次のセクションを表示する。セクションの状態は `present`（値あり）、`empty`（APIが明示的に空またはnull）、`missing`（フィールド自体が未提供）を区別する。

- Overview: テーマ定義と概要
- Current thesis: 現行仮説の版、status、構造仮説、confidence、risk、falsification condition、next check
- Analysis history: 分析種別、結論、懸念、基準日、出典、confidence
- Evidence: claim、stance、verification status、source、source-as-of、checked-at、confidence
- Direct links: 関連対象、関係、status、直接URL、出典
- Taxonomy map: nodes、edges、theme links、stock linksと、それぞれの関係・基準日・confidence
- Metrics: metric definition、snapshot、value、単位、計算メモ、根拠ID
- Open actions: 未完了確認事項、実行条件、期限、関連分析・仮説

詳細画面の上部にテーマ自身のsource、as-of、confidenceとstatusを表示する。`draft` は「下書き」、欠損データは「未提供」と明示し、空配列やnullは「データなし」と表示する。

### 読み取り専用の境界

- 画面に編集フォーム、保存、更新、完了、削除操作を置かない
- テーマから「買う／売る／保有する」などの売買判断を確定しない
- open actionは確認事項として表示するだけで、この画面から状態を変更しない
- 詳細に直接URLがある場合だけ外部リンクを表示する。URLは `http` / `https` に限定し、不正な値はリンク化しない

## データ契約

### 取得元と認証

Server Componentから次のstock-notes endpointへGETする。

- `GET /viewer/themes`
- `GET /viewer/themes/{theme_id}`

環境変数は `STOCK_NOTES_API_BASE_URL` と `STOCK_NOTES_API_TOKEN`。どちらもserver-onlyで扱い、`Authorization: Bearer ...` はサーバーからstock-notesへだけ送る。ブラウザーのprops、HTML、URL、クライアントfetchへtokenを渡さない。レスポンスは `no-store`、timeoutは5秒とする。

### versioned camelCase read model

Viewer APIの正本契約は `schemaVersion: "theme-viewer.v1"` とする。代表的な形は次のとおり。

```json
{
  "schemaVersion": "theme-viewer.v1",
  "source": "stock-notes",
  "asOf": "2026-08-27T00:00:00Z",
  "themes": [
    {
      "id": "theme-1",
      "slug": "ai-infrastructure",
      "displayName": "AI infrastructure",
      "status": "draft",
      "summary": "...",
      "asOf": "2026-08-26",
      "source": "chatgpt-supabase",
      "confidence": "medium",
      "updatedAt": "2026-08-27T00:00:00Z",
      "analysisCount": 0,
      "openActionCount": 2
    }
  ]
}
```

詳細は同じ `schemaVersion` とトップレベルのsource/as-ofを持ち、`theme`、`currentThesis`、`analysisHistory`、`evidence`、`directLinks`、`taxonomyMap`、`metrics`、`openActions`を含む。各配列・オブジェクトのフィールドもcamelCaseとする。`directLinks` の対象URLは `url`、taxonomyは `nodes` / `edges` / `themeLinks` / `stockLinks`、metricsは `definitions` / `snapshots` / `values` とする。

アプリ内部の型は [テーマViewer types](../../../app/premium/themes/types.ts) に定義する。移行期間の互換性としてloaderは既存snake_case名も受け付けるが、UIへ渡すread modelは常にcamelCaseである。

### source / as-of / confidence

- `source`: 値を生成・確認したシステムまたは資料の識別子
- `asOf`: 判断・データの基準日時。取得日時とは区別する
- `confidence`: `high` / `medium` / `low`。未提供は空欄ではなく「未提供」
- 上位メタデータがない場合、レコード固有のprovenanceを優先する

## API契約の不足と変更候補

現時点のstock-notesにはテーマ単位の既存読み取りendpointはあるが、MiniToolsが想定する `/viewer/themes` と `/viewer/themes/{theme_id}` のversioned aggregate endpoint、camelCase envelopeはまだ正本化されていない。したがって、このPRではUI側の境界と互換parserを先に実装し、stock-notes側のAPI変更をこのPRへ混在させない。

stock-notes側で次に確定すべき変更候補は以下のとおり。

1. `theme-viewer.v1` の一覧／詳細 envelopeと必須フィールドをAPI契約として公開する
2. 詳細endpointで、thesis、analysis history、evidence、direct links、taxonomy map、metrics、open actionsを1つの読み取りpayloadに集約する
3. source、asOf、confidence、draft、未提供、明示的な空を各セクションで表現する
4. direct linksの表示名・関係・対象ID・安全なtarget URLを返す
5. taxonomy／metricsの定義、snapshot、value、根拠IDを同じread modelで返す
6. 401、404、5xxと空データの意味を明文化する。テーマが存在しない場合は404、存在するが未登録のセクションはmissingまたはemptyとする

## 状態・エラー表示

| 状態 | 表示・挙動 |
|---|---|
| Premium未認証 | `/premium/login?next=...` へ遷移 |
| env未設定／URL不正 | `not_configured`。設定不足として表示し、空データにしない |
| stock-notes 401 | `unauthorized`。認証設定を確認する案内を表示 |
| stock-notes 404（詳細） | `not_found`。指定テーマなしとして表示 |
| stock-notes 5xx／接続失敗／timeout | `upstream_error`。一時的な取得失敗として表示 |
| JSON／version／必須項目不正 | `invalid_response`。契約不一致として表示 |
| 一覧が空 | `empty`。テーマなしとして表示 |
| 詳細のセクションが未提供 | `missing`。APIが返していないことを表示 |
| 詳細のセクションが明示的に空 | `empty`。値がないことを表示 |

## Premium / 権限制御

- Premium Cookie認証を必須とする
- 認証前にstock-notes APIへリクエストしない
- stock-notes tokenはserver-only envから取得し、クライアントへ出さない

## 関連実装

- [テーマViewer一覧 page](../../../app/premium/themes/page.tsx)
- [テーマViewer詳細 page](../../../app/premium/themes/%5BthemeId%5D/page.tsx)
- [テーマViewer loader](../../../app/premium/themes/data-loader.ts)
- [テーマViewer UI](../../../app/premium/themes/ThemeViewer.tsx)
- [テーマViewer tests](../../../app/premium/themes/data-loader.test.ts)

## 関連 docs

- UAT: [テーマViewer UAT](../../uat/theme-viewer.md)
- Decision Log: [テーマViewerの読み取り契約と責任境界](../../decision-log/2026-08-27-theme-viewer-read-model.md)
- Docs Writing Workflow: [docs作成ルール](../../docs-writing-workflow.md)
