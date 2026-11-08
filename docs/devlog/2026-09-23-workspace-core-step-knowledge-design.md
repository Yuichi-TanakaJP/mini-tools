# Workspace Core Step-level Knowledge binding design

Date: 2026-09-23
Status: **design only / no DDL applied**
Related: #684, #682, pc-saas-health-monitor#331, pc-saas-health-monitor PR #332

## 1. Problem proved by the Phase 2B pilot

The current model can attach reviewed Knowledge to an entire Value Flow, but
the manual-boundary pilot found several flows where different steps have
different reasons and automation boundaries.

Examples:

- market_info: login/passkey is a human authentication boundary, while the
  scrape/transform/publish steps after authentication are machine work.
- Health Monitor: starting an allow-listed task has an approval/security
  boundary, while monitoring that task is automatic.
- Stock Notes: AI may prepare an analysis or policy draft, while saving or
  activating it requires explicit user confirmation.
- MiniTools: display/read paths are automatic, while portfolio decision input
  belongs to ChatGPT + user confirmation + stock-notes.

A Flow-level Constraint cannot explain those distinctions without making an
automatic step look manual or making a human boundary look like generic flow
metadata.

## 2. Existing model and an important direction problem

Current Workspace Core already has:

- `flow.flow_knowledge_links`
- `flow.flow_step_products`
- `flow.flow_step_product_functions`
- `flow.flow_step_resources`
- `flow.flow_step_providers`
- `knowledge.item_products`
- `knowledge.item_product_functions`
- `knowledge.item_relations`

The relation vocabulary in `knowledge.relation_types` is defined as a
**source -> target** vocabulary. For example:

- `constrains`: the source limits/governs the target
- `informs`: the source materially informs the target
- `motivates`: the source creates demand for the target
- `realized_by`: the source value/goal is realized by the target

However, the existing `flow.flow_knowledge_links(flow_id, item_id,
relation_type)` data does not use one consistent natural-language direction.
Examples in current seed/live data include:

- Flow `addresses` Problem -- reads naturally as Flow -> Knowledge.
- Principle `informs` Flow -- naturally reads Knowledge -> Flow.
- Constraint `constrains` Flow -- naturally reads Knowledge -> Flow.
- Goal `realized_by` Flow -- naturally reads Knowledge -> Flow.

So the column order of `flow_knowledge_links` must **not** be copied as a
semantic direction rule for a new Step-level relation.

This design does not rewrite the existing table. It prevents the ambiguity
from spreading.

## 3. Decision: Knowledge Item is the semantic source, Flow Step is the target

Prefer this table name and direction:

```text
knowledge.item_flow_steps
```

The relation always reads:

```text
Knowledge Item --relation_type--> Flow Step
```

Examples then use the existing vocabulary naturally:

```text
constraint --constrains--> login/passkey step
principle  --informs-----> task-launch step
problem    --motivates---> failure-diagnosis step
goal       --realized_by-> safe assisted-review step
insight    --applies_to--> one data-quality step
```

No separate `direction` column is needed because the table contract fixes the
direction.

## 4. Candidate table contract

Design only:

```sql
create table knowledge.item_flow_steps (
  item_id uuid not null
    references knowledge.items(id) on delete cascade,
  step_id uuid not null
    references flow.flow_steps(id) on delete cascade,
  relation_type text not null
    references knowledge.relation_types(code) on delete restrict,
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (item_id, step_id, relation_type)
);
```

Indexes:

```text
(step_id, relation_type)
(item_id, relation_type) -- PK already starts with item_id; add only if query evidence requires it
```

The actual migration should follow the current Workspace Core numeric sequence
at implementation time. PR #681 currently proposes SQL 030, so this design
does not pre-claim migration number 030/031.

## 5. Why this belongs in knowledge schema

The relation is a semantic statement whose source is a reviewed Knowledge
Item.

That matches the existing patterns:

- `knowledge.item_products`
- `knowledge.item_product_functions`
- `knowledge.item_capabilities`
- `knowledge.item_resources`

It also lets one confirmed Constraint or Principle apply to several versioned
Flow Steps without copying its statement/evidence.

## 6. Why not flow_steps.metadata

Rejected as the canonical design for reviewed reasons.

A JSON tag such as:

```json
{
  "manual_reason": "authentication",
  "ai_opportunity": "keep-human"
}
```

would be easy to add, but it would create a second semantic store outside the
existing Knowledge/Evidence graph.

The Step reason needs:

- provisional / confirmed lifecycle through the Knowledge Item;
- evidence references;
- source;
- confidence;
- verified_at;
- reuse across several Steps;
- typed semantic relation.

Those are already modeled by Knowledge + relation rows.

`flow_steps.metadata` remains appropriate for step-local display/technical
attributes that are not canonical semantic claims.

