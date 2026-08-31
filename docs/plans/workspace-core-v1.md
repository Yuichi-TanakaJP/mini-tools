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

## 現在状態

2026-08-30 に dedicated Supabase Project `workspace-core` を作成し、V1 schema と初期 inventory を適用済み。

- project ref: `vtqceobocbetkkatycxw`
- region: `ap-northeast-1`
- schemas: `platform`, `registry`, `ops`
- GitHub repositories: 20
- Products: 18
- Technologies: 26
- Product -> Technology links: 55
- Service Providers: 15
- Product -> Provider links: 23
- Product -> Product relations: 6

現在の主作業は「DBを作ること」ではなく、**再現可能なSQLとlive DBの整合監査を終え、V1 bootstrapを一区切りにすること**。

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
- `product_service_provider_links`
- `product_relations`
- `external_resources`
- `product_resources`

`product_service_provider_links` は、Provider 利用が証拠付きで分かっているが concrete instance ID までは分からない場合に使う。仮の instance を捏造しないための層。

### `ops`

同期・インポートの運用情報。

- `sync_runs`
- `source_sync_state`

## 設計原則

1. GitHub / Notion / Supabase 等から Source of Truth を奪わない。
2. 原文を無条件に複製しない。
3. Product と Repository を 1:1 に固定しない。
4. Provider と concrete instance を分離する。
5. 関係には `source` / `confidence` / verification timestamp を残す。
6. 推測リンクを確定事実として扱わない。
7. secret / token を格納しない。
8. V1 の custom schemas は Data API に直接公開しない。
9. 将来用途のために generic EAV を作らず、実需要が出た domain だけ追加する。
10. `monitors_service` と runtime dependency を混同しない。

## 初期 GitHub inventory

2026-08-30 時点で GitHub connected account から 20 repositories を確認済み。

事実 inventory と Product classification は分離する。

- Repository facts: GitHub connector 由来として同期可能
- Product classification: Workspace Core の人間/AI判断として provenance を保持

multi-repository Product:

- `todo-app`
  - `todo-app` = frontend
  - `todo-app-backend` = backend
- `market-info`
  - `market_info` = data pipeline
  - `market-info-api` = API

## V1 phase

### Phase 1: Schema bootstrap

- [x] `platform / registry / ops` boundary を定義
- [x] V1 schema SQL を作成
- [x] private grants / RLS 方針を組み込む
- [x] provenance / confidence を関係テーブルへ組み込む
- [x] dedicated Supabase Project `workspace-core` を作成
- [x] schema SQL を適用
- [x] security / performance advisors を確認

Advisor は重大指摘なし。`rls_enabled_no_policy` は private schema + client grantなしというV1設計に対応する INFO、unused index は新規DBでまだ利用履歴が少ないことによる INFO と判断している。

### Phase 2: Initial inventory

- [x] GitHub 20 repositories を取得
- [x] authoritative repository seed を作成
- [x] Product classification を別 seed として作成
- [x] dedicated Project に repository seed を適用
- [x] 20件であることを検証
- [x] provisional Product mapping を適用・初回レビュー
- [x] Product != Repository を multi-repository mapping で確認

### Phase 3: Discovery

Repository の manifest / config / README から証拠付きで検出する。

主な evidence:

- `package.json`
- lockfiles
- `pyproject.toml`
- `requirements*.txt`
- `Dockerfile`
- `.github/workflows/*`
- `.env*.example`
- framework config
- README（役割・deployment・monitoring target 等、manifestでは表現できない事実）

保存先:

- `product_technologies`
- `service_instances`
- `product_service_links`
- `product_service_provider_links`
- `product_relations`

進捗:

- [x] 主要20 repository を一巡
- [x] Technology master / usage を証拠付き登録
- [x] provider-level relationship を導入
- [x] monitoring target と runtime dependency を区別
- [x] Product relation（API / data / content / workflow asset / source-of-truth参照）を登録
- [x] live-only discovery を SQL 008/009 で再現可能な形へ戻す
- [ ] 今後の新規・変更 repository を定期同期する discovery loop の自動化

自動検出は `source` と `evidence_uri` を基本とし、コード上または明示ドキュメントに証拠がないものを推測登録しない。

### Phase 4: External resources

GitHub Issue / PR / docs / Notion page を `external_resources` としてリンクする。

原則は本文コピーではなく pointer + summary。

- [ ] Issue #551 / PR #552 を最初の external resource として登録するか判断
- [ ] Notion等を大量同期せず、必要な設計原文のみpointer化する運用を決める

Phase 4 は Product Map UI の前提ではない。V1 bootstrapの完了を阻害しない。

### Phase 5: UI

グラフに有用な relation が十分蓄積したため、DB bootstrap完了後は mini-tools の Product Map / Development Map を次候補とする。

想定表示:

- Product
- Repository
- Technology
- Service Provider / Instance
- Product dependency / data flow
- evidence / confidence

UIからregistry全体を直接公開せず、server-side route または専用 `api` schema を優先する。

## Security

custom schema は private のまま開始している。

- `anon` / `authenticated` へ schema/table grant を与えない
- RLS enabled
- client policy なし
- `service_role` / privileged server-side path のみ
- secret / token は保存しない

将来 UI が必要になった場合は、registry 全体を公開するのではなく dedicated `api` schema または server route を優先する。

Repository棚卸しで見つかった個別セキュリティ課題は、そのProduct側のIssueとして分離する。例: `test_ISN` のproduction認証情報fallback改善 Issue #12。

## Reproducibility

GitHub branch `feature/workspace-core-v1` の `infra/workspace-core/sql/001`〜`009` を順番に適用すると、V1 discovery graphを再構築できる形を目指す。

`008` / `009` は、初期 discovery が live DB に対して対話的に進んだ結果をrepository側へreconcileするための移行用seed。V1安定後に必要ならsquashを検討する。

## Done criteria for V1 bootstrap

- [x] dedicated Workspace Core Supabase Project が存在する
- [x] `platform / registry / ops` が作成済み
- [x] security advisor の重大指摘がない
- [x] 20 GitHub repositories が authoritative inventory として登録済み
- [x] Product classification が repository facts と分離されている
- [x] `mini-tools -> Supabase mini-tools` concrete relation が登録済み
- [x] `mini-tools -> market-info` / `mini-tools -> stock-notes` API relation が登録済み
- [x] provider-level relationship と instance-level relationship を分離済み
- [x] monitoring target と runtime dependency を区別済み
- [x] secret を Workspace Core に保存していない
- [x] ChatGPT から SQL query で Product / Repository / Technology / Service relation を辿れる
- [ ] repositoryの001〜009とlive DBの最終整合監査を完了
- [ ] requested review path（Codex等）を解決し、PR #552のmerge可否を判断

上記最後の2点を満たした時点で **Workspace Core V1 bootstrapを一区切り** とし、継続的discoveryとUIをV2/次段階として扱う。
