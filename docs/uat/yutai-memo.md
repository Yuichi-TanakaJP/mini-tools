# 優待銘柄メモ帳 UAT チェックリスト

## DB基本編集の隔離検証

現在仕様: [メモ帳のDB検証範囲](../specs/tools/yutai-memo.md)。
`npx playwright test --config=playwright.yutai.config.ts` は本番DBに接続せず、
合成データとmock認証/RPCでカレンダー→メモ帳の編集を確認する。
通常の本番フラグを変更しない。下記以外の従来手順はフラグ未設定時に適用する。

- [ ] DBのメモを表示し、本文だけ保存するとprofileのmemoだけが更新される
- [ ] 9月の株数と優待価値を200株/6000.5円へ変更すると、同月の2項目だけ送信・再表示される
- [ ] 空欄を0へ変換せず、株数/価値の0以下・仕込み開始12以上を拒否する
- [ ] 旧items/tags/archives/migration markerを変えず、月替わり処理も旧データへ書き込まない
- [ ] 非表示にしてもprofile/月/cycle/rewardを削除せず、再表示できる
- [ ] 編集開始後のDB更新では古いrevisionのまま競合し、自動上書きしない
- [ ] 保存結果不明や読戻し失敗で通常編集を止め、再確認ボタンを操作できる
- [ ] 未ログインでは追加/編集ボタンも旧LocalStorageの本人データも表示されない
- [ ] 非表示を含む全年度cycleは省略せず保持。タグ/履歴は表示のみと案内する

単体試験: `npm test -- lib/yutai`。実DB書込みと実スマホUATは別途工程5で確認する。

## 確認画面・URL

| 環境 | URL |
|---|---|
| 本番 | `https://mini-tools-rho.vercel.app/tools/yutai-memo` |
| Preview | Vercel PR コメントの URL + `/tools/yutai-memo` |
| ローカル | `http://localhost:3000/tools/yutai-memo` |

## データ取得の仕組み（確認の前提知識）

- **完全 Client-side のツール**。データは端末の LocalStorage のみに保存される
- サーバー・API との通信なし
- SSR では空（LocalStorage 非参照）、クライアント hydration 後にデータが表示される

## 正常系チェックポイント

### 初回利用（データなし）

- [ ] ページが正常表示される
- [ ] 空状態（銘柄なし）が表示される

### 銘柄の追加・編集

- [ ] 銘柄を追加できる（コード・銘柄名・優待内容・権利月・長期条件・失敗ログ・関連リンク）
- [ ] 追加後に一覧に表示される
- [ ] 編集できる・削除できる
- [ ] 仕込み開始を「権利月のNか月前」で設定できる
- [ ] 「今月の仕込み」表示で、仕込み月が表示月と一致する銘柄だけ表示される
- [ ] スマホ幅で「今月の仕込み／権利月から探す」が検索・月・タグ欄を押し広げない
- [ ] 2月権利・3か月前など、年またぎの仕込み月が11月として判定される

### タグ機能

- [ ] ユーザー独自のタグを付けられる
- [ ] タグでフィルタできる
- [ ] タグの追加・削除が動作する

### 取得リスト（アコーディオン）

- [ ] 一覧で「取得済み」にすると次回の対象権利年月が表示され、通常は追加操作なしで使える
- [ ] 表示された対象年月の「変更」から、必要な場合だけ前後の権利年月へ訂正できる
- [ ] 取得済み銘柄の月別アコーディオンが表示される
- [ ] アコーディオンを開くと対象銘柄の一覧が表示される
- [ ] 年月の切り替えが動作する

### データ永続性

- [ ] ページをリロードしても登録内容が保持される（LocalStorage に保存されている）
- [ ] 別タブで同じページを開いても同じデータが表示される

## 異常系チェックポイント

| シナリオ | 期待する挙動 |
|---|---|
| LocalStorage が無効（シークレットモードなど） | エラーメッセージ、または空状態で表示（ページクラッシュなし） |
| SSR 時（JS 未実行） | 空状態が表示（hydration 後にデータが反映） |
| hydration 不一致（SSR と CSR で差分） | ちらつきなく表示が切り替わる（ClientOnly ラッパーで制御） |

## 環境ごとの注意点

| 環境 | 注意点 |
|---|---|
| 本番 | LocalStorage はブラウザ・デバイスに依存。ユーザーのデータは端末ごとに独立 |
| Preview | 本番と同等 |
| ローカル | ブラウザの DevTools → Application → Local Storage でデータを直接確認できる |

## 関連 docs

- [yutai-memo タグ対応と hydration 問題](../decision-log/2026-01-17-yutai-memo-user-tags-and-hydration.md)
- [yutai-memo 取得リスト年月アコーディオン設計](../decision-log/2026-03-13-yutai-memo-acquired-list-accordion-design.md)
- [yutai-memo と優待カレンダー連携フィールド整理](../decision-log/2026-05-04-yutai-memo-calendar-import-field-policy.md)
- [SSR / Hydration / localStorage 運用ガイド](../decision-log/2026-03-12-ssr-localstorage-hydration-guidelines.md)
