# TDNET全開示の保有銘柄フィルター V1｜アーキテクチャ採用記録

日付：2026-10-13 JST。関連：Stock Notes #443（全体親）、#442（全開示分析）、mini-tools PR #305（既存全開示一覧）、#665（Portfolio保有の正本統合）、#676（Hot Router Review）。

## 利用者に届けること

Portfolioに登録されている**実保有銘柄**だけに絞って、公式TDNET全開示の発表日時・企業・タイトル・公式資料URLを確認する。未分類Router Eventも落とさない。最初は保有銘柄のみで試し、監視銘柄や自動通知は次段階。TDNET市場全体の分析とSource収集は対象を縮小しない。配当正式Factの更新も Stock Notes #430/#435/PR#438 の別Ownerで継続。

## 最終決定：既存mini-tools側でフィルタリング

```text
Market Info Producer (#601/#602/#603)        Stock Notes Portfolio (既存Supabase)
  TDNET全市場開示を日次R2 publish                最新ready snapshot / 実保有銘柄
              │                                       │
              ▼                                       ▼
既存 market-info-api                   既存mini-tools authenticated audience API
  GET /tdnet/disclosures/latest         GET /api/stock-notes/audience
  GET /tdnet/disclosures/{date}          premium cookie + Supabase user/RLS
              │                                       │
              └────────────────┬──────────────────────┘
                               ▼
                   mini-tools既存ツール
                   /tools/tdnet-disclosures
                   「保有銘柄だけ」フィルター（追加）
                      4文字JPX code ↔ 5文字TDNET末尾0
                               │
                               ▼
                  既存TDNET全開示一覧の表示
                  原文タイトル・公式PDF/XBRL/HTML
```

**既存部品がすべてある**：
- `app/tools/tdnet-disclosures/data-loader.ts`：full disclosure sourceのlatest・日付・7日/30日を取得する既存サーバー処理。今回複製・変更しない。
- `app/tools/tdnet-disclosures/ToolClient.tsx`：既存の一覧表示、日付/範囲/カテゴリ/検索フィルタ。
- `lib/portfolio/useAudience.ts`：本人認証済みの保有・ウォッチ情報をread-onlyで取得し、失敗と本当に保有0件を区別する既存hook。
- `app/api/stock-notes/audience/route.ts` と `lib/portfolio/holdings.ts`：premium+Supabase Auth/RLS、ready Portfolio snapshot、保有コードの正規化・定期更新時の読み直し。Private/no-store。
- `app/tools/disclosure-radar/logic.ts`：既存 `normalizeSecurityCode` で末尾0を**一つだけ除去**（証券コード自体が0で終わるときの事故を回避）。

追加は `app/tools/tdnet-disclosures/holdings-filter.ts` の**純粋フィルター**、一覧UIへのトグル、Portfolio画面の既存ツールへのリンク、合成データのVitestだけ。新規認証情報もStock Notes APIエンドポイントも新設不要。保有銘柄データはプライベート/no-storeの既存endpointで読み、公開Market Info JSONは既存サーバーデータローダーから受け取る。公開API応答やCacheに個人の保有リストを混入させない。

Stock Notesへ同種の新しいread-only REST APIを加える別Draft PR #450を先行作成したが、実UI・RLS・Market Info fetch既存資産を再監査すると**不要な追加経路/広いBearer権限の扱い増加**になる。デプロイもマージもせず、mini-toolsの本実装がDraftになった時点で #450 は終了・履歴保持する。既存Hot Review PR #274も変更しない。

## 初回実証／使いながら拡大

2026-10-08/09の全496Source書類をStock Notes Productionの2026-09-21の国内保有37コードとID/証券コードで事前照合し、**保有2銘柄・開示4書類、うち2書類はRouterラベル無し**。この実数は今回の画面UATの基準だが、現行の保有SnapshotやSource公開日が更新された場合は必ずその**基準日と対象日**を表示し、最新でも4件と固定しない。

受入：
1. 本人がPremium + Supabase Authを済ませ、Portfolioページの「保有銘柄のTDNET開示」から既存全開示画面へ入る。
2. 画面は `holdings=1&range=7`、現行の保有ready snapshotの銘柄だけに絞る。**ウォッチのみの銘柄は混ぜない**。
3. 未分類/訂正/決算補足も原文の書類として表示し、Routerイベントの存在を条件にしない。
4. 保有情報が取得できない場合に**「0件」と嘘をつかず**ログイン・失敗・同期不足を知らせる。
5. 「全銘柄」に切り替えて、同じSource全市場データを従来通り閲覧できる。
6. 日付/範囲変更しても保有フィルターを維持する。動作・スマートフォン・本番では認証済みの人による実画面検証が別途必要。

Router A Consumer #441 PR#446、Dividend #435 PR#438、Market Info Producer、Canonical更新、Supabase Schema、Cloud Job/Scheduler、Workspace Core Service Registryは不変。Claude等の有料モデル呼出しなし。**現状はDraft PR段階でありProduction稼働を意味しない。**
