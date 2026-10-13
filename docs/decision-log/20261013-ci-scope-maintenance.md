# CI対象の保守方針（2026-10-13）

無駄なCI起動を減らすため、通常CIの説明専用除外をREADME.mdの完全一致から開始し、PRの古い実行だけをキャンセルする。Workspace Origin SQLは既存path条件を維持する。新pathは自動除外せず、用途変更と同じPRでルールを見直す。拡張子やdocs配下という理由で実行入力を外さない。

現在の手順は[横断仕様](../specs/cross-cutting/ci-scope-policy.md)。共通テンプレート・既存repo差分更新はrepo-templates #22で計画する。CI上限変更・課金・本番DB操作は行わない。
