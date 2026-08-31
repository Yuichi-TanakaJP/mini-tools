# Company Functions Root Guard

Date: 2026-08-31  
Issue: #557  
Parent decision: `2026-08-31-company-functions-derivation-policy.md`

## Problem

専門taxonomyに付与されたcompany linkは、常に「その法人がグループ内で直接担う機能」を意味するとは限らない。

特にgroup root / parent / holding companyでは、グループ全体の事業エクスポージャーや代表配置として複数taxonomyが付くことがある。

Sony Group本体では、既存 `ip-content` / `semiconductors` taxonomyからゲーム・映画・音楽・半導体等を機械的にcompany-functionsへ導出すると、子会社が実際に担う役割までroot自身の担当機能として見えることが確認された。

## Decision

- `stock_notes_corporate_groups.metadata.root_company_slug` で指定されたgroup rootは、専門taxonomyからcompany-functionsを自動導出しない。
- rootに表示するcompany-functionはexplicit direct linkだけとする。
- 非root企業にはcross-domain derivation policy (#555)を適用する。
- direct linkはderived linkより常に優先する。

## Why this is not a special-case for Sony

root identityはSony固有のハードコードではなく、既存corporate group metadataに保存された共通構造を使う。

同じルールはHitachiやToyotaなどroot metadataを持つグループにも適用される。

## Resulting semantic layers

1. Specialist taxonomy: 企業・グループの産業/テーマ上の事業エクスポージャーを含むSource of Truth
2. Cross-domain mapping: 専門概念と横断company-function概念の意味対応
3. Derived company-function: 非root企業で意味対応が一意な場合にread modelで導出
4. Direct company-function: root、または一意導出不能な例外に対する明示的な機能assertion

この4層を混同しない。
