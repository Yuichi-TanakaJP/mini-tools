# Workspace Core 改善計画 — 2026-09-28

## 結論

Workspace Core の根本設計は維持する。Registry / Flow / Knowledge / Evolution / Coordination / Observability / Ops の分離は有効で、全面再構築はしない。

ただし live DB 監査と Codex 独立レビュー（mini-tools PR #690, reviewed commit `3d47356`）により、**新しい schema 変更より先に Workspace Core の再現可能な schema baseline を GitHub へ復元する必要がある**と確定した。

この計画の実装順は次で固定する。

1. Phase 0: Workspace Core Schema Baseline を version 管理する
2. Phase 1: Thought Lineage Selection Contract を定義する
3. Phase 2: Local / External Workstream Reference Contract を定義する
4. Phase 3: Resume Read Model V1.1
5. Phase 4: Work Unit V0.1
6. Phase 5+: 実運用で必要性が確認された hardening のみ追加する

Evolution Event identity、Domain taxonomy、PK/unused index cleanup は先行させない。

---

## 背景

Workspace Core は現在、Product / Repository / Capability / Value Flowだけでなく、Workstream、Chat Orchestration、Thought Lineage、Architecture Alignment、Observability を横断する Personal System Control Plane として使われている。

2026-09-28 の live audit:

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

良好な点:

- Registry / Flow / Knowledge / Evolution の責務分離は維持
- Product 19件は全て Repository と接続
- Capability 43件は全て Product と接続
- canonical_key / workstream code / session_key / Evolution natural key の一意性が機能
- Knowledge / Evolution の明白な重複なし
- public Workspace Core views は全て `security_invoker=true`
- internal schema は anon/authenticated に USAGE を与えない
-重大な Supabase security advisor error なし

---

# Codexレビュー結果

PR #690 初回レビュー:

- P0: 0
- P1: 4
- P2: 2

P1:

1. Coordination schema の reproducible baseline が repository に無い
2. Resume V1.1より先に Thought Lineage selection contract が必要
3. Work Unit と Chat Checkpoint の same-parent Workstream invariant が必要
4. Local / External Workstream reference を mutually exclusive にする必要

P2:

1. Evolution Event identity を canonical_key / source_key のどちらにするか先に決める
2. この計画を `docs/plans/` hierarchy へ移す

この計画は上記を反映済み。

---

# Phase 0 — Workspace Core Schema Baseline Recovery

## 問題

既存の `workspace-core-v1.md` / `workspace-core-v3-semantic-foundation.md` は ordered SQL 001〜020 の存在を前提としているが、現在の mini-tools repository およびユーザー配下 GitHub repository を検索しても該当SQLを確認できなかった。

さらに、liveに存在する次の定義も repository SQL から再現できない。

- coordination.workstreams
- coordination.workstream_updates
- coordination.workstream_links
- coordination.chat_checkpoints
- coordination.workstream_overview
- public.workspace_core_workstream_resume_v
- public.workspace_core_chat_orchestration_v
- public.workspace_core_architecture_alignment_v

したがって、live-only schema drift が存在する。

## 方針

Workspace Core は mini-tools の operational Supabase DB とは別Projectなので、**Workspace Core schema SQLを `mini-tools/supabase/migrations` に混ぜない。**

versioned schema SoT は専用pathへ置く。

候補構造:

```text
infra/workspace-core/
├─ README.md
├─ baseline/
│  ├─ 2026-09-28-schema.sql
│  └─ 2026-09-28-manifest.md
├─ migrations/
└─ checks/
```

### Baselineに含めるもの

最低限、Workspace Core custom schemas と public read models の:

- CREATE SCHEMA
- CREATE TABLE
- column type / default / nullability
- PK / UNIQUE / CHECK / FK
- indexes
- RLS enable state
- RLS policies
- grants / revokes
- views
- view security_invoker option
- comments（再現に必要なもののみ）

data rows / Personal Log / domain operational dataはbaselineに含めない。

### Baseline manifest

manifestには少なくとも:

