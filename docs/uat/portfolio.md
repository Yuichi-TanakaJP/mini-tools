# ポートフォリオ UAT

## 前提

- `/premium/portfolio` にアクセスできるPremium仮ログイン情報がある
- Supabase Authにログイン済みである
- Supabaseにportfolioのreadyスナップショットがある場合と、未取込の場合を確認できる

## 正常系

- [ ] `/premium/portfolio` がPremiumログイン後に表示される
- [ ] 「意思決定」「表示」「記録」「方針」「DB確認」の5タブを切り替えられる
- [ ] 「意思決定」でsnapshot/reviewの基準日と判断状態を確認できる
- [ ] 「意思決定」で保存済みrecommendationの対象、優先順位、条件、理由を確認できる
- [ ] 金額未指定recommendationが「金額を仮定しない」と表示される
- [ ] 「意思決定」で保存済みportfolio actionの状態、実行条件、期限を確認できる
- [ ] 「表示」で評価額・取得額・含み損益・商品別配分が表示される
- [ ] 同一商品を複数口座で保有している場合、「表示」では商品単位に集約される
- [ ] 「記録」で口座名・預り区分・数量・取得単価・現在値・評価額が確認できる
- [ ] 「記録」でスナップショットの基準日・取込日時・statusが表示される
- [ ] 「方針」でreviewの全体方針と銘柄別項目が優先順位順に表示される
- [ ] 「DB確認」で読み込み状態、portfolio/snapshot/position/reviewの件数、主要ID、基準日が確認できる
- [ ] 「DB確認」に「読み取り専用」と表示され、保存・更新操作が存在しない

## 未取込・認証系

- [ ] portfolio未作成またはCSV未取込の場合、サンプルデータではなく未取込メッセージが表示される
- [ ] Supabase Auth未ログインの場合、ログイン案内と `/account` への導線が表示される
- [ ] Premium Cookie未認証の場合、Premiumログインへリダイレクトされる

## 表示確認

- [ ] 金額未取得の項目が `—` と表示され、0円と混同されない
- [ ] 株式と投資信託の数量・金額単位が崩れない
- [ ] スマートフォン幅で横スクロール可能な明細表として確認できる
- [ ] DB未取込時は「未取込」と表示され、正常な0件と混同されない
- [ ] import履歴はあるがready snapshotがない場合は「ready snapshotなし」と表示される
- [ ] ready snapshotがない場合でも、最新取込snapshotに保存済みのポジション行があれば「DB確認」で表示される

## 関連

- 仕様: [ポートフォリオ仕様](../specs/tools/portfolio.md)
- Decision Log: [ポートフォリオの「表示・記録・方針」構成](../decision-log/2026-08-14-portfolio-record-display-policy.md)
