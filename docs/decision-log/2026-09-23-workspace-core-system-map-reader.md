# Workspace Core System Map reader boundary

Date: 2026-09-23
Related: mini-tools #680, pc-saas-health-monitor #257 / #326

## Decision

Health Monitor's System Map reviewed-facts access uses a dedicated database
principal instead of reusing the Product Evolution Evidence principal created
by migration 029.

- capability role: `system_map_facts_reader`
- login principal: `health_monitor_system_map_reader`
- Health Monitor credential: `WORKSPACE_CORE_SYSTEM_MAP_DB_URL`

The Product Evolution principal `health_monitor_workspace_reader` and its
`product_evolution_evidence_reader` capability remain unchanged.

## Why

Migration 029 deliberately makes the Product Evolution reader single-purpose:
it fails if the principal inherits an unexpected role or gains access to
another private schema. Adding System Map access to the same principal would
make the new feature depend on weakening an existing fail-closed contract.

A second password/DSN costs some operational work, but keeps the permission
boundaries independently auditable and independently revocable.

## Initial data contract

System Map Phase 2A may read only selected columns from:

- `registry.products`
- `registry.product_relations`
- `flow.value_flows`
- `flow.flow_versions`

It does not read free-text descriptions, metadata, relation notes/source text,
Flow purpose/summary, Flow steps/edges, Knowledge, or another private table.

The row policies allow only lifecycle/model/relation vocabularies that were
observed and reviewed on 2026-09-23. A newly introduced vocabulary value is
therefore invisible until this contract is revisited.

## Source-of-truth boundary

This reader does not make Workspace Core the System Map runtime source.

- `system_map*.yaml`: authored layout / presentation bindings
- Workspace Core: reviewed Product / Relation / Value Flow facts
- Health Monitor local state: runtime observations
- Workstream / GitHub Issue: improvement decisions

Health Monitor must continue to render the local map if Workspace Core cannot
be read.

## Not decided here

This change does not decide:

- how Map nodes bind to Product/Flow slugs;
- how reviewed facts are presented in the UI;
- Map state from Product/Flow lifecycle;
- Manual / Constraint / AI Opportunity classification;
- production credential values or production rollout timing.

Those remain in pc-saas-health-monitor #326 and its follow-up phases.
