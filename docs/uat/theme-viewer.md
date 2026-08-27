# テーマViewer UAT

## 前提

- Premium仮ログインで `/premium` に入れる
- stock-notesのViewer APIに対して、設定済み環境と未設定環境を確認できる
- テスト用テーマに、`draft`、分析履歴、根拠、直接リンク、taxonomy、metrics、open actionsの有無を用意する

## 正常系

- [ ] Premiumホームに「テーマViewer」カードが表示される
- [ ] `/premium/themes` がログイン後に表示される
- [ ] 一覧にテーマ名、slug、status、概要、source、as-of、confidenceが表示される
- [ ] 一覧カードから `/premium/themes/[themeId]` へ遷移できる
- [ ] 詳細に概要・テーマ定義とsource/as-of/confidenceが表示される
- [ ] `draft` が「下書き」と明示される
- [ ] 現行thesisの版、構造仮説、risk、falsification condition、next checkが表示される
- [ ] analysis historyが基準日・出典付きで表示される
- [ ] evidenceがclaim、stance、検証状態、source、source-as-of、confidence付きで表示される
- [ ] direct linksが関係・status・出典付きで表示され、`http` / `https` のURLだけリンクとして開ける
- [ ] taxonomy mapでnodes、edges、theme links、stock linksの関係が確認できる
- [ ] metricsで定義、単位、snapshot、value、計算メモが確認できる
- [ ] metric valueが0の場合、欠損ではなく`0`と表示される
- [ ] open actionsが確認事項、条件、期限、関連分析／仮説付きで表示される
- [ ] 画面に保存・編集・更新・完了・削除の操作がなく、「読み取り専用」と表示される
- [ ] テーマの表示から売買判断（買う／売る／保有する）が確定されない

## 空・欠損・下書き

- [ ] 一覧の空配列が「テーマなし」と表示され、取得失敗と混同されない
- [ ] 詳細の明示的なnull／空配列が「データなし」と表示される
- [ ] 詳細で未提供のセクションが「未提供」と表示され、空データと区別される
- [ ] source、as-of、confidenceの未提供が「未提供」と表示される
- [ ] thesisがないテーマでも、テーマ概要と他の提供済みセクションは表示される

## 異常系

- [ ] `STOCK_NOTES_API_BASE_URL` または `STOCK_NOTES_API_TOKEN` 未設定時に設定不足画面が表示される
- [ ] APIの401時に認証エラー画面が表示される
- [ ] APIの5xx、接続失敗、timeout時に一時的な取得失敗画面が表示される
- [ ] 詳細の404時に指定テーマなし画面が表示される
- [ ] JSON、必須項目、schema versionが契約外のときにレスポンス不正画面が表示される
- [ ] Premium未認証で一覧／詳細へ直接アクセスすると、元URLを保ったままPremiumログインへ遷移する

## server-only確認

- [ ] ブラウザーのHTML、リンク、ページpropsに `STOCK_NOTES_API_TOKEN` の値が含まれない
- [ ] ブラウザーのNetworkログにstock-notes token付きリクエストが出ず、Viewer API呼び出しはサーバー側で完了する
- [ ] 開発者ツールで確認する場合も、実tokenをチケットやスクリーンショットへ残さない

## 関連

- 仕様: [テーマViewer仕様](../specs/tools/theme-viewer.md)
- Decision Log: [テーマViewerの読み取り契約と責任境界](../decision-log/2026-08-27-theme-viewer-read-model.md)
