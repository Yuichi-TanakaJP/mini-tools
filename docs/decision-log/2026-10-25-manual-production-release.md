# 2026-10-25: merge security patches without publishing production

The user authorized merging a verified security patch while explicitly withholding production-release approval. The current production deployment tracks main; merging without a guard would otherwise publish automatically.

Set vercel.json git.deploymentEnabled.main=false. Unspecified branches stay enabled, so the existing PR Preview flow continues. This is a versioned branch-specific Git deployment guard, not a project-wide pause or domain change. It remains in effect for future main pushes/merges until a separately authorized change removes it. The current production deployment and domains must stay unchanged.

This guard blocks Git-triggered deployments, not explicit CLI/API deployments or promotion. Those still require explicit user approval. Do not infer production approval from merge approval. There are no environment-variable, DB, credential, domain, scheduler or live-data changes in this patch.

Official configuration reference: https://vercel.com/docs/project-configuration/git-configuration#gitdeploymentenabled

Acceptance before merge: all dependency advisories are zero, affected full test/lint/build/PWA checks pass, independent security/release review passes, latest-head CI and Preview succeed, and the Vercel config has only main=false with no matching true wildcard. Before/after merge, verify the production alias still resolves to the same deployment ID and source commit. Verify no production deployment is created for the merge commit. Mark runtime production verification NOT_RUN because production must not be changed.

Rollback of this guard is a production-release control change and requires approval. Do not revert it merely to restore automatic publishing. Emergency application rollback uses a separately approved prior artifact/revision; reverting vulnerable dependency versions requires renewed security review.
