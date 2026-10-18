# MiniTools working agreements

## Safety and authority

- Verify facts; leave unknowns explicit. Preserve unrelated dirty/untracked work; never read or expose secret environment values or commit credentials/private data. Only secret-free environment examples belong in Git.
- Reversible branch-local work proceeds without extra approval. Explain API/schema/dependency/schedule/instruction changes once before implementation. Diagnosis alone does not authorize implementation.
- Obtain explicit approval immediately before default-branch merge, deletion/overwrite, force push, production deploy, external publication or paid operations; state what remains and what is removed. Do not infer authorization from a checklist.
- Use a purpose-specific branch/PR against the actual default, one purpose per PR. Inspect branch/status before changes and merge; stage only intended files. Preserve generated/environment files unless intentionally changed. Use --body-file for multiline GitHub bodies.
- PRs record changes, related issue, actual checks/review and limitations. Inspect final diff, current base/head, checks and unresolved findings before approved merge. After merge, sync without overwriting dirty work; clean worktree/branches and prune only with deletion approval.

## Repository-specific workflow

- Keep implementation PRs and generated-data-update PRs separate for every size/format; in particular do not mix large JSON/CSV diffs with implementation. Do not commit incidental next-env.d.ts changes.
- Record settled specification/operational decisions in docs; when such decisions change, follow [the writing workflow](docs/docs-writing-workflow.md), including decision-log applicability.
- Follow stacked-PR order and the existing merge-commit strategy; do not fold cleanup into merge automatically. For browser verification, review-process tracking or approved branch cleanup, read [operation notes](docs/agent-operation-notes.md).

## ポートフォリオ意思決定ワークスペースの作業（must）

`/premium/portfolio`、銘柄ダッシュボードとのportfolio連携、関連データ取得・UI・UATを
始める前に、必ず次を読む。

- `docs/plans/portfolio-decision-workspace-plan.md` — MiniTools側の実行計画
- `docs/specs/tools/portfolio.md` — 現在実装済みの仕様と未完成範囲
- stock-notes `docs/portfolio-platform-plan.md` / `docs/portfolio-plan-checklist.md` — クロスリポジトリ正本と適合確認

作業開始時に対象Phaseと今回満たす受入条件を明示し、PR本文にも記載する。単なる保有表、
グラフ、読み取り画面を、意思決定ワークスペースの完成として扱わない。

正本計画と異なるスコープ縮小、Phase移動、完成条件変更は、理由と影響をdocsへ記録し、
ユーザーの明示確認を得るまで実施しない。
## Behavior validation

- Tier 0: meaning-preserving docs/comments/examples; final diff and relevant syntax/link checks. Tier 1: local internal logic; targeted lint/tests and independent review for behavior changes.
- Tier 2: API/UI, scheduled work or external I/O; affected lint/tests, relevant build and **executed changed-behavior UAT**. Tier 3: auth/billing/migrations/security/production or broad impact; related full suite/build, rollback/recovery and executed release/UAT checks. Use the highest applicable tier.
- Add practical regression/boundary tests for changed behavior. Scheduled work, public output and external delivery need real tests and documented commands; document a justified absence instead of installing a synthetic gate.
- For Tier 2+ user-visible behavior, update the relevant UAT document in the same PR: operation/input, expected result, failure behavior and environment. Keep execution evidence in the PR, not permanent checked boxes. Before publication or a major release, check the applicable release checklist.
- High-risk or broad changes require the related full suite/build, recovery/rollback evidence and relevant UAT; local edits use targeted checks. Classify by actual meaning/operational impact, not extension or line count; unknown impact is not review-skippable.

## Review and local verification

- Meaning-preserving edits: final diff and relevant syntax/link/output checks. Behavior changes: one independent review. Auth/permissions/secrets/billing/migrations/production or broad impact: heightened review with specialist and rollback scrutiny.
- The agent chooses model/profile/effort and records review depth/reason in the PR. Failed invocations are not reviews and alone do not justify lowering depth; use an available method. Reassessed depth needs a reason. Re-review material changes, not typo/comment/evidence-only followups.
- Use affected repository checks; do not add dependencies or unrelated full suites just for verification. Failures, unresolved findings and missing required evidence block merge. Report untested coverage.
- Local validation is primary; optional Actions are skipped by default after checking enforced rules and repo exceptions. Existing automatic triggers remain: use [skip ci] only when permitted; do not dispatch/re-run by default. Record real run outcomes, using NOT_RUN only for no execution. Approval for merge, deletion, publication, deployment and paid operations remains required.

## CI scope

When adding/moving/reclassifying paths or changing CI/skip behavior, follow [the repository CI policy](docs/specs/cross-cutting/ci-scope-policy.md). Preserve domain/deploy/schedule workflows and unknown-path validation; do not repeat unchanged checks.
