# Superseded: temporary manual production release gate

Status: superseded on 2026-10-25 by the owner's explicit request to restore main auto-deployment. The historical decision below no longer governs current releases.

## Current decision and reason

Remove the temporary vercel.json, whose only behavior was git.deploymentEnabled.main=false. Use the existing Vercel Git integration: main merges automatically build and publish production; feature branches continue producing Previews. The owner requested this familiar operation to avoid a separate, confusing merge/deploy step. Merge approval must be understood to include that automatic production effect; unrelated manual production operations still require approval.

No application, dependency, environment-variable, database, domain, credential or scheduler settings change. Verify local full tests/build, independent release-control review and latest-head CI/Preview before merging. After merge, verify a Git-triggered production deployment for the exact merge SHA reaches READY and the public alias resolves to it. A manual deployment is not evidence that automatic publishing works.

Rollback baseline before this restoration: dpl_CdQER5wLQB5uxL2JFDtDSugorMR1 (commit 70afdf68aa616d0d3e995c01d04cf932585d907d). If release health fails, use an explicitly authorized rollback to that existing patched artifact; investigate and repair the pipeline before resuming. Vercel rollback can disable automatic domain assignment, so verify that state before considering normal operation restored.

## Historical decision (superseded)

# 2026-10-25: merge security patches without publishing production

The user authorized merging a verified security patch while explicitly withholding production-release approval. The current production deployment tracks main; merging without a guard would otherwise publish automatically.

Set vercel.json git.deploymentEnabled.main=false. Unspecified branches stay enabled, so the existing PR Preview flow continues. This is a versioned branch-specific Git deployment guard, not a project-wide pause or domain change. It remains in effect for future main pushes/merges until a separately authorized change removes it. The current production deployment and domains must stay unchanged.

This guard blocks Git-triggered deployments, not explicit CLI/API deployments or promotion. Those still require explicit user approval. Do not infer production approval from merge approval. There are no environment-variable, DB, credential, domain, scheduler or live-data changes in this patch.

Official configuration reference: https://vercel.com/docs/project-configuration/git-configuration#gitdeploymentenabled

Acceptance before merge: all dependency advisories are zero, affected full test/lint/build/PWA checks pass, independent security/release review passes, latest-head CI and Preview succeed, and the Vercel config has only main=false with no matching true wildcard. Before/after merge, verify the production alias still resolves to the same deployment ID and source commit. Verify no production deployment is created for the merge commit. Mark runtime production verification NOT_RUN because production must not be changed.

Rollback of this guard is a production-release control change and requires approval. Do not revert it merely to restore automatic publishing. Emergency application rollback uses a separately approved prior artifact/revision; reverting vulnerable dependency versions requires renewed security review.
