# Workspace Core V1 実装計画

## 結論

最後の Supabase Free 枠は `product-db` / `dev-db` のような用途固定の Project にせず、将来複数ドメインを収容できる **Workspace Core** として扱う。

V1 では Project 全体を汎用化しつつ、実装対象は開発資産レジストリに絞る。

```text
Workspace Core
├─ platform
├─ registry
└─ ops
```

将来 `knowledge` / `automation` / `research` 等が必要になった場合のみ schema を追加する。

関連 Issue: #551

## 背景

GitHub、Supabase、Notion、Vercel、Google Cloud 等に情報が分散しているため、次の質問に横断的に答えにくい。

- どの Product が存在するか
- どの Repository がどの Product に属するか
- どの技術・外部サービスを利用しているか
- Product 間の API / データ依存がどうなっているか
- 設計の原文や Issue がどこにあるか

一方で、GitHub や Notion の本文をすべて複製すると Source of Truth が曖昧になり、同期コストも増える。

そのため Workspace Core は **「何がどこにあり、何と何がどう関係するか」** を構造化する Control Plane とする。

## 利用モデル

日常の入口は ChatGPT / AI Agent を想定する。

```text
User
  ↓ conversation / voice
ChatGPT / Agent
  ├─ Workspace Core: identity / relation / provenance
  ├─ GitHub: code / issue / PR / actions
  ├─ Supabase: operational DB state
  ├─ Notion: source text / historical knowledge when needed
  └─ Runtime providers: deployment state
```

Notion は廃止前提ではないが、人間が毎日閲覧する UI を前提にした設計にはしない。

## Source of Truth

| 情報 | Source of Truth | Workspace Core の役割 |
|---|---|---|
| Code / Repository / Issue / PR | GitHub | ID・URL・関係・同期時刻 |
| 稼働DBの状態 | 各 Supabase Project | Project instance・Productとの関係 |
| 長文原文 / 過去メモ | 原文が存在する Notion 等 | URL・要約・Productとの関係 |
| Deployment | Vercel / Google Cloud / Cloudflare 等 | instance・Productとの関係 |
| Product概念 | Workspace Core | Productの識別と横断関係 |
| Cross-system relation | Workspace Core | provenance / confidence 付き関係 |

## Schema boundary

### `platform`

Workspace Core 全体のメタ情報。

V1:

- `domains`
- `source_systems`

### `registry`

V1 の中心。

- `products`
- `repositories`
- `product_repositories`
- `technologies`
- `product_technologies`
- `service_providers`
- `service_instances`
- `product_service_links`
- `product_relations`
- `external_resources`
- `product_resources`

### `ops`

同期・インポートの運用情報。

- `sync_runs`
- `source_sync_state`

## 設計原則

1. GitHub / Notion / Supabase 等から Source of Truth を奪わない。
2. 原文を無条件に複製しない。
3. Product と Repository を 1:1 に固定しない。
4. Provider と concrete instance を分離する。
5. 関係には `source` / `confidence` / `verified_at` を残す。
6. 推測リンクを確定事実として扱わない。
7. secret / token を格納しない。
8. V1 の custom schemas は Data API に直接公開しない。
9. 将来用途のために generic EAV を作らず、実需要が出た domain だけ追加する。

## 初期 GitHub inventory

2026-08-30 時点で GitHub connected account から 20 repositories を確認済み。

事実 inventory と Product classification は分離する。

- Repository facts: GitHub connector 由来として同期可能
- Product classification: Workspace Core の人間/AI判断として provisional から開始

初期 mapping では以下の multi-repository Product を明示する。

- `todo-app`
  - `todo-app` = frontend
  - `todo-app-backend` = backend
- `market-info`
  - `market_info` = data pipeline
  - `market-info-api` = API

その他はまず同名/明示的な Repository を Product に 1:1 で仮紐付けし、後続の棚卸しで統合・分割を判断する。

## V1 phase

### Phase 1: Schema bootstrap

- [x] `platform / registry / ops` boundary を定義
- [x] V1 schema SQL を作成
- [x] private grants / RLS 方針を組み込む
- [x] provenance / confidence を関係テーブルへ組み込む
- [ ] dedicated Supabase Project を作成
- [ ] schema SQL を適用
- [ ] security / performance advisors を確認

### Phase 2: Initial inventory

- [x] GitHub 20 repositories を取得
- [x] authoritative repository seed を作成
- [x] Product classification を別 seed として作成
- [ ] dedicated Project に repository seed を適用
- [ ] 20件であることを検証
- [ ] provisional Product mapping をレビュー・適用

### Phase 3: Discovery

Repository の manifest / config から証拠付きで検出する。

候補:

- `package.json`
- lockfiles
- `pyproject.toml`
- `requirements*.txt`
- `Dockerfile`
- `.github/workflows/*`
- `.env*.example`
- framework config

保存先:

- `product_technologies`
- `service_instances`
- `product_service_links`

自動検出は `source` と `evidence_uri` を必須とし、コード上に証拠がないものを推測登録しない。

### Phase 4: External resources

GitHub Issue / PR / docs / Notion page を `external_resources` としてリンクする。

原則は本文コピーではなく pointer + summary。

### Phase 5: UI

グラフに有用な relation が十分蓄積してから mini-tools に Product Map を追加する。

V1 database bootstrap より UI を先に作らない。

## Security

Supabase の 2026 年の Data API 変更を踏まえ、新規 Project では custom schema を private のまま開始する。

- `anon` / `authenticated` へ schema/table grant を与えない
- RLS enabled
- client policy なし
- `service_role` / privileged server-side path のみ

将来 UI が必要になった場合は、registry 全体を公開するのではなく dedicated `api` schema または server route を優先する。

## Project 作成前のゲート

Supabase Project の作成は最後の Free 枠を消費するため、以下が揃ってから実行する。

- schema SQL がレビュー可能
- initial inventory が確認可能
- Project の organization / region / cost confirmation が明示済み

Project 名は用途固定名を避け、現時点の第一候補を `workspace-core` とする。

## Done criteria for V1 bootstrap

- dedicated Workspace Core Supabase Project が存在する
- `platform / registry / ops` が作成済み
- security advisor の重大指摘がない
- 20 GitHub repositories が authoritative inventory として登録済み
- Product classification が repository facts と分離されている
- `mini-tools -> Supabase mini-tools` relation が登録済み
- `mini-tools -> market-info` / `mini-tools -> stock-notes` API relation が登録済み
- secret が一切保存されていない
- ChatGPT から SQL query で Product / Repository / Service relation を辿れる
