# Workspace Core Semantic Specification audit — 2026-09-23

Related: #682

This is a read-only snapshot of the live Workspace Core database. It measures
whether the current model is capable of carrying enough context for the System
Map / improvement loop. It is not a permanent count invariant.

## 1. Current model size

### Registry

- Products: 19
- Product Functions: 55
- Capabilities: 43
- Capability Assessments: 43
- Repositories: 21
- External Resources: 41
- Product -> Repository links: 21
- Product -> Technology links: 55
- Product -> Provider links: 23
- Product relations: 7

### Flow

- Value Flows: 16
- Flow Versions: 18
- Flow Steps: 114
- Flow Edges: 96
- Step -> Product links: 57
- Step -> Product Function links: 41
- Flow -> Knowledge links: 27
- Flow Outcomes: 17

### Knowledge / Evolution

- Knowledge Items: 90
- Evolution Events: 47
- Product-linked Knowledge Items: 67 / 90
- Flow-linked Knowledge Items: 27 / 90
- Item-to-item relation participants: 10 / 90
- Knowledge -> Evidence resource links: 58

Knowledge kinds currently used:
- problem
- principle
- insight
- idea
- goal
- value
- pattern
- hypothesis
- constraint

External resources include:
- repository_document: 22
- github_commit: 6
- github_issue: 2
- github_repository_snapshot: 1
- notion_database: 1
- personal_log_entry: 9

### Coordination / Runtime

- Workstreams: 4
- Workstream Updates: 46
- Workstream Links: 64
- Observability current_states: 195
- Observability status_events: 31

## 2. What the model can already express

The schema already separates:

- Product identity
- Product Function
- reusable Capability
- Capability maturity / rationale
- versioned As-Is / Proposed / Experimental Value Flows
- typed Flow Steps and Edges
- Product / Function / Provider / Resource participation in a Step
- Flow Outcomes
- reviewed Problem / Principle / Constraint / Goal / Pattern / Insight
- Knowledge relations such as addresses / constrains / informs / realized_by
- external evidence references
- Product evolution events
- source / confidence / verification timestamps
- Workstream execution state
- runtime observability

That is sufficient for a rich semantic model. A new generic "spec table" is
not justified by the current evidence.

## 3. Four primary Product snapshots

| Product | Functions | Capabilities | Knowledge | Evidence resources | Evolution events |
| --- | ---: | ---: | ---: | ---: | ---: |
| pc-saas-health-monitor | 3 | 3 | 5 | 2 | 2 |
| market-info | 3 | 5 | 7 | 2 | 5 |
| mini-tools | 2 | 2 | 8 | 3 | 2 |
| stock-notes | 4 | 4 | 9 | 1 | 1 |

Examples already present include:

- Health Monitor:
  - Local-first Observability
  - Actionable Alert design
  - Outbox Cloud Mirror
  - Problems about buried alerts / invisible data assets / invisible limits
  - Principle: Local-first, Cloud is a history mirror
- Market Info:
  - authenticated web acquisition
  - browser automation
  - scheduled data pipeline
  - market data normalization
- Stock Notes:
  - AI context API
  - immutable snapshot ingestion
  - investment decision memory
  - versioned policy management

This confirms that Workspace Core is already holding **meaning and rationale**,
not only inventory rows.

## 4. Main gaps are coverage, not schema

The weakest area is density / linkage.

### Flow descriptions

Several important As-Is flows have concise labels but no step descriptions:

- health-monitor-operational-observability: 0 / 6 described steps
- market-ranking-to-candidate-discovery: 0 / 6
- stock-analysis-decision-memory-loop: 0 / 7
- youtube-investment-signal-to-decision: 0 / 10
- yutai-cross-decision: 0 / 5

Some other flows are fully described, so the schema supports this already.

### Semantic links

- Only 27 / 90 Knowledge Items are directly linked to a Flow.
- Only 10 / 90 participate in item-to-item relations.
- product_resources currently has 0 rows.
- flow_step_resources currently has 0 rows.
- item_capabilities / item_technologies currently have 0 rows.

Zero does not automatically mean a defect. These relations should be populated
only when they materially improve an AI decision.

### Product / Function links inside flows

Important flows often link only the Steps owned by a Product, rather than every
Step. That is sensible, but it means an AI must combine Flow structure with the
Product participation links instead of assuming every Step belongs to the
Product named by the Flow.

## 5. Evidence quality

The evidence model is already in use:

- 22 repository documents are registered as resources.
- 58 Knowledge -> Resource relations are `evidenced_by`.
- GitHub Issues / commits are also represented.
- Knowledge Items carry source / confidence / verified_at.
- Evolution Events carry verification status and provenance.

The next improvement should link the most decision-relevant Product / Flow facts
to canonical repository documents rather than copy those documents into
Workspace Core.

## 6. Recommended sequence

1. Freeze the Semantic Specification Contract v1.
2. Audit the four primary Products against the Packet.
3. Improve the first Product end-to-end before expanding broadly.
4. Use repository evidence to fill missing descriptions / links.
5. Only propose schema changes for facts that genuinely cannot be expressed.
6. Then implement System Map Phase 2B:
   - manual reason
   - constraint
   - keep-human
   - ai-assist
   - automate
   - needs-investigation
7. Test whether the combined context is sufficient for one real improvement
   decision before scaling the approach.

## 7. First validation candidate

pc-saas-health-monitor is the best first candidate because:

- the System Map UI lives there;
- it already has Product Functions, Capabilities, Knowledge and an As-Is Flow;
- its repository docs / ADRs are relatively strong;
- runtime evidence is directly available;
- the project itself contains obvious human / AI / automation boundaries.

The success test is not "all fields are filled." It is:

> Can an AI explain one current manual / operational boundary, cite the reviewed
> semantic reasons and repository evidence, distinguish current runtime from
> architecture intent, and produce a sensible improvement candidate without
> inventing missing facts?

If yes, the model is useful. If not, the missing fact becomes the next schema or
coverage requirement.
