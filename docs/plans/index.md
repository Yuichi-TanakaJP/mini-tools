# Plans インデックス

計画、検証方針、移行プランを置く場所です。
現在仕様として確定した内容は、必要に応じて `docs/product-spec.md`、`docs/specs/tools/`、`docs/specs/cross-cutting/` に反映します。

| ドキュメント | 内容 |
|---|---|
| [月100円マネタイズ計画](./month-100-yen-monetization-plan.md) | 月100円収益化検証の全体計画 |
| [月100円プロジェクト進捗チェックリスト](./month-100-yen-progress-checklist.md) | 月100円検証の進捗確認リスト |
| [ペンギンシューター新ゲーム作成計画](./penguin-shooter-new-game-plan.md) | PDF企画書をベースにした新規ゲーム tool の段階実装計画 |
| [プロジェクト継続・撤退判断基準](./project-continuation-criteria.md) | 継続、撤退、凍結の判断基準 |
| [株価ランキング外部データ移行計画](./stock-ranking-external-data-migration-plan.md) | stock-ranking の外部データ公開移行計画 |
| [yutai-expiry カメラ画像認識計画](./yutai-expiry-image-capture-plan.md) | 優待券をカメラ撮影し Gemini で自動入力する段階実装計画 |
| [Phase 1 クロスデバイス同期 実装計画](./phase1-cross-device-sync-plan.md) | 任意ログイン + Supabase でツールデータをデバイス間同期する段階実装計画 |
| [優待統合ダッシュボード（PC）実装計画](./yutai-dashboard-plan.md) | 優待候補の発掘と運用管理を PC 向けテーブルで統合する段階実装計画 |

## 更新ルール

- 実行計画や検証計画はここに置く
- 入出力 contract や現在仕様に昇格した内容は specs 側へ切り出す
- 古くなった計画には、優先される現在仕様や decision-log へのリンクを明記する
