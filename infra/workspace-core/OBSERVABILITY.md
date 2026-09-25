# Workspace Core Observability Contract

This document is the server-side contract for the **PC/SaaS Health Monitor Cloud Mirror** introduced by `014_observability_schema.sql`.

> **V2 direction (2026-09-23):** Observability is now defined as a
> **Purpose-first Remote Operational Read Model**, not a reduced copy of Local SQLite.
> V1.1 remains the compatibility base. The forward extension is
> `030_observability_v2_context.sql`; the design rationale is recorded in
> `docs/decision-log/2026-09-23-workspace-core-observability-v2-context.md`.
>
> The first consumer is an off-device / AI query such as:
> **「今、私のシステムで対応が必要なものはある？」**
> Data fields are selected from that use case, not from a goal of reducing or
> maximizing the number of mirrored metrics.

The boundary is intentionally local-first:

- `pc-saas-health-monitor` local SQLite (`health_center.db`) is the **Operational Source of Truth**.
- Workspace Core `observability` is a **Remote Read / History Mirror**.
- Raw observations are not mirrored.
- Mirror failure must never stop collection, evaluation, local persistence, or the local dashboard.
- `registry`, `platform`, and `ops` identities are not required in producer payloads.

## Physical schema

Private schema: `observability`

### `observability.current_states`

| column | type | nullable | notes |
| --- | --- | --- | --- |
| `source_key` | `text` | no | stable external key |
| `subject_key` | `text` | yes | stable external subject; `NULL` is a valid subject-less metric |
| `metric_key` | `text` | no | stable external metric key |
| `value` | `double precision` | yes | numeric value only in V1 |
| `unit` | `text` | yes | max 64 chars |
| `status` | `text` | no | `ok`, `warning`, `critical`, `unknown` |
| `message` | `text` | yes | max 4096 bytes |
| `observed_at` | `timestamptz` | no | observation time; must be timezone-aware/UTC-normalized by producer |
| `producer` | `text` | no | Health Monitor uses `pc-saas-health-monitor` |
| `created_at` | `timestamptz` | no | DB-generated |
| `updated_at` | `timestamptz` | no | DB-managed on accepted update |

Idempotency key:

`UNIQUE NULLS NOT DISTINCT (source_key, subject_key, metric_key)`

`NULLS NOT DISTINCT` is required because Health Monitor intentionally allows `subject_key = NULL`; repeated subject-less metrics must conflict with the same row rather than create duplicates.

Current-state updates are accepted **only when** `EXCLUDED.observed_at > stored.observed_at`. Equal or older rows are a no-op. A DB trigger enforces the same rule as defense in depth, so a buggy client cannot roll state backward.

### `observability.status_events`

| column | type | nullable | notes |
| --- | --- | --- | --- |
| `event_id` | `text` | no | primary key; producer-generated stable ID |
| `source_key` | `text` | no | stable external key |
| `subject_key` | `text` | yes | stable external subject |
| `metric_key` | `text` | no | stable external metric key |
| `previous_status` | `text` | yes | health status set |
| `new_status` | `text` | no | health status set |
| `value` | `double precision` | yes | optional; current Health Monitor V1 may send `NULL` |
| `unit` | `text` | yes | optional; current Health Monitor V1 may send `NULL` |
| `message` | `text` | yes | max 4096 bytes |
| `observed_at` | `timestamptz` | no | transition observation time |
| `producer` | `text` | no | Health Monitor uses `pc-saas-health-monitor` |
| `created_at` | `timestamptz` | no | DB-generated |

Primary key: `event_id`.

Writer permission is append-only: `SELECT`, `INSERT`; no `UPDATE`, `DELETE`, or `TRUNCATE`.

A row represents a **status transition only**. Same-status value drift is not an event.

### `observability.daily_rollups`

| column | type | nullable | notes |
| --- | --- | --- | --- |
| `source_key` | `text` | no | stable external key |
| `subject_key` | `text` | yes | stable external subject |
| `metric_key` | `text` | no | stable external metric key |
| `day` | `date` | no | UTC day |
| `unit` | `text` | yes | max 64 chars |
| `min_value` | `double precision` | yes | null when `valued_count = 0` |
| `max_value` | `double precision` | yes | null when `valued_count = 0` |
| `avg_value` | `double precision` | yes | null when `valued_count = 0` |
| `count` | `bigint` | no | at least 1 |
| `valued_count` | `bigint` | no | 0..count |
| `unknown_count` | `bigint` | no | 0..count |
| `worst_status` | `text` | no | health status set |
| `generated_at` | `timestamptz` | no | aggregate generation time |
| `producer` | `text` | no | Health Monitor uses `pc-saas-health-monitor` |
| `created_at` | `timestamptz` | no | DB-generated |
| `updated_at` | `timestamptz` | no | DB-managed on accepted update |

