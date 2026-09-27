# Workspace Core 改善計画レビュー案 — 2026-09-28

## 目的

Workspace Core は現在、Registry / Flow / Knowledge / Evolution / Coordination / Observability / Ops を横断する Personal System の Control Plane として使われ始めている。

今回、live Supabase を入念に監査した結果、根本設計を作り直す必要はない一方、実運用が広がったことで Coordination V0.x の限界が見え始めた。

この文書は実装前のレビュー用。このPRでは migration / production DB / runtime behavior を変更しない。

## 現状監査の要点

live Workspace Core:
- DB size: 約 18.6 MB
- base tables: 60
- workstreams: 8
- workstream_updates: 120
- workstream_links: 169
- chat_checkpoints: 14
- knowledge.items: 110
- knowledge.evolution_events: 162
- products: 19
- repositories: 21
- capabilities: 43
- value flows: 16
- flow steps: 114
- flow edges: 96

良好だった点:
- Registry / Flow / Knowledge / Evolution の責務分離は維持されている
- Product 19件はすべて Repository と接続済み
- Capability 43件もすべて Product と接続済み
- canonical_key / workstream code / session_key / Evolution natural key 等の一意性が機能
- Knowledge / Evolution に明白な重複は未検出
- public Workspace Core views はすべて security_invoker=true
- internal schema は anon/authenticated に USAGE を与えていない
- 現時点で重大な security advisor error は未検出

## P1-1: personal-system-architecture-loop が Program 化している

現在 personal-system-architecture-loop 配下に 11 Chat Checkpoint、うち active 10 が集約されている。

例:
- TDNET Cloud cutover
- EDINET Shared Runtime
- TDNET Official Fact E2E
- StockNote Yutai Semantic
- Credit Inventory History
- Trade Research
- Design Lab
- Health Monitor AI diagnosis
- Shared Artifact Playground
- Chat Orchestration

現在の Workstream current_summary は Shared Cloud Producer / TDNET / EDINET を表す一方、最新 workstream_update は Trade Research の Purpose Lineage 補完。

つまり parent current_summary / latest update / child chat context が別テーマを指す状態になり、Workstream を resume 単位として使う意味が薄れ始めている。

### 改善候補

Program / Workstream -> Work Unit -> Chat Session / Checkpoint を検討する。

ただし、最初から大規模 schema を作らない。

V0.1案:
- coordination.work_units
- chat_checkpoints.work_unit_id nullable
- Work Unit は「1つの実作業・判断テーマ」に限定
- parent Workstream は Program / long-lived objective
- Chat Session は一時的な作業 surface

例:
- Program: Personal System Architecture & Loop Engineering
- Work Unit: TDNET Cloud production cutover
- Work Unit: EDINET Shared Runtime migration
- Work Unit: Design Lab cross-product adoption
- Chat Checkpoint: 各会話

## P1-2: workspace_core_workstream_resume_v が古い Thought Lineage しか読まない

現在の public.workspace_core_workstream_resume_v は Thought Lineage候補を thought_lineage_v0_pilot または canonical key thought-lineage-pilot-* に限定している。

しかし現在の実運用では thought_lineage_v0 / thought_lineage_delta が増えている。

結果、最新 Thought Lineage が保存されているのに Resume view は 9/26 の最初の pilot item を返し続ける。

### 改善候補

Resume V1.1:
- Thought Lineage record_kind の正式集合を定義
- child/domain-specific lineage と parent/authoritative lineage を区別
- 単純な最新 updated_at 1件ではなく scope / role を考慮
- parent resume と child Work Unit resume を分ける
- old pilot special-case を除去または compatibility fallback にする

## P1-3: Local Workstream と External Workstream 参照が曖昧

coordination.workstream_links の target_type=workstream に、local Workspace Core Workstream と Stock Notes 等 external domain Workstream が混在している。

実データでは:
- local: target_id = coordination.workstreams.id + local code
- external: target_key = stock-notes:* + target_id null
- external UUID を target_id に入れたケースも1件あり、Workspace Core内では参照先が存在しない

### 改善候補

External Reference Contract V1:
- target_scope: local / external
- target_system: workspace-core / stock-notes / github / etc.
- target_namespace
- target_key
- local object only: target_id

既存 target_type は entity category のまま維持。最初は Workstream reference のみ対象にし、generic polymorphic reference system を作りすぎない。

## P2-1: Evolution Event の semantic identifier が metadata.source_key に隠れている

