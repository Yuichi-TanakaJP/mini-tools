# Workspace System Context Map v0.1

Issue: #626  
Parent: #598

## Purpose

The map is not an execution console. Its purpose is to make the current relationship between the user, AI interfaces, products, executable runtimes, data stores, and manual interventions understandable enough to identify improvement opportunities.

```text
Observe current structure
→ explain manual boundaries and constraints
→ classify keep-human / AI-assist / automate / investigate
→ create an improvement backlog
→ later close selected work into verified loops
```

## Existing implementation audit

The repository already contains two useful but different views.

### `/premium/product-map`

- Product-centered detail
- Repository / Technology / Provider / Service Instance
- Evidence and confidence
- one-hop Product relations
- Provider impact

### `/premium/product-map/dashboard`

- Service value map
- Product portfolio state
- Focus and review queue
- Product / Provider / Technology context

These views answer **what exists and what value it supports**. They do not yet answer the complete System Context question:

- who operates it from which device
- where the process actually runs
- what it reads and writes
- where authoritative data and artifacts remain
- why a human must intervene
- what stops when the local PC or a cloud provider is unavailable
- where AI assistance or automation should be introduced

System Context Map is therefore a separate read model, not a replacement for Product Map.

## Display contract

Default:

- `Current As-Is`
- `Runtime Observed`

Optional overlays:

- `Approved Proposed`
- `In Development` only when linked to an active Workstream or PR

A local uncommitted working draft is internal evidence and is not shown in the default user-facing map.

## v0.1 views

### System Context

Layers:

1. User / Access
2. AI / Control
3. Products / Systems
4. Execution / Runtime
5. Data / Evidence

Access Surface and Execution Locus remain separate. Being able to view or instruct from a smartphone does not imply that the workload executes on the smartphone.

### Market Data Flow

Initial detailed flow:

```text
User on Windows PC
→ browser login / MFA
→ PowerShell wrapper
→ Python orchestrator / child jobs
→ local CSV / JSON / PNG / logs
→ Cloudflare R2
→ Market Info API
→ Mini Tools
→ PC / Smartphone view
```

The view includes manual touchpoints, constraints, improvement classification, and availability scenarios.

## Evidence policy

```text
Raw repository / runtime evidence
→ discovered candidate
→ review
→ accepted architecture fact
→ user-facing read model
```

PR #603 provides a supporting static Scanner. Scanner output is never rendered directly and is never auto-accepted.

## Claude Code handoff

No new pushed branch or PR for this System Context Map was found at the start of #626. The existing Product Map and Workspace Dashboard were already merged earlier and are foundations, not unfinished System Context work.

If Claude Code has local-only changes:

1. commit and push them to a dedicated branch
2. identify the base SHA and changed paths
3. do not continue editing the same files in parallel
4. compare the branch with `feat/workspace-system-context-map-v0-1`
5. port only verified non-duplicative work

Recommended responsibility split:

### GitHub / Workspace Core side

- information architecture
- read model and UI
- evidence review
- Issue / Workstream / PR tracking

### Local PC side

- local clone scan
- Task Scheduler, running process, SQLite and latest log observation
- desktop / smartphone UAT
- preservation of local-only code

## Non-goals for v0.1

- execute or restart systems from the map
- change login or MFA behavior
- change scheduler configuration
- copy all operational data into Workspace Core
- show raw Scanner candidates as facts
- merge Current, Proposed, Development and Working Draft into one graph
