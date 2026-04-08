# 優待銘柄メモ帳 UAT チェックリスト

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

### タグ機能

- [ ] ユーザー独自のタグを付けられる
- [ ] タグでフィルタできる
- [ ] タグの追加・削除が動作する

### 取得リスト（アコーディオン）

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
- [SSR / Hydration / localStorage 運用ガイド](../decision-log/2026-03-12-ssr-localstorage-hydration-guidelines.md)