- captured_at
- Supabase project ref
- migration history list
- schema/object counts
- live advisor summary
- baseline SQL SHA256
- known non-schema dependencies
- replay status
- live-schema diff status

を残す。

## Gate

**Phase 0が終わるまで Workspace Core schemaの新規DDLを禁止する。**

Phase 0 Done:

- [ ] live schema baseline がGit version管理される
- [ ] live catalogとbaselineの構造差分が0または説明済み
- [ ] grants / RLS / views がsnapshotに含まれる
- [ ] baseline pathと将来migration pathが明文化される
- [ ] clean/staging replay方法が決まる
- [ ] replay未実施なら、その理由とblocking範囲が明記される

### Replay環境

追加課金を避けるため、有料Supabase branchを自動作成しない。

優先順位:

1. 利用可能な local/disposable PostgreSQL
2. 既存の無償な検証環境
3. Supabase branch が必要な場合は cost確認 + user明示承認

clean replayができるまでは、read model/schema変更をmergeしない。

---

# Phase 1 — Thought Lineage Selection Contract

## 問題

現在の `workspace_core_workstream_resume_v` は:

- `record_kind = thought_lineage_v0_pilot`
- または `canonical_key like thought-lineage-pilot-%`

だけを候補にし、現在増えている:

- `thought_lineage_v0`
- `thought_lineage_delta`

を読めない。

ただし単純に「最新1件」に変えると、parent Workstream resume が child/domain-specific lineage に乗っ取られる。

## Selection contract V1

Resume view実装より先に次を固定する。

### scope identity

各Lineage recordは少なくとも logical scope を識別できること。

例:

- parent_workstream
- work_unit
- chat_session
- domain_workstream

### authoritative role

候補:

- authoritative
- delta
- child_context
- historical/pilot

### lifecycle eligibility

- active/current
- superseded
- retired/historical

### ordering

同一scope内で:

1. authoritative eligible
2. explicit version/revision
3. updated_at
4. deterministic canonical_key tie-break

### fallback

- current authoritative がない場合のみ compatible pilot fallback
- child/deltaをparent authoritativeとして自動昇格しない

## Compatibility tests

必須ケース:

- parent authoritative + newer child
- multiple child lineages
- equal timestamp
- superseded record
- pilot-only data
- no-lineage
- delta-only
- explicit authoritative replacement

---

# Phase 2 — External Workstream Reference Contract V1

## 問題

`coordination.workstream_links target_type=workstream` に:

- local Workspace Core Workstream
- external Stock Notes Workstream with target_id null
- external UUIDをtarget_idへ入れた行

が混在する。

## Contract

local / external を排他的にする。

### local

- target_scope = local
- target_system = workspace-core
- target_id = valid coordination.workstreams.id
- target_key = local workstream code
- external namespace fields = null

### external

- target_scope = external
- target_system = nonblank
- target_namespace = nonblank
- target_key = nonblank
- target_id = null

CHECK / FK等で invalid combination を表現不能にする。

## Migration prerequisite

現在存在する external UUID in target_id row は migration前に分類する。

選択肢:

- external reference として key/system/namespaceへ正規化
- provenance不足なら quarantine / manual review

dual-read compatibility viewを rollout中は維持する。

## Tests

- valid local
- valid external
- local without FK
- local with external namespace
- external with local target_id
- external blank key/system/namespace
- legacy row compatibility
- RLS / grants / reader role

---

# Phase 3 — Resume Read Model V1.1

Phase 1/2契約が固定された後に実装する。

## Parent projection

最初に parent Workstream resume だけ直す。

- old pilot special-case依存を除去
- Selection Contract V1に従う
- operational_state と Thought Lineageを分離
- child/domain lineage は supplemental contextとして扱い、parent authoritativeを置換しない

## Child projection

Work Unit導入前には作らない。

Work Unit V0.1の実データが入った後、必要性を確認して別viewとして追加する。

---

# Phase 4 — Work Unit V0.1

## 導入理由

`personal-system-architecture-loop` は long-lived Programに近づき、active Chatが多数ぶら下がっている。

