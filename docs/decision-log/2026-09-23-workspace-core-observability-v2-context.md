# 2026-09-23 Workspace Core Observability V2 identity / context / lifecycle

## 背景

- Health MonitorのCloud Mirrorは、Local SQLiteの縮小コピーではなく、PC外・AI向けのRemote Operational Read Modelとして再定義された。
- 関連: pc-saas-health-monitor #265 / #334、mini-tools #686。
- live V1.1にはCurrent State 195件 / Status Event 21件があり、既存基盤自体は稼働している。
- ただしV1.1はstable subject identity、limit/threshold context、metric lifecycleを十分に表現できない。

## 今回決めたこと

- V1.1の5-table基盤、dedicated writer、RLS、stale guard、idempotencyは維持する。
- `014_observability_schema.sql` は履歴として書き換えず、後続SQLでV2をforward migrationする。
- V2は `current_states` にidentity/context/lifecycle、`status_events` にhealth-transition contextを追加する。
- existing V1 rowをV2 activeへ一括backfillしない。
- `contract_version=2` をproducerが明示して初めてV2 factとして扱う。
- retirement / supersessionはhealth status transitionへ偽装せず、Current Stateのlifecycleとして表す。
- superseding identityは自由text1本ではなく source / subject / metric の3要素をall-or-noneで保持する。
- V2 Current Stateは `lifecycle_status=active` をPrimary Currentとして読む。
- Workspace Core registry UUIDをproducerのmandatory FKにしない。`product_slug` はoptional stable refとして扱う。
- Daily Rollup / Backup / Governanceはこのmigrationへ混ぜない。

## 判断理由

### なぜbackfillしないか

live dataには、旧sourceのobsolete `unknown` がCurrent Stateへ残る実例がある。
既存行を一律 `active` へbackfillすると、まさに消したい誤ったCurrent判定を固定してしまう。

V2 producerが実際に再観測したfactだけを `contract_version=2,lifecycle_status=active` とする方が安全。

### なぜregistry FKを必須にしないか

Observability writerはregistry/platform/opsへ権限を持たないleast-privilege contractである。
Health MonitorがWorkspace Core internal UUIDを知らないと書けない設計にすると疎結合を失う。

semantic joinはoptional `product_slug` をconsumer側で解決する。

### なぜ列を追加しgeneric JSONへ寄せないか

AI/SQL consumerがlimit、threshold、lifecycleを安定してqueryする用途が明確。
generic JSON payloadにするとraw dump化しやすく、DB制約も弱くなるため採らない。

## 影響範囲

- `infra/workspace-core/sql/030_observability_v2_context.sql`
- `infra/workspace-core/OBSERVABILITY.md`
- Health Monitor producerは別repo / 別Issueで実装する。
- V1 producerは新列のdefault/nullにより継続動作する。
- live適用時はTier 3としてmigration、contract test、RLS/privilege、rollback確認が必要。

## Rollback

### V2 producer投入前

migration rollbackが必要なら、新規index / constraint / columnを逆順にdropできる。

### V2 producer投入後

新列にV2 factsが入った後は、column dropをrollback手段にしない。
consumer/producerをV1へ戻し、新列を未使用のまま残す。
既存V2 dataを自動削除しない。

## 残課題

- Health Monitor #334でstable subject identityとstructured decision contextを実装する。
- obsolete V2 identityを`retired`へするlocal reconciliationを実装する。
- AI consumer用read role/viewは最初のconsumer実装時に別Issueで設計する。
- Backup summary contractは別domainとして扱う。
- Governance producerは既存Health Monitor #184 / PR #258を利用する。
- existing V1 legacy rowの保持/expiry/deleteは別Decision。

## 関連

- Issue: mini-tools #686
- Issue: pc-saas-health-monitor #265 / #334
- PR: 作成後追記
- 参照 docs:
  - `infra/workspace-core/OBSERVABILITY.md`
  - pc-saas-health-monitor `docs/adr/0026-cloud-mirror-export-policy.md`
  - pc-saas-health-monitor `docs/CLOUD_OBSERVABILITY_DATA_CONTRACT_V2.md`
