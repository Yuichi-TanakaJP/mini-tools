# Workspace Core Semantic Specification Contract v1

Date: 2026-09-23
Related: mini-tools #682, pc-saas-health-monitor #257 / #326

## Decision

Workspace Core is the semantic / architecture graph that helps AI understand
what the user's products and flows *mean*. It is not the canonical warehouse
for implementation specifications or repository source text.

The boundary is:

- Repository code / docs / ADR / API contracts / DDL / runbooks / UAT are the
  implementation source of truth.
- Workspace Core is the source of truth for reviewed Product identity,
  Functions, Capabilities, relationships, Value Flows, Problems, Principles,
  Constraints, Goals, Outcomes, Evolution history, provenance, confidence and
  verification metadata.
- Health Monitor is the source of truth for runtime observation and current
  execution state.
- Workstreams / GitHub Issues are the source of truth for improvement
  decisions, priorities and execution progress.

Workspace Core should reference repository evidence rather than copy full
implementation documents into the database.

## Why

The System Map project needs more than boxes and arrows. To decide whether a
manual step should stay human, receive AI assistance, be automated, or remain
under investigation, an agent needs to understand:

- what the Product is for;
- what Functions it exposes;
- what Capabilities it demonstrates;
- how value moves through an As-Is Flow;
- which Problems / Goals / Principles / Constraints explain that flow;
- what evidence supports those facts;
- how the design evolved.

The current Workspace Core schema already represents those concepts. Copying
whole specifications or code into Workspace Core would create a second source
of truth and recreate the same drift problem the System Map work is meant to
remove.

## Semantic Specification Packet v1

A primary Product / Flow is considered sufficiently described for an AI
improvement review when the following are available where relevant:

1. Product identity and lifecycle.
2. Product Functions.
3. Capabilities and latest assessment / rationale.
4. As-Is Value Flow and, when useful, Proposed / Experimental versions.
5. Flow Steps and Edges.
6. Step -> Product / Product Function links.
7. Reviewed Knowledge:
   - problem
   - goal
   - principle
   - constraint
   - pattern / insight when useful
8. Flow Outcome.
9. Evidence links to repository documents, Issues, commits, logs or other
   canonical sources.
10. Evolution Events.
11. Provenance fields such as source, confidence and verified_at.

Not every Packet needs every optional relation. A missing link is a review
candidate, not automatically an error.

## Rules

- Do not infer confirmed semantics from a file name, node id or Product title.
- Keep provisional and confirmed facts distinct.
- Keep As-Is / Proposed / Experimental state distinct.
- Do not promote runtime observations into reviewed architecture facts.
- Do not promote AI-generated improvement ideas into adopted knowledge without
  review / confirmation.
- Do not copy full repository documents into Workspace Core merely to make AI
  retrieval easier. Store the stable semantic fact and evidence reference.
- Add schema only after a concrete fact cannot be represented cleanly by the
  current model.
- Preserve source / confidence / verified_at wherever the model supports them.

## Current schema used by this contract

Registry:
- products
- product_functions
- capabilities
- capability_assessments
- product_capabilities
- product_relations
- repositories
- external_resources
- provider / technology / service relations

Flow:
- value_flows
- flow_versions
- flow_steps
- flow_edges
- flow_step_products
- flow_step_product_functions
- flow_step_providers / resources
- flow_knowledge_links
- flow_outcomes

Knowledge / Evolution:
- knowledge.items
- item_products / item_relations / item_resources
- evolution_events and their relation tables

Coordination / Runtime remain separate domains.

## Consequences

Workspace Core can support fairly deep cross-system understanding without
becoming a content warehouse. The next work is therefore primarily
**coverage and evidence quality**, not broad schema expansion.

The first four Products to audit against this Packet are:

1. pc-saas-health-monitor
2. market-info
3. mini-tools
4. stock-notes

System Map Phase 2B (Manual / Constraint / AI Opportunity) should only depend on
reviewed semantics that meet this contract or clearly label missing / provisional
context.
