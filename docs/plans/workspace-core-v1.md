# Workspace Core V1 実装計画

## 結論

`workspace-core` は、Product / Repository / Technology / Service / Relation を横断管理する汎用 Control Plane として構築済みです。

Supabase Project:

- name: `workspace-core`
- ref: `vtqceobocbetkkatycxw`
- region: `ap-northeast-1`

V1 schema:

```text
Workspace Core
├─ platform
├─ registry
└─ ops
```

将来 `knowledge` / `automation` / `research` 等が必要になった場合のみ schema を追加します。

関連 Issue: #551

## 利用モデル

日常の入口は ChatGPT / AI Agent を想定します。

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

Workspace Core は本文コピー用のwarehouseではなく、「何がどこにあり、何と何がどう関係するか」を持つ構造化Control Planeです。

## Source of Truth

| 情報 | Source of Truth | Workspace Core の役割 |
|---|---|---|
| Code / Repository / Issue / PR | GitHub | ID・URL・関係・同期時刻 |
| 稼働DBの状態 | 各 Supabase Project | Project instance・Productとの関係 |
| 長文原文 / 過去メモ | 原文が存在する Notion 等 | URL・要約・Productとの関係 |
| Deployment | Vercel / Google Cloud / Cloudflare 等 | provider / instance・Productとの関係 |
| Product概念 | Workspace Core | Productの識別 |
| Cross-system relation | Workspace Core | provenance / confidence 付き関係 |

## Schema boundary

### `platform`

- `domains`
- `source_systems`

### `registry`

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

### `ops`

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
8. V1 custom schemas は Data API に直接公開しない。
9. generic EAV を作らず、実需要が出た domain だけ追加する。
10. `monitors_service` と runtime dependency を分離する。

## V1 完了状態

### Phase 1: Schema bootstrap

- [x] `platform / registry / ops` boundary 定義
- [x] V1 schema SQL 作成
- [x] private grants / RLS 方針組み込み
- [x] provenance / confidence 組み込み
- [x] dedicated Supabase Project 作成
- [x] schema SQL 適用
- [x] security / performance advisor 確認

### Phase 2: Initial inventory

- [x] GitHub 20 repositories 取得
- [x] authoritative repository seed 作成
- [x] Product classification を別seed化
- [x] dedicated Projectへ適用
- [x] Repository 20件確認
- [x] Product 18件 / Product↔Repository 20件確認

### Phase 3: Evidence-backed discovery

- [x] package / Python dependency / Docker / env example / README 等からdiscovery
- [x] Product↔Technology登録
- [x] Product↔Provider登録
- [x] Providerとconcrete instanceを分離
- [x] Product↔Product relation登録
- [x] `evidence_uri` 欠落監査
- [x] liveで先行したdiscoveryをrepository seedへreconcile
- [x] 006〜009再実行テスト

Current snapshot verified 2026-09-01:

- Products: 18
- Repositories: 20
- Product ↔ Repository: 20
- Technologies: 26
- Product ↔ Technology: 55
- Service Providers: 15
- Product ↔ Provider: 23
- Product ↔ concrete Service Instance: 1
- Product ↔ Product: 6

### Phase 4: External resources

未着手。GitHub Issue / PR / docs / Notion page を pointer + summary として必要なものだけ登録します。全文複製はしません。

### Phase 5: Read model / UI

次工程です。

グラフに必要なrelationが揃ったため、mini-tools側の Product Map / Development Map を検討できます。

## Security

- `anon` / `authenticated` へ custom schema/table grantを与えない
- RLS enabled
- client policyなし
- `service_role` / privileged server-side pathのみ
- browser accessが必要になった場合は dedicated `api` schema または server route を優先

Security advisor:

- ERROR/WARNなし
- private schema設計に由来する `rls_enabled_no_policy` INFOのみ
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

Performance advisor:

- ERROR/WARNなし
- 新規DBの reverse index に対する unused index INFOのみ
- https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

## Reproducibility / merge gate

Ordered SQL is `001`〜`009`.

初回構築時にbase DDLはdedicated projectへ実適用済みです。後半のdiscovery seed `006`〜`009` は2026-09-01にそのままliveへ再実行し、全件成功、件数不変を確認しました。

完全に空の有料Supabase branchでの追加リプレイも検討しましたが、branch費用は `$0.01344/hour` でした。既存の実適用履歴、依存順序監査、006〜009のexact replay、live-state照合でV1 merge gateとして十分と判断し、追加branchは作成していません。

Codex専用レビューはこの接続環境では利用できません。ユーザーから、Codexをmerge gateにせず必要ならマージしてよいとの明示許可を受けたため、V1では以下を代替ゲートとします。

- live DB verification
- seed idempotence replay
- evidence completeness audit
- Supabase advisors
- latest main同期
- Vercel check

## V1 Done criteria

- [x] dedicated Workspace Core Supabase Project が存在
- [x] `platform / registry / ops` 作成済み
- [x] security advisorに重大指摘なし
- [x] 20 GitHub repositories登録済み
- [x] Product classificationとrepository factsを分離
- [x] concrete instance / provider-level relationを分離
- [x] `mini-tools -> Supabase mini-tools` relation登録済み
- [x] `mini-tools -> market-info` / `mini-tools -> stock-notes` API relation登録済み
- [x] secretを保存していない
- [x] ChatGPTからProduct / Repository / Technology / Service relationをSQLで辿れる
- [x] discovery relationにevidence/provenanceを保持
- [x] repository seedとlive stateをreconcile

## 次工程

Workspace Core V1のDB基盤はここで一区切りとします。

次は以下の順で進めます。

1. よく使う質問をread/query contractに落とす
2. mini-toolsからの安全なread path（server routeまたはread-only `api` schema）を決める
3. Product Map / Development Map V1を実装する
4. 必要性が確認できた段階でGitHub/provider syncを自動化する
