# 2026-04-11 commonization PR handoff

## 現在地

- PR: `#221`
- branch: `feature-commonization-shared-foundation`
- preview: Vercel `Ready`
- Codex CLI review: 指摘解消後、最終結果は問題なし

## 今回完了したもの

- `#215` `ClientOnly` 共通化
- `#216` market tools の date route 共通化
- `#217` visibleDates / 初期日選定ロジック整理
- `#218` 日次取得 state の hook 化

## PR #221 の要点

- `components/createClientOnlyTool.tsx` を追加
- `app/tools/_shared/date-data-route.ts` を追加
- `app/tools/_shared/market-trading-dates.ts` を追加
- `app/tools/_shared/use-daily-market-data.ts` を追加
- `stock-ranking` / `topix33` / `nikkei-contribution` の route / page / client state を整理
- `nikkei-contribution` は review 指摘を受けて fallback 日読込中の loading 表示も補正済み

## 確認済み

- `npm run lint`
- ローカル HTTP 到達確認
  - `/tools/charcount`
  - `/tools/total`
  - `/tools/yutai-memo`
  - `/tools/yutai-expiry`
  - `/tools/stock-ranking`
  - `/tools/topix33`
  - `/tools/nikkei-contribution`
- internal route の `200 / 400`
- `codex --profile review-low review --base main`

## 次の担当がまず見るところ

1. PR `#221` のレビューコメント有無
2. Vercel preview の実 UI 確認
3. 問題なければ merge

## 後続タスク

- ~~`#219` `charcount` / `total` の page shell 共通化~~ → **完了**（`components/SimpleInputToolLayout.tsx` として実装済み）
- `#214` JSON 同梱データと fallback 方針整理
- `#220` dev 環境 UI スモークテストと artifact 収集

## メモ

- 今回の本線は shared helper 抽出なので、次は `#219` より先に `#221` のレビュー対応を優先するのが自然。
- `#220` は今すぐ必須ではないが、今後の refactor 継続にはかなり効く。