## 7. Version/history behavior

A Step belongs to one immutable-ish Flow Version identity.

Therefore:

- As-Is and Proposed versions have separate Step IDs.
- A Knowledge Item may link to one or both versions explicitly.
- Creating a new Flow Version does **not** automatically copy Step-Knowledge
  links. Copying would incorrectly assert that the reason still applies.
- Superseding/retiring a Flow Version preserves its Steps and links unless the
  version/step is explicitly deleted.
- If a Step is deleted, its relation rows may cascade; this matches current
  Step -> Product/Function/Provider/Resource link behavior.
- If a Knowledge Item is superseded, the relation may remain for historical
  reconstruction; readers should follow the Knowledge lifecycle rather than
  silently substituting the new Item.

The migration itself should not auto-backfill links from Flow-level Knowledge.

## 8. Relation vocabulary

Initial implementation should reuse existing
`knowledge.relation_types` where the direction is natural.

Useful initial relations:

- `constrains`
- `informs`
- `motivates`
- `applies_to`
- `realized_by`

Do not add `constrained_by`, `informed_by`, etc. merely to mirror the
opposite direction. The new table fixes Knowledge as source.

If a concrete reviewed example cannot be expressed by the existing vocabulary,
add a relation type only with that example and a clear source/target
definition.

## 9. Manual Reason and AI Opportunity are not the same fact

This table solves **why a Step is shaped the way it is**.

It does not by itself adopt an AI improvement.

Recommended split:

### Reviewed current semantic fact

Knowledge Item, usually `kind='constraint'`, linked to a Step.

Example:

```text
"Broker refresh requires operator login/passkey interaction"
  --constrains-->
"SBI inventory authentication"
```

### Improvement hypothesis

Keep in Workstream/GitHub Issue while under evaluation.

Examples:

- keep-human
- ai-assist
- automate
- needs-investigation

Only after the improvement itself becomes an accepted architectural fact
should it be promoted into Workspace Core, using an appropriate Knowledge
Item/Flow version rather than overwriting the current constraint.

This prevents "AI thinks automation is useful" from becoming "automation is
approved."

## 10. Security / RLS

Follow the private V3 model:

- enable RLS;
- revoke `public`, `anon`, `authenticated`;
- service_role may manage it in the canonical Workspace Core maintenance path;
- no browser direct read.

Do **not** automatically widen the System Map reader from PR #681.

Phase 2A reader deliberately exposes only Product/Relation/Flow summary. If
System Map Phase 2B needs Step-level reviewed reasons, add that permission in a
separate, reviewed reader-contract change after this schema and data are
proven.

## 11. Read model

Initial schema can exist without a new public Product Map view.

Consumers should first prove a query such as:

```text
Flow slug
+ Flow Version
+ Step key/label
+ linked confirmed/provisional Knowledge
+ relation type
+ Evidence reference count / safe identity
```

The browser should not receive raw Evidence bodies or secrets.

## 12. Seed / replay policy

Do not infer Step links from:

- Step label text;
- `actor_type='user'`;
- node title;
- a Flow-level Knowledge link.

Seed only evidence-backed links.

For the Phase 2B pilot, likely first confirmed candidates include:

- a reviewed authentication Constraint -> SBI/Nikko authentication Step;
- explicit-approval Constraint/Principle -> Stock Notes save/activate Step;
- security-boundary Principle -> Health Monitor task-start Step.

But those links must be created only after the corresponding Knowledge Items
and exact Flow Steps are reviewed. PR #332 classifications are still
candidates.

## 13. Migration acceptance checks

Before production apply:

- table exists with the exact FK/PK contract;
- RLS enabled;
- browser roles have no access;
- relation_type FK rejects unknown codes;
- confidence bounds work;
- duplicate relation rejected;
- deleting a test Step cascades only its test link;
- deleting a test Knowledge Item cascades only its test link;
- As-Is and Proposed Step links stay independent;
- no existing Flow-level links are mutated;
- no rows are auto-created from actor_type/title/metadata;
- clean replay/bootstrap order remains documented;
- backup suite includes the new table through its normal schema backup path.

## 14. Open compatibility question

The existing `flow.flow_knowledge_links` direction is semantically ambiguous.
This issue does **not** migrate or reinterpret existing rows.

A separate audit may later document its effective semantics or replace it with
a directionally explicit model. That work is not required to add a clean
Step-level relation and should not expand #684.

## 15. Next implementation gate

Do not write DDL until:

1. PR #332 evidence packet is accepted as a sufficient concrete basis;
2. this direction/model is reviewed;
3. the exact first Knowledge Item <-> Step links are identified;
4. migration number is resolved against PR #681;
5. independent review is assigned.