Idempotency key:

`UNIQUE NULLS NOT DISTINCT (source_key, subject_key, metric_key, day)`

The producer sends a **complete aggregate snapshot**. Workspace Core never adds counts or merges aggregate values. A replacement is accepted only when `EXCLUDED.generated_at > stored.generated_at`; equal or older snapshots are a no-op. A DB trigger independently enforces the rule.

Cloud `worst_status` semantics are the Health Monitor ADR 0016 semantics:

- known statuses rank `critical > warning > ok`;
- `unknown` is used when there was no known measurement for the day;
- a day with known `ok` values plus some gaps remains `ok` in the mirror;
- `unknown_count` carries the gap information separately.

### `observability.governance_runs`

| column | type | nullable | notes |
| --- | --- | --- | --- |
| `run_id` | `text` | no | primary key; producer-generated stable ID |
| `target_system` | `text` | no | system being checked |
| `producer` | `text` | no | Health Monitor uses `pc-saas-health-monitor` |
| `policy_key` | `text` | yes | optional reference only; not the Policy SoT |
| `policy_version` | `text` | yes | optional |
| `architecture_key` | `text` | yes | optional reference only; not the Architecture SoT |
| `architecture_version` | `text` | yes | optional |
| `started_at` | `timestamptz` | no | run start |
| `completed_at` | `timestamptz` | yes | Health Monitor model field `finished_at` maps here |
| `overall_status` | `text` | no | `ok`, `warning`, `critical`, `unknown` |
| `summary` | `text` | yes | max 4096 bytes |
| `created_at` | `timestamptz` | no | DB-generated |

Primary key: `run_id`.

Governance history is an observation. Workspace Core does not become the SoT for Stock Notes policy, architecture, or business facts.

### `observability.governance_results`

| column | type | nullable | notes |
| --- | --- | --- | --- |
| `run_id` | `text` | no | FK to `governance_runs` |
| `check_key` | `text` | no | stable check key |
| `status` | `text` | no | `pass`, `fail`, `error`, `skipped` |
| `severity` | `text` | no | `info`, `warning`, `critical` |
| `checked_at` | `timestamptz` | no | check observation time |
| `policy_version` | `text` | yes | Health Monitor model field maps directly |
| `architecture_version` | `text` | yes | Health Monitor model field maps directly |
| `summary` | `text` | yes | max 4096 bytes |
| `evidence` | `jsonb` | no | JSON object only, max 32768 bytes; map producer `None` to `{}` |
| `created_at` | `timestamptz` | no | DB-generated |
| `updated_at` | `timestamptz` | no | DB-managed |

Primary key: `(run_id, check_key)`.

Foreign key: `run_id -> observability.governance_runs(run_id)` with `ON DELETE RESTRICT`.

## V2 identity / context / lifecycle extension

V2 extends `current_states` and `status_events` without replacing the V1.1
tables, keys, writer, RLS policies, or stale-update guards.

### Migration and compatibility

- Existing rows remain `contract_version = 1`.
- Existing V1 producers remain valid because every V2 column is nullable or has
  a V1-safe default.
- Existing V1 rows are **not** backfilled as active V2 facts.
- A V2 producer explicitly writes `contract_version = 2`.
- Primary V2 consumers read `contract_version = 2 AND lifecycle_status = 'active'`.
- An obsolete V2 fact is retired explicitly rather than silently deleted.
- Existing V1/legacy rows are retained until a separate retention/deletion
  decision is made.

This avoids a real failure mode observed in the live data: an older source can
leave an `unknown` Current State behind after the same conceptual job has moved
to a new source and recovered. Treating every legacy row as active would make a
remote AI report an obsolete problem as current.

### V2 Current State context

`030_observability_v2_context.sql` adds the following logical groups.

#### Stable operational identity

- `contract_version`
- `subject_kind`
- `subject_label`
- `product_slug` (optional semantic reference; never a mandatory registry FK)
- existing `subject_key` remains the stable external subject key
- `metric_label`
- `metric_role`

For `contract_version >= 2`, `subject_key`, `subject_kind`,
`metric_role`, and `lifecycle_status` are required by a DB constraint.

`subject_kind` is one of:

- `service`
- `product`
- `repository`
- `job`
- `data_asset`
- `pc_resource`
- `monitor`
- `other`

