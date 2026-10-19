# テーマViewer 仕様

> **実装状態:** 2026-10-18の一覧ページ化対応。`/premium/themes` とテーマ詳細を、stock-notesのViewer APIから読み取り専用で表示する。テーマ編集、Supabaseへの書き込み、売買判断の確定はこの画面の責務ではない。

## 結論

ChatGPT + Supabaseを編集チャネル、stock-notesをバージョン付き読み取り契約の提供元、MiniToolsを閲覧チャネルとする。MiniToolsはstock-notesのDBや編集APIを直接読まず、サーバー側loaderを経由して 一覧は `theme-viewer-list.v2`、詳細は `theme-viewer.v1` のcamelCase read modelだけをUIへ渡す。

## 概要

- 一覧URL: `/premium/themes`
- 詳細URL: `/premium/themes/[themeId]`
- 分類: Premium / テーマViewer
- 主な用途: テーマの概要、仮説、分析履歴、根拠、関連リンク、taxonomy map、metrics、open actionsを、基準日と信頼度付きで確認する

## 画面仕様

### 一覧

- 1ページ最大10件。APIの容量予算により10件未満でも続きがある場合がある
- 「このページ N件」と続きの有無を表示し、「続きを見る」で次のページを受信・表示する（全件総数とは表示しない）
- 続きのページと取得失敗画面から「最初のページへ」で読み直せる
- ページ順は不変IDの昇順。閲覧中の追加・変更を含むライブ一覧なので、新規追加を確認するときは最初から読み直す
- カード／次ページは先読みしない。詳細の本文は詳細を開いた時に取得する
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

- `GET /viewer/theme-cards?limit=10&cursor=<opaque cursor>`（初回はcursorなし）
- `GET /viewer/themes/{theme_id}`

環境変数は `STOCK_NOTES_API_BASE_URL` と `STOCK_NOTES_API_TOKEN`。どちらもserver-onlyで扱い、`Authorization: Bearer ...` はサーバーからstock-notesへだけ送る。ブラウザーのprops、HTML、URL、クライアントfetchへtokenを渡さない。レスポンスは `no-store`、timeoutは5秒とする。

### 一覧ページ契約

`GET /viewer/theme-cards` は `schemaVersion: "theme-viewer-list.v2"` と、flatな `themes`、`nextCursor: string | null`、`hasMore: boolean` を返す。末尾は `nextCursor: null / hasMore: false`。分析本文・仮説全文などのnestedデータは一覧に含めない。詳細はv1のまま。

MiniToolsのloaderは1リクエストにつき1ページだけを取得する。契約version、継続情報の整合、重複ID、ページ件数、継続カーソルのループを検証し、不正を空一覧として隠さない。cursorの多重指定・空文字・不正な形式はAPI取得前に拒否し、上流400も読み直し案内にする。途中の取得失敗は「テーマなし」や「全件取得済み」にしない。

旧 `GET /viewer/themes` はstock-notes側の既存利用者との互換用に残るが、この画面は呼ばない。軽量APIが未配備の場合に旧一覧へfallbackしない（413再発と部分表示を防ぐ）。stock-notesの互換追加を先に配備し、その後MiniToolsを配備する。

### versioned camelCase read model

一覧の正本契約は `schemaVersion: "theme-viewer-list.v2"` とする。代表的な形は次のとおり。

```json
{
  "schemaVersion": "theme-viewer-list.v2",
  "nextCursor": null,
  "hasMore": false,
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

詳細は `schemaVersion: "theme-viewer.v1"` とトップレベルのsource/as-ofを持ち、`theme`、`currentThesis`、`analysisHistory`、`evidence`、`directLinks`、`taxonomyMap`、`metrics`、`openActions`を含む。各配列・オブジェクトのフィールドもcamelCaseとする。`directLinks` の対象URLは `url`、taxonomyは `nodes` / `edges` / `themeLinks` / `stockLinks`、metricsは `definitions` / `snapshots` / `values` とする。

アプリ内部の型は [テーマViewer types](../../../app/premium/themes/types.ts) に定義する。移行期間の互換性としてloaderは既存snake_case名も受け付けるが、UIへ渡すread modelは常にcamelCaseである。

### source / as-of / confidence

- `source`: 値を生成・確認したシステムまたは資料の識別子
- `asOf`: 判断・データの基準日時。取得日時とは区別する
- `confidence`: `high` / `medium` / `low`。未提供は空欄ではなく「未提供」
- 上位メタデータがない場合、レコード固有のprovenanceを優先する

## 容量上限と互換性

2026-10-18の本番一覧413はstock-notesの60,000文字以上の応答ガードで発生した。件数上限を下げるだけでは未表示テーマが残るため、一覧の軽量化と容量予算によるページ化を採用する。共通上限や詳細契約は緩和せず、一覧の続きで全件へ到達する。

一覧の件数が取得できない場合はnull（未提供）を維持し、0件に置き換えない。DBへの変更・テーマ削除や本文書換えは行わない。

## 状態・エラー表示

| 状態 | 表示・挙動 |
|---|---|
| Premium未認証 | `/premium/login?next=...` へ遷移 |
| env未設定／URL不正 | `not_configured`。設定不足として表示し、空データにしない |
| stock-notes 401 | `unauthorized`。認証設定を確認する案内を表示 |
| stock-notes 404（詳細） | `not_found`。指定テーマなしとして表示 |
| stock-notes 5xx／接続失敗／timeout | `upstream_error`。一時的な取得失敗として表示 |
| cursor不正／継続ページ400 | `invalid_cursor`。最初から読み直すリンクを表示 |
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
- Decision Log: [一覧413とページ分割](../../decision-log/2026-10-18-theme-viewer-pagination.md)
- Decision Log: [テーマViewerの読み取り契約と責任境界](../../decision-log/2026-08-27-theme-viewer-read-model.md)
- Docs Writing Workflow: [docs作成ルール](../../docs-writing-workflow.md)


## 本文の全文取得（2026-10-20、導入PRの仕様）

テーマ詳細 `/premium/themes/[themeId]#full-text` のタイトル直下に「本文を全文で読む」を設ける。既存の概要/履歴は短縮表示を維持し、全文は項目選択→「全文を読み始める」→「次の2,000文字を読む」で取得済み文章へ追記する。先読みや全件自動取得はしない。「取得済み/全文の文字数」と末尾到達時の「全文表示済み」を表示する。本文が空なら取得後に登録なしを表示する。

