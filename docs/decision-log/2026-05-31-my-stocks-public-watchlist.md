# 2026-05-31 公開ツール「マイ銘柄リスト」(/tools/my-stocks) の方針

## 背景

- 個人投資家が「保有している銘柄」と「気になって監視している銘柄（ウォッチ）」を
  端末内で簡単に貯められる公開ツールが欲しいという要望が出た。
- 既に `/premium/portfolio` に保有銘柄ダッシュボードがあるが、
  これは将来サーバ保存を前提にした premium 配下の機能であり
  ([2026-04-25-premium-portfolio-dashboard.md](./2026-04-25-premium-portfolio-dashboard.md))、
  「すぐ使える端末内の簡易リスト」とは目的が異なる。
- そこで公開ツール側に、localStorage 完結の軽量な銘柄リストを別途用意する。

## 今回決めたこと

### 配置・命名

- route は `/tools/my-stocks`、表示名は「マイ銘柄リスト」。
- 画面内のタブは「保有メモ」「ウォッチ」とする。
  - premium portfolio の「保有銘柄」と語感を分け、
    公開版が「正確な資産管理」ではなく「端末内の軽いメモ」であることを示す。

### 保存とプライバシー（最重要）

- データは **localStorage 完結**。サーバには送信しない。
  yutai-memo の保存パターン（`app/tools/yutai-memo/storage.ts`）と
  SSR/localStorage hydration ガイドライン
  ([2026-03-12-ssr-localstorage-hydration-guidelines.md](./2026-03-12-ssr-localstorage-hydration-guidelines.md))
  に準拠する。
- 既存の公開データ（決算・優待など）との突き合わせは、
  **公開データ側を広めに取得し、クライアント上でユーザーの銘柄コード集合により
  filter する**方式に限定する。
  - これにより、保有/ウォッチ銘柄のコード集合をサーバへ送らない。
  - 「自分の銘柄コードを API に投げて自分の分だけ取得する」設計は MVP では採らない。
    採用する場合は、銘柄コードがサーバへ出ることを別途 decision-log に明記してから行う。
- 公開版では評価額・含み損益を表示しない。取得単価のみ手入力で保持・表示する。
  - 任意銘柄の現在値を引ける公開データソースが無いという制約に加え、
    「公開版は損益管理をしない」境界を premium portfolio との差として明確にする狙い。

### premium portfolio との棲み分け

| | /tools/my-stocks（公開） | /premium/portfolio（premium） |
|---|---|---|
| 位置づけ | 端末内の簡易リスト | 保有データのダッシュボード |
| 保存先 | localStorage 完結 | 将来サーバ保存を前提 |
| 損益・評価額 | 出さない | 出す（将来） |
| 認証 | なし（公開） | premium cookie |

### MVP スコープ

- 銘柄管理: `public/data/jpx_listed_companies.json` をマスターに、
  コード/名前のインクリメンタル検索 → 候補確定で名前・市場・業種を補完。
- 2タブ: 保有メモ（数量 + 取得単価手入力 + メモ）、ウォッチ（メモ + 追加日）。
- 連携バッジ（クライアント側 code filter）:
  - 次の決算予定日 … earnings-calendar（`EarningsCalendarItem.code`）
  - 優待権利確定月 … **yutai-candidates**（`MonthlyYutaiCandidate.code` / `month`）。
    yutai-expiry は端末内の優待券期限管理でコードマスターを持たないため連携先にしない。
- 削除は signed sum + Undo Toast パターンで可逆にする。
- 将来の JSON エクスポート/インポートを見据えたスキーマにする。

## 判断理由

- localStorage 完結にすることで、公開ツールでも個人データをサーバへ出さずに済み、
  premium portfolio の「個人データを git/サーバに置かない」方針とも矛盾しない。
- code filter をクライアント側に閉じることで、
  「広く公開されているデータを取得するだけ」で「誰が何を持っているか」を漏らさない。
- 損益を出さないことで premium portfolio との境界を保ち、
  公開版の責務を「銘柄を貯める/監視する」に絞れる。

## 影響範囲

- `app/tools/my-stocks/`（新規）
- `app/page.tsx` のツール一覧（導線追加）
- 連携で参照する既存データ: earnings-calendar / yutai-candidates / jpx_listed_companies.json

## 残課題（fast-follow 以降）

- TDNET / EDINET のマイ銘柄フィード連携（`security_code` / `sec_code` で filter 可能）。
  情報量とデータ取得設計が増えるため MVP では見送る。
- JSON エクスポート/インポート（バックアップ・端末移行）。
- premium portfolio との将来的なデータ共有/インポート導線。

## 追記（2026-05-31）次フェーズの着手判断

MVP マージ後、残課題の進め方を整理した。

- **Phase 2a（JSON エクスポート/インポート）を先行実装**する。
  - 自己完結・privacy 懸念なし・外部依存なしのため低リスク。
  - インポートは**非破壊マージ**（同一タブ・同一コードは既存優先でスキップ、id 衝突は振り直し）。
  - バックアップ形式は `{ schema: "mini-tools/my-stocks", version, exportedAt, items }`。
    items 配列のみの JSON も寛容に受け付ける。
- **Phase 2b（TDNET/EDINET フィード連携）は保留**する。
  - TDNET/EDINET は API 専用・日次フィードで、開示は件数が多い（7日で数百〜、30日で数千件）。
  - 「銘柄コードをサーバへ送らない」方針と転送量がトレードオフになるため、
    着手前に次の方式を決める:
    - 案A: 広めに取得しクライアントで code filter（現方針踏襲・転送量重い）
    - 案B: 自社 API ルートへコード集合を送り該当分のみ取得（軽量だがコードがサーバに出る→新 decision-log 必要）
  - バッジ（code→1値の点引き）はデータ量が小さく案A相当で問題なかったが、
    フィードは件数が桁違いのため同じ方式だと転送量が効く点が判断ポイント。

## 追記（2026-06-02）スマホ向け貼り付けインポート

PC で作成したバックアップ JSON をスマホ側へ反映する際、
スマホのファイル操作だけに依存すると、保存場所・拡張子・ブラウザ権限で詰まりやすい。

- 既存の「ファイルから取り込み」は維持する。
- 追加で「JSONを貼り付け」取り込みを用意する。
- 貼り付け取り込みも `parseBackupItems()` / `mergeItems()` を共有し、
  ファイル取り込みと同じバックアップ形式・非破壊マージ規則を使う。
- データは引き続き localStorage にのみ保存し、貼り付け内容をサーバへ送らない。

## 関連

- Issue:
- PR: #346（MVP）
- 参照 docs:
  - [2026-04-25-premium-portfolio-dashboard.md](./2026-04-25-premium-portfolio-dashboard.md)
  - [2026-03-12-ssr-localstorage-hydration-guidelines.md](./2026-03-12-ssr-localstorage-hydration-guidelines.md)
  - `docs/specs/tools/yutai-memo.md`