The producer must not use an absolute local path, a credential-derived value,
or an unreviewed display label as the stable subject key.

#### Decision context

V2 can carry structured context already known by Health Monitor locally:

- `limit_value`
- `usage_ratio`
- `billing_period_start` / `billing_period_end`
- `limit_verified_at`
- `limit_needs_review`
- effective warning operator/value/unit
- effective critical operator/value/unit
- `reason_code`

The human-readable `message` remains useful, but a consumer must not need to
parse prose to understand why a state is warning/critical/unknown.

#### Lifecycle

- `lifecycle_status`: `active`, `retired`, or `unknown`
- `retired_at`
- `superseded_by_source_key` / `superseded_by_subject_key` / `superseded_by_metric_key`

V2 Current State therefore means “latest known fact for this identity” plus an
explicit answer to “is this still a current monitored fact?”.

### V2 Status Event context

Status events remain append-only. V2 adds:

- `contract_version`
- `subject_kind`
- `subject_label`
- `product_slug`
- `metric_label`
- `reason_code`
- `event_kind`

`event_kind` is one of:

- `status_change`
- `recovery`

Lifecycle retirement/supersession is **not** forced into `status_events`.
`status_events` remains a health-status-transition table; retirement is represented
by `current_states.lifecycle_status / retired_at / superseded_by_*`.

The existing `value` / `unit` columns can be populated by the V2 producer.

### Semantic join boundary

`product_slug` is an optional stable reference to `registry.products.slug`.
It is intentionally **not** an FK:

- the Observability writer keeps no `registry` schema privilege;
- Health Monitor does not need Workspace Core internal UUIDs to produce facts;
- a consumer/read model may enrich operational state by joining the registry;
- Product/System Map metadata is not copied into Observability.

### Not changed by V2 context migration

- Local SQLite remains Operational SoT.
- Raw observations are not mirrored.
- V1.1 natural keys and strict-newer stale guards remain.
- Status Event remains append-only.
- Writer role / RLS / no-delete/no-DDL boundaries remain.
- Daily Rollup V2 identity is deferred until the producer identity model is
  stable.
- Backup/Recovery gets a separate assurance contract later.
- Governance continues to use the existing Governance Run/Result tables.

## Producer mapping for Health Monitor Phase 3

The current Health Monitor Phase 1 model and the physical schema intentionally differ in a few names. The adapter owns these mechanical mappings:

| Health Monitor | Workspace Core |
| --- | --- |
| `CurrentState.status` | `current_states.status` |
| `StatusEvent.status` | `status_events.new_status` |
| `GovernanceRun.finished_at` | `governance_runs.completed_at` |
| `GovernanceResult.evidence is None` | `governance_results.evidence = {}` |
| no `producer` field on current domain models | inject constant `pc-saas-health-monitor` |
| StatusEvent currently has no value/unit | store `NULL` for `value` / `unit` |

One `(source_key, subject_key, metric_key)` has one authoritative producer in V1. Health Monitor is authoritative for the metrics it mirrors. Multi-producer arbitration is not a V1 feature.

## SQL upsert contract

### Current State

```sql
insert into observability.current_states (...)
values (...)
on conflict (source_key, subject_key, metric_key)
do update set
  value = excluded.value,
  unit = excluded.unit,
  status = excluded.status,
  message = excluded.message,
  observed_at = excluded.observed_at,
  producer = excluded.producer
where excluded.observed_at > observability.current_states.observed_at;
```

Equal timestamps are deliberately a no-op. This makes replay order deterministic.

### Status Event

```sql
insert into observability.status_events (...)
values (...)
on conflict (event_id) do nothing;
```

### Daily Rollup

```sql
insert into observability.daily_rollups (...)
values (...)
on conflict (source_key, subject_key, metric_key, day)
do update set
  unit = excluded.unit,
  min_value = excluded.min_value,
  max_value = excluded.max_value,
  avg_value = excluded.avg_value,
  count = excluded.count,
  valued_count = excluded.valued_count,
  unknown_count = excluded.unknown_count,
  worst_status = excluded.worst_status,
  generated_at = excluded.generated_at,
  producer = excluded.producer
where excluded.generated_at > observability.daily_rollups.generated_at;
```

Do not increment counts or combine snapshots in Workspace Core.

### Governance Run / Result

Use `ON CONFLICT (run_id) DO UPDATE` for runs and `ON CONFLICT (run_id, check_key) DO UPDATE` for results. Stable IDs prevent duplicate rows. Workspace Core also refuses a Governance Result update whose `checked_at` is older than the stored result.

## Writer role and connection

