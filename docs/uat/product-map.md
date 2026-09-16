# Product Map — historical lineage boundary UAT

Related specification: [Workspace Core README](../../infra/workspace-core/README.md). Related review/change: [PR #656](https://github.com/Yuichi-TanakaJP/mini-tools/pull/656).
Implementation: [read loader](../../lib/workspace-core/data.ts), [relation policy](../../lib/workspace-core/product-relation-policy.ts).

## Contract

`registry.product_relations.predecessor_of` is historical lineage, not a runtime dependency. Retain it in the canonical private DB. The existing dependency-facing overview and incoming/outgoing detail arrays omit that relation type. Other relation types are unchanged. This change does not add a separate history panel or delete the canonical historical edge. The generic Product `relationCount` remains a canonical total, not a runtime-dependency count.

## Automated data-contract UAT

Run from the repository root:

```sh
npm run test -- lib/workspace-core/__tests__/relation-projection.test.ts
```

The synthetic fixtures exercise the actual loaders: overview and both detail directions; archive/product preservation; preservation of non-historical links; nonmutation of source rows; empty/missing states; and relation-read errors remaining errors rather than an empty-success graph. These tests require no private DB or credentials. Record actual results and checked commit in the PR, not as checkmarks here.

## Browser verification (Preview or authorized local environment)

On desktop and smartphone, after normal Premium authentication:

1. Open `/premium/product-map`, choose Test Antigravity. Expect its archived product to remain selectable. The outgoing dependency-facing map must not claim it is required to run Sensoria Portfolio.
2. Choose Sensoria Portfolio. Expect the predecessor not to appear in the incoming dependency-facing map. A normal dependency such as MiniTools consuming an API must remain visible when its product is selected.
3. Inspect `GET /api/premium/workspace-core?mode=overview` and product-detail responses for both products. Expect no `predecessor_of` inside the dependency-facing relation arrays. No private replay manifest or Personal Log payload may be returned.
4. With an authorized DB read, confirm the canonical `predecessor_of` row still exists. Do not change production rows to create a negative test.
5. In an isolated fixture/mock, make relation loading fail. Expect the existing error handling, not an empty graph indicating successful loading.

No layout/visual component is changed by this projection fix. Automated data-contract checks do not establish smartphone visual quality, production configuration, or actual authentication behavior. Mark browser steps unperformed in the PR when no authorized browser environment is available; never substitute Preview Ready for visual verification.
