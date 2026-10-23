# 市場データの自動更新UAT

ローカル/Previewで3市場画面を確認する。本番で故障注入しない。

1. 同じ保存日のsnapshotをA→Bへfixtureで切り替える。60秒経過かタブ復帰で、再読み込みせず本文と取得時刻がBになる。
2. 更新を503にする。Aの内容・相場日を保持し、確認失敗と自動再試行の説明が出る。復旧後の次回確認でBになる。
3. 更新要求を遅延させて日付を変える。旧応答が選択日に混入しない。高速切替・過去日に戻る・同日retryも確認する。
4. タブ非表示中は定期要求を送らず、復帰時1要求。連続イベントで重複しない。
5. モバイル幅とキーボードで日付・市場・種別を変更し、更新で選択とフォーカスが失われない。
6. production buildの直URLを、公開更新の前後に1度ずつ開き、初回表示で更新が届く。日次routeはno-store、Service Workerの対象はNetworkOnly。

実行: `npx vitest run app/tools/stock-ranking app/tools/topix33 app/tools/nikkei-contribution` と `npx playwright test --config=playwright.market-freshness.config.ts`。実行結果はPRに記載する。
