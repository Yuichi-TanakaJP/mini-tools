# テーマViewer UAT

## 前提

- Premium仮ログインで `/premium` に入れる
- stock-notesのViewer APIに対して、設定済み環境と未設定環境を確認できる
- テスト用テーマに、`draft`、分析履歴、根拠、直接リンク、taxonomy、metrics、open actionsの有無を用意する

## 一覧ページ化（2026-10-18）

確認環境はローカルまたはPreviewのMiniToolsと、軽量一覧APIが配備されたstock-notesを記録する。本人データを変更せず、多件数・長文の合成fixtureを使う。実施結果は手順書に記入せずPR本文へ記録する。

- [ ] 100件を超える一覧で、1ページ最大10件の表示と「このページ N件」を確認する
- [ ] 容量上限により10件未満で分割された場合も「続きを見る」で残りに到達する
- [ ] 全ページのIDを照合し、変更のない一覧で重複・欠落がない
- [ ] 最後のページでは続きリンクが消え、最初のページから読み直せる
- [ ] 続きのAPIが503/timeoutの場合、空一覧や完了扱いにならずエラーと読み直しリンクを表示する
- [ ] 不正cursor・多重cursor、上流400で読み直し案内を表示する
- [ ] schemaVersion、hasMore/nextCursor不整合、同じcursorの再返却は契約エラーになる
- [ ] 一覧・続き・詳細の先読みがなく、操作したページだけが取得される
- [ ] 閲覧中に新規テーマが追加された場合は最初から読み直す。ライブ一覧を固定snapshotと誤認しない
- [ ] 未認証では続きのURLでもstock-notes取得前にloginへ遷移する
- [ ] stock-notes互換追加→MiniToolsの順で配備し、旧v1一覧・詳細の利用者に影響がない

ローカル対象テスト: `npm test -- app/premium/themes`。build: `npm run build`。HTTP/合成fixture確認と本人ログイン済み本番の実画面確認は別の証拠として記録する。

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
- Decision Log: [一覧413とページ分割](../decision-log/2026-10-18-theme-viewer-pagination.md)
- Decision Log: [テーマViewerの読み取り契約と責任境界](../decision-log/2026-08-27-theme-viewer-read-model.md)


## 本文を全文で読む

確認環境: 長文API実装版stock-notesを接続したローカル/Preview。未配備の本番画面と区別する。実施結果はPR本文へ記録し、本人の本文・設定値はGitへ保存しない。

1. 一覧から対象テーマの詳細 `/premium/themes/[themeId]#full-text` を開く。
2. タイトル直下「本文を全文で読む」で、対象の分析履歴・記録本文を選択する。未取得では通信が発生しないことを確認する。
3. 「全文を読み始める」を押す。即時の取得中表示、先頭2,000文字、取得済み/全体文字数を確認する。
4. 「次の2,000文字を読む」を終端まで押す。結合した表示文字列がDB元本文と完全一致し、最後の文章まで表示され「全文表示済み」になることを確認する。Unicodeの絵文字・改行を含む6,001文字以上でも欠落/重複しないことを合成テストする。
5. 実データの検証は実在の文字数を記録する。6,000文字超の対象がなければその条件は未検証と記録し、合成データで代用した成功とはしない。
6. 続きの503/timeout/中断でも先頭が残り、同offsetの再試行で回復する。項目変更では未取得へ戻り、古い完了が混ざらないことを確認する。
7. 409では最初から読み直す。版不一致・offset不一致・誤ったrecord応答は完了扱いにならないことを確認する。
8. Cookieなしは中継401かつ上流呼出し0回。本文・tokenはPWA CacheStorageに残らない。旧APIでmetadataがなければ未対応を表示する。

対象unit: `npm test -- app/premium/themes app/api/premium/themes lib/__tests__/uncached-api-request.test.ts`。
対象UI: `npx playwright test --config=playwright.navigation.config.ts --grep "full text reads"`（合成API/認証のみ）。`NAVIGATION_TEST_OUTPUT_DIR` はtask別scratchへ設定する。


## 全文の整形・待機・失敗・モバイル・キーボード

- 原文に文字としての\n、Markdown見出し/箇条書き/強調/HTMLを含め、整形表示で段落と安全な見出し/リストを確認する。原文表示は取得した文字列と完全一致し、切替でHTTPが増えない。
- 2,000文字の境界で\とnや見出しが分かれても、追加後は蓄積した原文全体から正しく整形される。
- 読む項目の分析日時を元の分析履歴の日時と照合する。末尾の完了表示と残数、本文先頭へ戻る操作を確認する。
- 未取得→待機→成功、続き503→既読保持→同offsetretry→全文末尾、3秒長時間→12秒timeout→retry、中断→retry、409と文字数矛盾→読み直しを確認する。
- Tabで選択欄・整形/原文・取得へ移動し、Enterで取得/継続/再試行する。各状態でフォーカスが失われず、末尾取得後も画面位置が大きく飛ばない。先頭へ戻る操作は見出しにフォーカスが移る。
- 390×844のモバイルで横溢れ、選択欄、タップ領域44px以上、原文と整形表示を確認する。実機・スクリーンリーダーの実発声は別途未確認として記録する。

対象unit: `npm test -- app/premium/themes`。
対象UI: `npx playwright test --config=playwright.navigation.config.ts --grep "full text"`。画像・traceはtask別scratchを `NAVIGATION_TEST_OUTPUT_DIR` に指定する。異常系は合成/ローカルで行い、本番障害を故意に起こさない。実施結果はPR本文へ記録する。