Capability role: `observability_writer` (`NOLOGIN`)

Concrete Health Monitor principal: `health_monitor_observability` (`LOGIN`, `NOBYPASSRLS`, no password in Git)

Writer scope:

- schema `observability`: `USAGE`, no `CREATE`;
- `current_states`: `SELECT`, `INSERT`, `UPDATE`;
- `status_events`: `SELECT`, `INSERT`;
- `daily_rollups`: `SELECT`, `INSERT`, `UPDATE`;
- `governance_runs`: `SELECT`, `INSERT`, `UPDATE`;
- `governance_results`: `SELECT`, `INSERT`, `UPDATE`;
- no `DELETE` / `TRUNCATE`;
- no `registry`, `platform`, or `ops` schema usage/write access;
- no DDL privileges;
- RLS enabled on all five tables.

`observability` is not intended as a browser-facing Data API schema. `public`, `anon`, and `authenticated` have no usage/table privileges.

### Health Monitor credential

OS Credential Store service: `pc-saas-health-monitor`

Credential key:

`workspace_core_observability_dsn`

Store the **whole PostgreSQL DSN** as this one secret so username/password/host cannot drift independently.

Recommended Windows connection: Supavisor **session mode** (persistent client + IPv4 compatibility):

```text
postgresql://health_monitor_observability.vtqceobocbetkkatycxw:<PASSWORD>@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require
```

Direct alternative when the machine/network has IPv6 reachability (or an IPv4 add-on):

```text
postgresql://health_monitor_observability:<PASSWORD>@db.vtqceobocbetkkatycxw.supabase.co:5432/postgres?sslmode=require
```

The database role is created without a password in source control. Generate a strong password locally, set it on `health_monitor_observability` through an authenticated administrative channel, then store only the resulting DSN in the OS Credential Store. Never post the password/DSN in an Issue, PR, log, or AI conversation.

For Phase 3, prefer session pooler on the normal Windows runtime and keep the direct endpoint only as a diagnostic/fallback when IPv6 is available.

## Security payload contract

Never mirror:

- API tokens, passwords, DSNs, authentication headers;
- Gmail/file bodies;
- brokerage/account/session/passkey information;
- raw stack traces;
- unnecessary local absolute paths;
- raw SQL result sets.

The producer masks first. Workspace Core adds payload-size/type guards as a second boundary:

- message: 4096 bytes;
- summary: 4096 bytes;
- evidence: 32768 bytes;
- evidence must be a JSON object.

## V2 local migration verification

Before any live Workspace Core migration, run the V2 schema contract against a
disposable local PostgreSQL cluster only. The V1.1 migration manages
cluster-wide roles, so a disposable database inside a shared cluster is not
sufficient:

```bash
createdb observability_v2_test
OBSERVABILITY_TEST_DISPOSABLE_CLUSTER=1 \
PGHOST=127.0.0.1 PGDATABASE=observability_v2_test \
  python infra/workspace-core/tests/test_observability_v2_context.py
```

Destroy the entire test cluster after the run. The test refuses a non-loopback
host, a database name other than `observability_v2_test`, a non-superuser, or a
run without the explicit disposable-cluster marker. It verifies that:

- existing V1 rows remain contract version 1;
- the V1 insert shape still works;
- incomplete V2 identity/context is rejected;
- a valid V2 Current State is accepted;
- retired rows require `retired_at`;
- superseding source/subject/metric identity is all-or-none;
- V2 Status Events require stable identity and a health-transition kind;
- lifecycle retirement is not accepted as a fake health Status Event;
- this migration does not add GRANT/REVOKE or SECURITY DEFINER behavior.

This synthetic test is necessary but not sufficient for Tier 3 release.
Live application still requires contract review, RLS/privilege verification,
stale-update regression checks, rollback confirmation, and Supabase advisors.

## Verification state

Live Workspace Core was verified after applying the Observability migrations:

- same Current State payload twice: one row;
- `subject_key = NULL` replay: one row;
- equal/older Current State: ignored;
- newer Current State: accepted;
- same Status Event twice: one row;
- same Daily Rollup twice: one row;
- older Daily Rollup: ignored;
- newer Daily Rollup: accepted;
- same Governance Run twice: one row;
- same Governance Result twice: one row;
- writer has no DELETE/TRUNCATE and no registry/platform/ops write scope;
- RLS is enabled on all five tables;
- Supabase Security Advisor reports no Observability-specific security finding.

The live project was built interactively as the contract was reconciled with the already-completed Health Monitor Phase 1/2 models. The reproducible Git source is the single final-state file `014_observability_schema.sql`.
