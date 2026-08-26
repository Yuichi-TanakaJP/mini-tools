# テーマViewerの読み取り契約と責任境界

## 結論

MiniToolsの`/premium/themes`は、ChatGPT + Supabaseで整備されたテーマをstock-notesの専用Viewer APIから読み取り、閲覧だけを担当する。API tokenはサーバー側に閉じ、UIへ渡す型は`theme-viewer.v1`のcamelCase read modelに固定する。

## 背景

テーマはChatGPTとの対話で仮説、根拠、分析履歴、taxonomy、metrics、open actionsを更新する前提である。MiniToolsへ編集機能やSupabase書き込みを持ち込むと、編集チャネルと閲覧チャネルの責任が混ざり、draftや未確定の情報を売買判断へ誤って昇格させるおそれがある。

## 決めたこと

- MiniToolsはstock-notesのDBを直接参照せず、`GET /viewer/themes` と `GET /viewer/themes/{theme_id}`だけを呼ぶ
- `STOCK_NOTES_API_BASE_URL` と `STOCK_NOTES_API_TOKEN`はServer Componentのloaderだけで使用する
- UI境界は明示的な`theme-viewer.v1` camelCase read modelとし、snake_case互換は移行用parserに閉じ込める
- 詳細は概要、現行thesis、分析履歴、evidence、direct links、taxonomy map、metrics、open actionsを同一payloadで受け取る
- source、as-of、confidence、draft、missing、emptyを表示上の状態として保持する
- テーマから買う／売る／保有する結論を生成せず、open actionも読み取り専用で表示する
- 未設定、401、404、5xx、契約不正、空データを別状態として扱う

## 理由

- 編集経路をChatGPT + Supabaseに集約すると、相談・確認・保存の正本が一つになる
- stock-notesの専用read modelを境界にすると、MiniToolsがDBスキーマや編集APIの変更に引きずられにくい
- 詳細を集約すると、画面が複数endpointの部分成功を勝手に解釈せず、テーマ単位の基準日と状態を一貫して表示できる
- missingとemptyを分けると、「未提供」と「確認したがデータなし」を区別できる
- 0をnull／欠損と混同しないことで、metricsの表示を監査しやすくできる

## 影響と残課題

現時点のstock-notesには既存テーマAPIはあるが、`/viewer/*`のversioned aggregate contractはまだ確定していない。MiniTools側はUI、型、parser、状態表示を先に実装した。stock-notes側では、envelope、camelCase必須フィールド、詳細aggregate、provenance、direct link URL、taxonomy／metrics、401/404/5xxとemptyの意味を契約化する必要がある。

この差分はUIの空実装で隠さず、設定未完了・契約不一致として表示する。Viewer APIが整うまでは、本番のテーマ一覧が空または未設定になり得るが、サンプルデータや推測値へのfallbackは行わない。

## 関連

- 仕様: [テーマViewer仕様](../specs/tools/theme-viewer.md)
- UAT: [テーマViewer UAT](../uat/theme-viewer.md)
- 実装計画: [ポートフォリオ意思決定ワークスペース計画](../plans/portfolio-decision-workspace-plan.md)