詳細APIの加算項目 `textSources` が対象record/fieldを列挙する。分析body、結論/根拠/懸念、仮説の文字列/配列、根拠、関連メモ、taxonomy、metrics、actionの対応fieldを選べる。配列は全要素のJSON文字列として表示する。詳細APIの既存件数上限内で返されたrecordが対象。セクションの11件目以降を全件取得する機能ではない。旧APIのmetadata未提供は「全文取得APIはまだ対応していません」と明示する。

ブラウザーは `GET /api/premium/themes/text?themeId=...&section=...&recordId=...&field=...&offset=0` を呼ぶ。Premium Cookieを検証後、server-only tokenでstock-notes `GET /viewer/themes/{themeId}/text/{section}/{recordId}/{field}` を中継する。契約 `theme-viewer-text.v1` は `text/offset/nextOffset/totalChars/revision/hasMore` と要求の識別情報を持つ。Unicode code pointで最大2,000文字、続きはSHA-256 revision必須。受信位置、識別情報、版、文字数、終端を検証し、不整合を全文完了にしない。

待機中は即時「本文を取得中」と中断操作を表示する。既取得本文を保持し、失敗/12秒timeout/中断後は同じoffsetを再試行する。項目変更/画面離脱は古い要求をabortし結果を破棄する。更新409は異なる版を結合せず、最初から読み直す。HTTP private/no-storeに加えPWAでも当該APIはNetworkOnlyとする。tokenや上流エラー本文はブラウザーへ出さない。

**文字数の訂正:** 当初の413は一覧応答全体の60,000文字ガードであり、本文6,000文字の制限ではなかった。これと本文750文字省略は別問題。6,000文字超は今回の回帰試験条件として扱い、実データの存在や検証成功を推測しない。実施結果・対象環境・文字数・未検証項目はPR本文に記録する。

stock-notes APIを先に配備し、その後MiniToolsを配備する。API内部ではDBから単一field全文を読みメモリで切り分けるため、Supabaseからの転送やDB読取自体のstreamingではない。既存の60,000文字ガードは緩和しない。判断理由は[全文を別取得する設計](../../decision-log/2026-10-20-theme-viewer-full-text.md)。


## 全文の読みやすさ（2026-10-20）

全文は初期状態を整形表示とし、受信した原文・offset・revision・文字数は変更しない。蓄積した文字列全体の表示用コピーで、文字としての\n（\r\n含む）を改行として扱い、見出し・箇条書き・番号付きリスト・コードブロック・簡単な強調をReactテキストとして描画する。HTMLやリンクは解釈しない。完全なMarkdown仕様ではない。コードや文章中で改行記号自体を確認したい場合も「原文表示」で元文字列を一字ずつ確認できる。切替に通信は発生しない。

本文は最大40em、段落・見出しに余白を設ける。読む項目は分析日時・種別・field名で区別し、情報のないrecordはsection内の記録番号を表示する。IDを利用者の主な識別子にしない。末尾に残文字数・目安取得回数、完了時に「本文はここまでです（全N文字）」を表示する。

追加取得ボタンは本文末尾に保持する。取得開始/完了/失敗で同じボタンを使い、完了後はaria-disabledでフォーカスを保つ。待機中は重複取得せず、中断操作を提供し、中断後は取得ボタンへフォーカスを戻す。3秒以降の長時間案内、12秒timeout、既読保持と同条件retryは継続。「本文の先頭へ」は見出しへフォーカスを移す明示操作。追加取得ではscroll/focusを強制移動しない。モバイルの選択欄は16px文字・操作部は44px以上、横溢れを防ぐ。

From→ToはQ13に追記。整形/原文と先頭への移動は通信なしのlocal操作で、本文の取得/継続と区別する。決定理由は[全文の表示整形](../../decision-log/2026-10-20-theme-viewer-readable-text.md)。
