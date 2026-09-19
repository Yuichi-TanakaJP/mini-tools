# Dark theme の審美・品質基準

## 結論

mini-tools の Dark theme は Apple Human Interface Guidelines の適応色・面階層・限定的な
material表現を参考にしつつ、既存の Quiet Financial Workspace を維持する。Apple製品の外観を
模倣するのではなく、静かな青みグレーの面階層、意味のある色の組、抑制したアクセントを採用する。

## 背景

白い固定面をテーマトークンへ置き換えるだけでは、Light用の暗い文字色がDarkの面に残り、
統一感と可読性の両方を損なうことがレビューで判明した。また「おしゃれ」の合否が担当者の感覚だけに
依存していたため、外部資料から再現可能な基準を定める必要があった。

## 決めたこと

- 選択状態は `accent-sub / accent / border-accent` を標準の組とする。
- semantic state は `-bg / -text / -border` を同じfamilyから選ぶ。
- Darkの奥行きは影や強いグラデーションでなく、既存surface ladderの明度差を主役にする。
- 本文4.5:1、独自色の小文字7:1目標、主要UI境界3:1をレビュー基準にする。
- Light固定の前景色とDark対応背景トークンを組み合わせない。

## 理由

AppleのDark Mode指針は固定色の反転でなくsemantic/adaptive colorを推奨し、baseとelevatedの
背景差で奥行きを伝えている。Materials指針も効果を見た目の色ではなく意味で選ぶとしている。
Web実装の観点でも、本文4.5:1とUI部品3:1が共通の最低基準として確認できた。

## 影響範囲

- `docs/specs/cross-cutting/ui-design-concept.md`
- `docs/uat/color-theme.md`
- Premiumの選択状態とsemantic status表示
- 色リテラル再混入防止テスト

## 参考資料

- https://developer.apple.com/design/human-interface-guidelines/dark-mode
- https://developer.apple.com/design/human-interface-guidelines/materials
- https://zenn.dev/tomokusaba/articles/c37aadf984fcd0
