# Admin Dashboard 仕様

## 概要

- URL: `/admin`
- 分類: 管理画面 (非ツール)
- 主な用途: 各ツールが依存する market_info API の **最終更新日 / 期待スケジュール / SLA / 影響範囲** を一望する運用画面

## 対象ユーザー

- 自分 (リポジトリ所有者) のみ
- premium-auth cookie で gate されているため、未認証ユーザーには `/premium/login?next=/admin` にリダイレクト

## 画面仕様

### 共通

- ヘッダーに ADMIN・NOINDEX バッジ、`/premium` への戻りリンク、`API base URL` と現在時刻 (UTC)
- robots: `noindex, nofollow`
- ルートセグメントレベルの `dynamic = "force-dynamic"` は **付けない**: `cookies()` を読むだけで自動的に動的扱いになり、付けると `fetch` の `next.revalidate` が no-store 化されて Data Cache が機能しなくなる
- 4 つの view をクエリ `?view=sla|heatmap|schedule|lineage` で切替
- 画面幅 820px 以下では別レイアウト (モバイル簡易表) に自動切替

### View A: SLA Tracker (`?view=sla`, デフォルト)

- 上部に SLA Compliance %、SLA Met / Breached / No SLA の 3 stat カード
- ソースを breach severity 順に並べたリスト
- 各行: ツール名、期待スケジュール (`schedule.description`)、最終更新日 + 経過日数、SLA バー (緑 fill + 超過分は赤)、freshness pill

### View B: 14-day Heatmap (`?view=heatmap`)

- 行 = データソース、列 = 直近 14 日
- セル:
  - **指数色 (発光)**: その日が最終更新日
  - **指数色 (透過 0.7)**: 期間内の過去更新 (manifest の `dates[]` / `weeks[]` 由来)
  - **indigo**: schedule から推定した期待更新日
  - **薄灰**: それ以外
- 右端に schedule ラベルと `history N` (緑) / `no history` (黄) バッジ

### View C: Weekly Schedule (`?view=schedule`)

- **TODAY パネル**: 今日 fire するスケジュール (daily-cron + 当該曜日の weekly-fixed)
- **THIS WEEK パネル**: 日〜土の 7 マスグリッド、今日ハイライト、weekly-task (曜日指定なし) は別枠で表示
- **MONTHLY / MANUAL · AD-HOC · LOCAL パネル**: その他カテゴリの一覧

### View D: Dependency Map (`?view=lineage`)

- SVG で左に Tool、右に Source ノードを配置し、ベジエ曲線で接続
- Source ノードは freshness 色で塗り分け
- 下部に「IF SOURCE FAILS → AFFECTED TOOLS」一覧 (1 ソースに対し影響する全ツール)

## データ仕様

### 取得元

market_info API の各 manifest endpoint を `/admin` レンダリング時に並列 fetch する。

| ソース | endpoint | latest として使う key | 履歴として使う key |
|---|---|---|---|
| TOPIX33業種 | `/topix33/manifest` | `latest_date` (fallback: `dates` 最大値) | `dates[]` |
| 日経225寄与度 | `/nikkei/manifest` | `latest_date` (fallback: `dates` 最大値) | `dates[]` |
| 株価ランキング | `/ranking/manifest` | `latest` (fallback: `dates` 最大値) | `dates[]` |
| 米国株ランキング | `/us-ranking/manifest` | `latest` (fallback: `dates` 最大値) | `dates[]` |
| 投資主体別売買動向 | `/investor-flow/manifest` | `latest.start_date` | `weeks[]` (start_date) |
| 決算カレンダー (国内) | `/earnings-calendar/domestic/manifest` | `as_of_date` | なし |
| 決算カレンダー (海外) | `/earnings-calendar/overseas/manifest` | `as_of_date` | なし |
| 経済指標カレンダー | `/econ-calendar/weekly/manifest` | `generated_at` | `weeks[]` (week_start) |
| EDINET書類一覧 | `/edinet/document-list/manifest` | `dates` の最大値 | `dates[]` |
| 優待カレンダー | `/yutai/manifest` | `generated_at` | なし |
| 市場ランキング (時価総額) | `/market-rankings/market-cap/manifest` | `generatedAt` (fallback: `latest`) | なし |
| 市場ランキング (配当利回り) | `/market-rankings/dividend-yield/manifest` | `generatedAt` (fallback: `latest`) | なし |
| 日興一般信用在庫 | `/nikko/credit` | `date` (fallback: `generated_at`) | なし |
| SBI一般信用在庫 | `/sbi/credit/latest` | `date` (fallback: `generated_at`) | なし |
| TDNET適時開示 | `/tdnet/disclosures/latest` | `target_date` | なし |
| 開示レーダー | `/disclosure-events/manifest` | `latest` (fallback: `dates` 最大値) | `dates[]` |
| JPX 祝日カレンダー | `/market-calendar/jpx-closed` | `as_of_date` | なし |
| 銘柄マスタ (my-stocks) | `/stock-master/latest` | 配列要素 `as_of_date` の最大値 | なし |

> **例外: `/stock-master/latest` のみ `cache: "no-store"` で取得する。**
> レスポンスが 2MB を超え (cache entry ~2.6MB) Next.js Data Cache に載らず、
> render のたびに「Failed to set Next.js data cache」を `console.error` し、
> その RSC 経由の replay が `/admin` で実行時エラーとして表面化していたため。
> 他の manifest は従来どおり 600s キャッシュで取得する。

### Schedule (期待スケジュール) モデル

ソースごとに 1 つの schedule を割り当て、SLA 判定と heatmap の "期待更新日" 推定に使う。

