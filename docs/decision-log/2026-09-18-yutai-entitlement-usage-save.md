# 利用実績Panelのv2保存経路

## 背景

mini-tools PR #654で追加した利用実績Panelは、v2台帳をRepositoryから読む一方、保存は直接RPCを呼び、成功後にページを再読み込みしていた。

## 今回決めたこと

このPanelの `record_entitlement_usage` はv2 Repositoryから保存する。通信結果が不明な場合は同じ要求IDで再確認し、その間は別の保存を止める。保存後はRepositoryの台帳と、履歴タブの履歴一覧を再取得する。

## 判断理由

応答を失った保存を新しい要求IDで再送すると、利用実績の重複記録につながり得る。既存のv2 Repositoryには同じ要求IDでの再確認とセッション確認があるため、このPanelで利用する。

## 影響範囲

履歴タブの利用実績Panel、v2コマンド型・応答検証、v2 UAT。すべての画面に一律のRepository経由ルールを新設する判断ではない。

## 関連

- mini-tools PR #654
- [Reward Model v2仕様](../specs/tools/yutai-expiry-v2.md)
