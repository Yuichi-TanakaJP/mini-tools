# Workspace Core V3 Semantic Foundation

Related: #576

## Goal

Workspace Core V3 extends the existing Product / Repository / Technology / Provider registry so ChatGPT / AI Agents can reason about:

- why a Product or Function exists;
- what problem, idea, principle, or value motivated it;
- where that knowledge came from;
- how Products and development methods evolved over time;
- which reusable Capabilities were gained;
- how system/data flow and human action combine into end-to-end Value Flows.

UI is a projection of this model, not the schema design driver.

## Source-of-truth boundary

- GitHub remains authoritative for code, Issues, PRs, and repository documents.
- Operational Supabase projects remain authoritative for their own data.
- `mini-tools` Personal Log remains authoritative for raw personal-history/thought entries.
- Workspace Core stores canonical semantic units, cross-system relationships, provenance, and flow/evolution structure.
- Raw Personal Log bodies are not copied into Workspace Core. `registry.external_resources` stores logical pointers (`project_ref / schema / table / row_id`).
- AI inference candidates are intentionally not part of the initial Canonical graph.

## V3 model

```text
Workspace Core
├─ registry
│  ├─ products
│  ├─ product_functions
│  ├─ technologies
│  ├─ capabilities
│  ├─ product_capabilities
│  ├─ capability_technologies
│  └─ capability_assessments
├─ knowledge
│  ├─ items
│  ├─ item_relations
│  ├─ item_* bindings
│  ├─ evolution_events
│  ├─ evolution_event_relations
│  └─ evolution_event_* bindings
└─ flow
   ├─ value_flows
   ├─ flow_versions
   ├─ flow_steps
   ├─ flow_edges
   ├─ flow_step_* bindings
   ├─ flow_knowledge_links
   └─ flow_outcomes
```

### Product Function vs Capability

- **Product Function** = durable value-flow-significant function inside a Product. Not a source-code function inventory.
- **Capability** = reusable problem-solving ability gained or demonstrated through Products.

Example:

```text
Product Function: Market Info / 市場ランキング取得
Capability: 認証付きWebデータ取得
Technology: Playwright + Python
```

## Knowledge layer

Initial `knowledge.items.kind` vocabulary:

- `problem`
- `principle`
- `insight`
- `idea`
- `goal`
- `value`
- `pattern`
- `hypothesis`
- `constraint`

Confirmed user statements, provisional hypotheses, and artifact-verified facts retain separate `verification_status / confidence / source / verified_at` values.

## Evolution layer

Evolution history is separate from semantic relations because time matters.

Approximate dates are represented as bounded periods instead of fabricated exact timestamps.

Example Market Info history:

```text
2025-09 (approx.)
Market Info automation origin
  ↓
ChatGPT → Cursor copy/paste development
  ↓
2025-12 (provisional)
Codex adoption
  ↓
2025-12 – 2026-02 (provisional)
More implementation delegated to Codex
  ↓
2026-03 (approx.)
Claude Code adoption
```

## Value Flow layer

A Value Flow is the end-to-end journey, not a Product hierarchy.

`flow_edges.edge_type` distinguishes:

- `system_data`
- `system_handoff`
- `human_handoff`
- `feedback`
- `control`

As-Is and To-Be are separate `flow_versions`.

Example:

```text
YouTube investment signal flow

v1 as_is
LINE → user reads → MiniTools → Stock Notes → decision
       human handoff  human handoff

v2 proposed
LINE → context-preserving deep link → MiniTools → Stock Notes → decision
       system handoff                 system handoff
```

## Golden Dataset

V3 is validated with six reviewed scenarios:

1. YouTube → LINE → MiniTools / Stock Notes → investment decision
2. Dividend app inspiration → proposed dividend-growth feedback flow
3. Human knowledge / existing app → Yutai cross support
4. RAG Workbench → RAG capability learning
5. Market Info manual pain → automation → AI-development evolution
6. Test English text-friction → OCR / static PWA

Current live V3 seed snapshot after initial application:

- Product Functions: 14
- Capabilities: 14
- Capability assessments: 14
- Knowledge items: 15
- Knowledge relations: 6
- Evolution events: 9
- Value Flows: 5
- Flow versions: 6
- Flow steps: 42
- Flow edges: 36
- Flow outcomes: 6

Counts are validation snapshots, not schema invariants.

## Replay / hardening checks

The previously `NOT EXISTS`-based natural keys were hardened with unique indexes for:

- Capability assessments
- Evolution events
- Flow outcomes

A replay of those three Golden Seed blocks inserted:

```text
capability_assessments_inserted = 0
evolution_events_inserted       = 0
flow_outcomes_inserted           = 0
```

V3 foreign-key covering indexes were added after Supabase advisor review.

## Advisor state

Security advisor:

- ERROR/WARN: none
- INFO: `rls_enabled_no_policy` for private custom schemas; intentional under the existing server-only model

Performance advisor after FK hardening:

- `unindexed_foreign_keys`: none for V3
- remaining findings: `unused_index` INFO only, expected for newly created graph indexes / low-usage development data

## Security

The existing Workspace Core security boundary is unchanged:

- `registry`, `knowledge`, and `flow` are private custom schemas;
- RLS is enabled as defense in depth;
- browser roles receive no direct table grants/policies;
- privileged server-side / service-role access is used;
- no credentials, tokens, passwords, or secret values are stored.

## SQL order

After V1/V2 SQL (`001`–`013`):

1. `014_v3_registry_functions_capabilities.sql`
2. `015_v3_knowledge_evolution.sql`
3. `016_v3_value_flow.sql`
4. `017_seed_v3_golden_dataset.sql`
5. `018_finalize_v3_golden_links.sql`
6. `019_v3_natural_key_hardening.sql`
7. `020_v3_fk_index_hardening.sql`

## Acceptance questions

The model is intended to support questions such as:

- Why did this Product exist in the first place?
- Which external source or Personal Log entry supports that explanation?
- What was done manually before automation?
- How did the development workflow itself evolve?
- What Capability was gained through a Product?
- Which Technology enabled that Capability?
- Which handoffs are still human/manual?
- How does the proposed Flow differ from current reality?
- Which Problems appear across different Products and may represent a reusable problem-solving pattern?

Reuse opportunities that have not been confirmed are intentionally left to the future Inference layer rather than being written into Canonical data as facts.

## Non-goals

- Copying Personal Log bodies into Workspace Core
- Treating AI-generated relationship guesses as facts
- Registering every source-code function as a Product Function
- Replacing Stock Notes or other domain databases as their Source of Truth
- Building a large graph UI before the database model proves useful
- Deleting the provisional V2 Service model in this phase
