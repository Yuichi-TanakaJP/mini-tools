# MiniTools working agreements

## Safety and authority

- Verify facts; leave unknowns explicit. Preserve unrelated dirty/untracked work; never read or expose secret environment values or commit credentials/private data. Only secret-free environment examples belong in Git.
- Reversible branch-local work proceeds without extra approval. Explain API/schema/dependency/schedule/instruction changes once before implementation. Diagnosis alone does not authorize implementation.
- Obtain explicit approval immediately before default-branch merge, deletion/overwrite, force push, production deploy, external publication or paid operations; state what remains and what is removed. Do not infer authorization from a checklist.
- Use a purpose-specific branch/PR against the actual default, one purpose per PR. Inspect branch/status before changes and merge; stage only intended files. Preserve generated/environment files unless intentionally changed. Use --body-file for multiline GitHub bodies.
- PRs record changes, related issue, actual checks/review and limitations. Inspect final diff, current base/head, checks and blocking findings before approved merge. After merge, sync without overwriting dirty work; clean worktree/branches and prune only with deletion approval.

## Repository-specific workflow

- Production workflow (owner decision, 2026-10-25): merging to main automatically deploys to production through the existing Vercel Git integration. Keep branch Previews enabled. Explain that main merges publish production and complete required validation/review before merge. The owner explicitly requested restoring this normal operation; do not reintroduce a separate manual deployment gate unless requested. Preserve approval requirements for merge and unrelated production operations.

- Keep implementation PRs and generated-data-update PRs separate for every size/format; in particular do not mix large JSON/CSV diffs with implementation. Do not commit incidental next-env.d.ts changes.
- Record settled specification/operational decisions in docs; when such decisions change, follow [the writing workflow](docs/docs-writing-workflow.md), including decision-log applicability.
- Follow stacked-PR order and the existing merge-commit strategy; do not fold cleanup into merge automatically. Before browser verification, launching `codex review` or approved branch cleanup, read [operation notes](docs/agent-operation-notes.md).

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

- Add practical regression/boundary tests for changed behavior. Scheduled work, public output and external delivery need real tests and documented commands; document a justified absence instead of installing a synthetic gate. Before publication or a major release, check the applicable release checklist.

## Review and local verification

- Known, isolated low-risk edits with reversible effects (not just Git-revertible): affected checks and final diff; independent review/UAT docs optional. Size/extension alone is not low risk; high-risk gates and stricter domain rules override this exemption.
- Other behavior changes: affected tests, changed-path check and one independent review. Build/integration/UAT only where affected. Record results in PR or existing UAT; update changed acceptance contracts.
- Auth/permissions/secrets/billing/migrations, external send/publish controls, live-data/processed-state writes, scheduler execution controls (including retry/exit gating), production or broad high impact: independent specialist/domain and rollback scrutiny, related full suite/build and relevant UAT. Investigate unknown impact before granting a low-risk exemption.
- Choose model/effort for risk; briefly report scope/results/untested coverage. Failed reviews do not count or waive required scope. Re-review material changes only. Required-check failures and correctness/safety/requirement findings block; optional polish does not.
- Local checks first; optional Actions default off subject to enforced rules/domain exceptions. Preserve triggers; [skip ci] only when allowed, no default dispatch/reruns. No execution = NOT_RUN, never PASS. Existing merge/deletion/deploy/publication/paid-operation approvals remain.

## CI scope

When adding/moving/reclassifying paths or changing CI/skip behavior, follow [the repository CI policy](docs/specs/cross-cutting/ci-scope-policy.md). Preserve domain/deploy/schedule workflows and unknown-path validation; do not repeat unchanged checks.

## Navigation contract maintenance

For page/link/router/form/data-condition/fallback changes, follow [navigation contracts](docs/specs/cross-cutting/navigation-transitions.md#9-遷移契約の変更時チェック) and run `npm run check:navigation -- --base <actual-base>` plus affected tests. Use the shared `navigation-design-review` Skill for state/condition/latency semantics that static checks cannot prove. Update canonical contracts, generated spec tables and affected test/UAT references together; do not approve a bulk inventory snapshot as behavioral evidence.
