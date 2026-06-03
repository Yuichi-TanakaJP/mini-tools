# 2026-06-03 優待銘柄メモ帳の信用売り残オンデマンド取得

## 背景

- 優待銘柄メモ帳（`app/tools/yutai-memo`）で、その月にウォッチしている銘柄について「今クロス取引が可能か」を判断したい。
- 判断材料は日興証券（SMBC日興）の **信用売り残高（株数）**。残数が減っていればクロスしづらい、という用途。
- 銘柄コードはブラウザの localStorage（`MemoItem[]`）にしか無い。
- 現状の market-info は全銘柄を一括取得する作りで、ウォッチ銘柄だけ知りたい今回の用途には不要なデータ・サーバ負荷が発生する。
- 日興は手動パスキー認証であり、取得実行は market-info のある PC 上で行う前提。

## 今回決めたこと

### データ
- 取得項目は **信用売り残高（株数）のみ**。買い残・前週比・貸借倍率などは現時点では持たない。
- 目的は「残数を見て今クロス取引が可能か」を知ることに限定する。

### 取得フロー（完全非同期・「いつか反映」型）
1. **登録**: 優待銘柄メモ帳の「取得」ボタン → 対象月の銘柄コードを mini-tools の API route に POST → market-info に「このコードを取得対象に登録」して即返す（クライアントは待たない）。API route は既存の premium セッション認証でゲートする。
2. **取得**: market-info PC（手動パスキーでログイン済みセッション）が、登録されたコードだけ日興をスクレイピングし、公開 JSON `/nikko/short-balance`（`{ asOf, byCode }`）を更新する。自分のペース（キュー/定期実行）で良い。
3. **反映**: 次に優待銘柄メモ帳を開く／再読込したとき、data-loader が公開 JSON を読み、クライアントが自分のコードで filter してカード内に売り残＋取得日（asOf）を表示する。

### 想定する型（mini-tools 側）
```ts
type NikkoShortBalanceRecord = {
  sellBalance: number | null; // 信用売り残高（株数）
};
type NikkoShortBalanceData = {
  asOf: string | null;
  byCode: Record<string, NikkoShortBalanceRecord>;
};
```

## 判断理由

- **完全非同期にした理由**: ライブ取得は銘柄数×秒かかり、同期で待たせるとタイムアウト・UX 悪化を招く。利用者が「いつか反映されればよい」と許容したため、ジョブ状態を mini-tools 側で追わない静的 JSON 反映型が最小実装で済む。
- **静的 JSON 反映型を採った理由**: market-info は既に「事前生成した静的 JSON を配信」する作り。反映ステップ（3）が既存の `loadNikkoCreditData()`（`app/tools/yutai-candidates/data-loader.ts`）と同型でコピーするだけになる。ポーリングやジョブ ID 管理が不要。
- **採らなかった案**:
  - 同期＋件数上限案: 実装は単純だが、セッション切れ時のハードエラー UI とタイムアウト対策が必要になり、非同期許容なら不要。
  - 往復コピペ案（コード書き出し → PC スクリプト → 貼り付けインポート）: 手作業が増え、ボタン一発で完結する今回の要望に合わない。
- **セッション切れの扱い**: market-info 側で日興セッションが切れていればコードは「保留」のまま、再ログイン後に取得して次回反映。完全非同期のためハードエラー UI が不要になり、同期案より堅牢。
- **コードをサーバへ送る点**: マイ銘柄リスト（my-stocks）は意図的にコードをサーバへ送らない方針だが、本機能は「選んだ少数コードだけを取得対象に登録する」ことが目的そのものであり、全銘柄取得を避けるための departure として許容する。premium 認証ゲートで第三者の濫用を防ぐ。

## 影響範囲

- mini-tools（新規）:
  - `app/api/nikko/short-balance/route.ts` — POST codes・premium 認証で market-info に登録。先例: `app/api/yutai-expiry/scan/route.ts`
  - data-loader に `loadNikkoShortBalance()` ＋ 型 `NikkoShortBalanceData`。先例: `app/tools/yutai-candidates/data-loader.ts` の Nikko 系
  - `app/tools/yutai-memo/page.tsx` → `ClientOnly` → カードへ reference 配線＋「取得」ボタン。先例: `app/tools/my-stocks/page.tsx` の reference 配線
- market-info（別リポジトリ・新規）:
  - 銘柄コードの「取得対象登録」受け口
  - 登録コードのみ日興をスクレイピング
  - 公開 JSON `/nikko/short-balance` の配信
- 既存の全銘柄取得パイプラインには手を入れない。

## 残課題

- market-info 側の動的取得エンドポイント・スクレイパは本リポジトリ外で別途実装する。
- 取得結果のキャッシュ方針（当日分の再取得抑制など）は実装時に検討。
- セッション切れを利用者にどこまで可視化するか（保留中バッジ等）は未定。
- 将来、買い残・前週比などを足すかは需要次第。

## 関連

- Issue:
- PR:
- 参照 docs:
  - `docs/decision-log/2026-05-31-nikko-out-of-stock-shares-based.md`（日興・株数ベースの既存判断）
  - `docs/decision-log/2026-05-31-my-stocks-public-watchlist.md`（コードをサーバへ送らない方針との対比）