| kind | 対象ソース | expectedMaxDays |
|---|---|---|
| `daily-cron` | 経済指標カレンダー (毎日 00:35 JST) | 2 |
| `weekly-fixed` (土) | 日興一般信用在庫 (毎週土曜朝 手動) | 8 |
| `weekly-fixed` (日) | SBI一般信用在庫 (毎週日曜朝 手動) | 8 |
| `weekly-task` | 決算カレンダー 国内/海外 / 投資主体別売買動向 (weekly task) | 8 |
| `monthly-start` | 優待カレンダー / 市場ランキング 時価総額・配当利回り | 35 |
| `manual-wrapper` | TOPIX33 / 日経寄与度 / 株価ランキング (run_naito_and_backup.ps1) | null (SLA 対象外) |
| `ad-hoc` | 米国株ランキング / EDINET / TDNET / 開示レーダー / 銘柄マスタ / JPX 祝日 (運用要確認) | null |
| `user-input` | ローカル系 (合計計算 / 文字数カウント / 優待期限帳 / 優待メモ / マイ株) | null |

### SLA 判定

```
expectedMaxDays === null         → "no-sla"
age <= expectedMaxDays            → "met"
age > expectedMaxDays             → "breach" (overdue = age - expectedMaxDays)
latest が null (取得失敗)        → "breach"
```

age は `(today_JST - row.latest)` を YYYY-MM-DD ベースで日数換算する。判定基準は **JST (Asia/Tokyo)** で固定 (週末・祝日オフセットなし)。UTC 基準で計算すると 00:00-08:59 JST の間に age が 1 日少なく出てしまうため、`Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" })` で今日の JST 日付を取得して差分を取る。

投資主体別売買動向は、対象週の `latest.start_date` ではなく manifest の
`generated_at_jst` を freshness / SLA の基準日に使う。JPX の週次データは対象週の翌週に
公表されるため、対象週の開始日を基準にすると正常公開直後でも `STALE` になるため。
画面に表示する最終更新週と履歴は従来どおり `latest.start_date` / `weeks[].start_date` を使う。
SLA 一覧では対象週を `Latest week`、鮮度計算に使った公開日時を `Published` として分けて表示する。

### Freshness 分類 (heatmap / pill 用)

| ラベル | 条件 |
|---|---|
| FRESH | age ≤ 2日 |
| RECENT | 2日 < age ≤ `schedule.expectedMaxDays` |
| STALE | age > `schedule.expectedMaxDays` |
| FAILED | API 取得失敗 / `latest` が null |
| N/A | `latest === undefined` (ローカル保存のみ) |

`expectedMaxDays === null` の行は、freshness 表示に限り互換上限の7日を使う。
これにより週次は8日、月次は35日の通常更新周期内で `RECENT` となり、
SLA違反と `STALE` が同じタイミングで発生する。

### Tool ↔ Source マッピング (Dependency Map 用)

`app/admin/page.tsx` の `TOOL_SOURCE_MAP` で 1 ツール = 0..n 個のソース依存を静的定義。
新しい外部依存を追加するときは ここを更新する。

## 通信頻度・キャッシュ方針

- 各 manifest fetch は `next: { revalidate: 600 }` で **10 分キャッシュ**
- ページに `dynamic = "force-dynamic"` を付けていない (cookies() で自動的に dynamic になるため不要) ので、`fetch()` ごとの Data Cache が正しく機能し、10 分以内の連続アクセスは **API を再び叩かない**
- タブ切替 (`?view=...`) のたびに同じ fetch 群が走るが、キャッシュにヒットするため実 API call は発生しない
- 同時アクセス時もキャッシュは共有されるため、同一 10 分窓に複数ユーザーが叩いても各 endpoint 1 回のみ

参考: market_info 側に過度な負担をかけないため、admin 画面の更新頻度は 1 日に数回程度を想定。10 分キャッシュで十分に通信回数を抑えられる。

## 保存先

- なし (admin 画面はサーバ側で都度 fetch し、レンダリング結果のみを返す)

## fallback

- `MARKET_INFO_API_BASE_URL` 未設定 / fetch タイムアウト (5 秒) / HTTP エラー時はその行を **FAILED** として表示
- ローカル系ツールはそもそも動的取得しない (N/A 扱い)

## 状態・エラー表示

| 状態 | 表示・挙動 |
|---|---|
| 初回表示 | manifest 全件を並列 fetch しレンダリング |
| 未認証 | `/premium/login?next=/admin` にリダイレクト |
| API 未設定 | 全行が FAILED で表示。ヘッダーに `API (未設定)` |
| 個別 fetch 失敗 | 該当行のみ FAILED |

## premium / 権限制御

- premium-auth cookie (`mini_tools_premium`) で gate
- 認証ロジックは `lib/premium-auth.ts` の `verifyPremiumSession()` を再利用 (admin 専用の新しい認証は持たない)
- 環境変数 `PREMIUM_ACCESS_PASSWORD` / `PREMIUM_ACCESS_SECRET` が未設定の環境ではログイン自体ができない

## モバイル表示 (< 820px)

- ダーク multi-panel UI ではなく **白背景 + カテゴリ別シンプル 3 カラム表** に切替
- 列: ツール / ソース、最終更新、運用ルール
- view タブはモバイルでは表示しない (PC 向け機能と割り切る)

## 関連

- 認証: [lib/premium-auth.ts](../../../lib/premium-auth.ts)
- 共通 fetch: [lib/market-api.ts](../../../lib/market-api.ts)
- 実装本体: [app/admin/page.tsx](../../../app/admin/page.tsx)
- 出典 (運用ルール): market_info repo の
  - `docs/operations/monthly_operations.md`
  - `docs/reference/policy_decision_rules.md`
  - `docs/reference/policy_decision_log.md`
  - `docs/reference/publish_contract_inventory.md`
  - `docs/reference/cli_inventory.md`