knowledge.items は canonical_key が正式column。一方 Evolution Event は 162件中133件で metadata.source_key を事実上の semantic identifier として使い、Read Modelも依存している。

現時点では duplicate source_key は未検出だが、DB制約では守られていない。

### 改善候補

- knowledge.evolution_events.canonical_key または source_key column を追加
- nullable backfill -> uniqueness確認 -> unique constraint
- metadata.source_key は compatibility mirror として段階廃止

ただし current natural unique key (event_type,title,period_start,period_end) を壊さない。

## P2-2: Durable relation と JSON metadata の境界が曖昧になりつつある

Knowledge Item 110件に対し knowledge.item_relations は7件。

最近の Thought Lineage では connections / evidence_refs / workstream_code / session_key を metadata JSON に持つことが増えている。

### 改善原則候補

- narrative / explanation / temporary review state -> metadata
- durable searchable relationship -> relation/link table

ただしすべてを正規化しない。evidence_refs のような heterogeneous refs は当面 JSON array 維持でもよい。

## P2-3: platform.domains が現在の用途に追いついていない

現在 platform.domains は Development 1件のみ。Product 19件中18件が Development、Design Labだけ null。

Workspace Core は今や Development / Investment / Design / Learning / Personal System / Coordination も扱う。

### 改善候補

すぐ Domain を増やさず、まず Domain の意味を決める。

候補:
- business/domain ownership classification
- product taxonomy
- Workspace Core internal partition

このどれかを固定してから backfill。

## P2-4: ops.sync_runs 契約と実運用が一致していない

Conversation Sync V0.2 の契約では sync run を ops.sync_runs に記録する方針だが、live row は1件のみ。

### 改善候補

どちらかに統一:
- every meaningful sync run を記録
- または material sync only に契約変更

## P2-5: Observability V2 schema と producer delivery が非同期

server-side V2 migration は存在するが live:
- current_states 199 = contract_version 1 only
- status_events 61 = contract_version 1 only
- latest observed ~ 2026-09-25
- governance_runs/results = 0

これは schema defect ではなく delivery gap と判定。

方針: DB schema を再設計せず、producer/live delivery を別Workstreamで閉じる。

## P3

- observability.current_states / daily_rollups は PK がないが natural unique index がある
- generic CRUD / Realtime / logical replication が必要になるまで surrogate PK は保留
- unused join tables / indexes は削除せず、新規機能追加を急がない
- product_resources, flow_step_resources, item_capabilities, item_technologies 等は利用実績が出るまで拡張停止

## 提案する実装順

### Phase A — low-risk correctness
1. Resume Read Model V1.1
2. Thought Lineage role/scope contract
3. External Workstream Reference Contract の設計
4. current data audit + compatibility tests

### Phase B — Coordination granularity
5. Work Unit V0.1 を最小 schema で導入
6. active Chat のうち 2〜3件だけ dogfood
7. parent Workstream summary / child Work Unit resume の分離検証

### Phase C — identity hardening
8. Evolution Event canonical/source key column
9. sync_runs 契約整合
10. relation-vs-metadata boundary の実例ベース改善

### Phase D — after evidence
11. Domain taxonomy
12. PK / unused index / unused join table cleanup
13. UI/dashboard integration

## 非目標

- Workspace Core 全面再構築
- 全JSONBの正規化
- 全external referenceを一気にgeneric化
- 全active Chatを即Work Unitへbackfill
- Observability producer問題をDB migrationで隠す
- domain SoT (Stock Notes等) をWorkspace Coreへ吸収する

## Codexレビュー依頼

このPRはdocs-only。実装はまだしない。

特に以下をP0-P3でレビューしてほしい:
1. personal-system-architecture-loop を Program とみなし Work Unit 層を導入する判断は妥当か
2. Work Unit を入れる前に Resume V1.1 / External Referenceだけ直すべきか
3. Work Unit V0.1 の最小fieldは何にすべきか。Chat Checkpointとの責務重複はないか
4. Resume V1.1で Thought Lineage の parent/child selection をどう安全に決めるべきか
5. External Workstream reference の local/external distinction をどこで持つべきか
6. Evolution canonical key column追加は過剰か、今が適切か
7. relation table と metadata JSON の境界に矛盾や過剰正規化がないか
8. current schema / migration history から見て、この順番に rollback / compatibility / RLS / read-model risk はあるか
9. 今回の監査で見落としているDB設計上のP0/P1があるか

Review output:
- P0 / P1 / P2 / P3
- blocking
- recommended implementation order
- schema changes that should NOT be made yet
- tests / migration verification required before merge