現在:

- parent current_summary = Shared Cloud Producer / TDNET / EDINET
- latest update = Trade Research Purpose Lineage
- child Chat contexts = Design Lab / Yutai / Trade Research / Health Monitor 等

Workstreamをresume unitとして使うには粒度が粗い。

## 最小model

候補:

```text
coordination.work_units
- id uuid PK
- workstream_id uuid NOT NULL FK
- unit_key text NOT NULL
- title text NOT NULL
- status text NOT NULL
- current_summary text
- owner text
- started_at timestamptz
- completed_at timestamptz
- created_at timestamptz
- updated_at timestamptz
UNIQUE(workstream_id, unit_key)
```

Chat Checkpoint:

- existing workstream_idは当面維持
- work_unit_id nullable追加

## Same-parent invariant

Workstream AのcheckpointがWorkstream BのWork Unitを参照できないようDBで保証する。

候補:

- work_units に UNIQUE(id, workstream_id)
- chat_checkpoints に composite FK (work_unit_id, workstream_id) -> work_units(id, workstream_id)

または同等の enforced invariant。

application validationだけに依存しない。

## Delete behavior

明示してテストする。

原則:

- parent Workstream deleteは既存通り慎重に扱う
- Work Unit deleteでCheckpointを誤消去しない
- likely SET NULL / RESTRICT を比較して選ぶ

## Dogfood

最初から全Chatをbackfillしない。

候補2〜3件:

- TDNET Cloud cutover
- EDINET Shared Runtime
- Design Lab cross-product adoption

でparent/child resumeが改善するかを見る。

---

# Phase 5 — Deferred Hardening

## Evolution Event identity

今はschema変更しない。

先に次を決める:

- key owner
- canonical vs source-local semantics
- namespace
- mutability
- upsert/replay behavior
- duplicate/collision policy

決まった後:

- dual-write
- backfill
- conflict audit
- unique constraint
- metadata mirror compatibility

を行う。

## relation table vs metadata

原則:

- narrative / explanation / temporary review state -> metadata
- durable searchable relationship -> relation/link table

ただし heterogeneous evidence_refs を無理に正規化しない。

実際にquery painが出た関係だけ昇格する。

## platform.domains

今は増やさない。

まず Domain が:

- business ownership
- product taxonomy
- internal partition

のどれかを決める。

## ops.sync_runs

contractと運用を一致させる。

- every meaningful sync
- material sync only

のどちらかへ固定。

## Observability V2

schema変更課題ではなく producer delivery gap として別Workstreamで閉じる。

live audit時点:

- current_states: 199, contract_version=1 only
- status_events: 61, contract_version=1 only
- governance_runs/results: 0

---

# 非目標

- Workspace Core全面再構築
- 全JSONBの正規化
- 全external referenceをgeneric polymorphic modelへ統合
- 全active Chatの即Work Unit backfill
- domain SoTをWorkspace Coreへ移す
- Observability producer gapをDB migrationで隠す
- replay環境のために無断で有料Supabase branchを作る

---

# 実装PR分割

## PR A — baseline recovery

- infra/workspace-core path
- live schema snapshot
- manifest
- schema diff/check方法
- no live schema mutation

## PR B — selection/reference contracts

- Thought Lineage Selection Contract docs/spec
- External Workstream Reference Contract docs/spec
- current data classification
- no breaking DDL until replay gate

## PR C — Resume V1.1

- baseline/replay gate通過後
- parent projection only
- compatibility tests

## PR D — Work Unit V0.1

- same-parent invariant
- nullable checkpoint adoption
- 2〜3 dogfood units
- no mass backfill

---

# Merge / implementation gate

各schema PRは最低限:

- versioned baseline available
- live schema diff reviewed
- clean/staging replay successful
- security_invoker確認
- grants/RLS確認
- compatibility tests
- rollback path
- Supabase security/performance advisors
- independent review P0/P1=0

を満たす。

追加課金が必要な replay環境しかない場合は、その時点で user approval gate とする。
