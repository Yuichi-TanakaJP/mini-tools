# 2026-05-24 Admin Dashboard 設計判断

## 決まったこと

1. `/admin` を premium-auth gate 配下の運用画面として新設。各ツールが依存する market_info API ソースの **更新ルール vs 実更新日** を一画面で把握できるようにする。
2. **PC とモバイルで構成を分ける** (820px breakpoint)。PC は分析寄り (4 view タブ + チャート / SLA バー / 依存関係マップ)、モバイルは簡易 3 カラム表。
3. PC は `?view=` で 4 画面切替: **SLA Tracker / 14-day Heatmap / Weekly Schedule / Dependency Map**。
4. ソースごとに **schedule (期待スケジュール)** と **expectedMaxDays (SLA 上限)** を静的に持たせ、SLA / Heatmap / Schedule view の共通根拠にする。
5. **更新ルール文言は market_info 側の運用に揃える**。自動化が未確認のものは「日次」と断定せず "manual" / "ad-hoc" / "要確認" と書く。
6. **manifest 由来の `dates[]` / `weeks[]` は実履歴として heatmap に反映**。それを持たないソース (信用・TDNet・JPX・月次系) は最新 1 点のみ表示し、`no history` バッジで明示する。
7. 通信頻度: 各 manifest fetch は **10 分キャッシュ (`revalidate: 600`)**。管理画面の利用頻度・更新頻度を考えると、これ以上短くする必要はない。

## なぜそうしたか

### なぜ /admin を別ページにしたか

- ツール画面に直接「最終更新日」を露出すると一般ユーザーに不要な情報を見せることになる
- 自分専用の運用 dashboard が欲しい (どのソースがいつ古くなっているか、SLA 違反がないか)
- 既存の premium-auth がそのまま使える (新規認証実装不要)

### なぜ 4 view タブ構成にしたか

- 最初はカード grid 1 枚で全体を見せていたが、ユーザーから「分析できる形にしたい」「グラフを使いたい」と要望
- 単一画面に詰め込むと逆に読みにくくなるため、観点ごとに 4 つに分けた:
  - **SLA**: 期待 vs 実更新のズレ (運用視点)
  - **Heatmap**: 時系列パターン (傾向視点)
  - **Schedule**: 今日・今週何が走るか (オペレーション視点)
  - **Lineage**: ソース障害時の影響範囲 (リスク視点)
- 検討時に「データ観測ダッシュボード」分野の事例 (Tremor / Grafana) を参照。実在を確認したのは Tremor (Donut/Bar/Spark/Data Bars) と Grafana (Stat/Status Timeline/Heatmap/Bar gauge) の 2 つで、Monte Carlo は具体的 UI 言及が薄かった。

### なぜ Schedule をデータモデルとして持たせたか

- 「いつ更新されるか」と「いつ最後に更新されたか」のズレを SLA として扱いたい
- 文字列の "更新ルール" だけだと判定ロジックが書けない
- `kind` (`daily-cron` / `weekly-fixed` / `weekly-task` / `monthly-start` / `manual-wrapper` / `ad-hoc` / `user-input`) を enum 化し、`expectedMaxDays` で上限を定義することで、SLA / Heatmap / Schedule view が同じ根拠を共有できる

### なぜ運用ルール文言を market_info 側に揃えたか

- 当初は推測で「日次 (営業日朝)」と書いていたが、実際は manual wrapper (`run_naito_and_backup.ps1`) や weekly task だったりする
- 未確認の自動化を断定すると現場と乖離する。**「自動化が未確認のものは断定しない」** を文言ルールに採用
- 出典: market_info repo の `docs/operations/monthly_operations.md`, `docs/reference/policy_decision_rules.md`, `policy_decision_log.md`, `publish_contract_inventory.md`, `cli_inventory.md`

### なぜ heatmap は 14 日固定か

- 30 日 / 90 日 / 1 年と伸ばす案も検討したが:
  - 実履歴を持つソースが半数しかない (信用・TDNet・JPX・月次系は `dates[]` を持たない) ため、長期間にしてもデータが薄い
  - 90 日以上は GitHub commit graph 風の集約レイアウトが必要 (週×曜日) で実装複雑度が跳ね上がる
- まずは 14 日で「市場データ系の実履歴」を見せる最小構成にし、必要になったら 30 日 / 1 年版を別タブで追加

### なぜキャッシュは 10 分 (600s) か

- 管理画面は 1 日数回しか見ない想定。1 分や 5 分のキャッシュにする意味が薄い
- 一方、毎ロードで manifest 全件 (15 endpoint) を叩くと market_info 側に無駄な負担をかける
- 10 分なら、タブ切替やリロードで実 API 呼び出しは発生しない (Data Cache hit)
- データ更新自体は最短でも 1 日 1 回なので、10 分の鮮度遅延は実害なし

## 検討して採用しなかった案

- **タブを横断する分析パネル 1 枚に統合**: 「カード詰め込み」になりやすく、ユーザーから「見にくい」とフィードバックを受けた経緯がある。明確に観点を分けるほうが情報密度をコントロールできる
- **Recharts / Tremor を依存追加**: SVG を直書きすれば bundle に追加せずに済む。サーバーコンポーネントなので clinet JS も不要
- **manifest を 1 分キャッシュ**: 管理画面でこの鮮度は過剰。市場データ自体が日次以上のサイクル
- **admin 側で日次スナップショットを永続化して履歴を伸ばす**: 実装コスト > 価値。必要になったら market_info 側 manifest に `dates[]` を生やしてもらう方が筋が良い

## Codex review 指摘で確定した方針

PR #315 の Codex review (review-medium) で 2 件 P2 指摘を受け、当日中に対応:

- **`dynamic = "force-dynamic"` は付けない**: cookies() を読むだけで自動的に動的扱いになるため不要。付けると `fetch` の `next.revalidate` が no-store 化されて Data Cache が機能せず、リロード / タブ切替のたびに market_info を叩いてしまう。
- **age 判定は JST 固定**: ソースの schedule は JST 前提なので、age 計算も JST で行う。UTC で計算すると 00:00-08:59 JST の間に 1 日分若く出てしまい、SLA breach を見逃す。`Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" })` で今日の JST 日付を取得して差分する。

## 今後の課題 / TODO

- 信用 (日興/SBI) / TDNet / JPX 祝日 / yutai / 月次系は manifest に履歴がないため heatmap で 1 点表示。market_info 側で `dates[]` を生やすか、admin 側スナップショット運用に踏み切るかは未決
- weekly-task の "期待更新日" は heatmap 上では便宜的に金曜にマークしている。実 publish 曜日を market_info docs から決め打ちすべき
- 米国株ランキング・EDINET・TDNET の運用は要確認 (今は ad-hoc 扱い)
