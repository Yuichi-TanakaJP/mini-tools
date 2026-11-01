# PWA依存更新の隔離UAT

目的: 本番データや利用者のブラウザー状態を使わず、lint/glob更新による資産欠落とSW登録/cache契約の回帰を検査する。

1. 対象branchと元baseを別々の同期対象外scratchへexportし、.env/.env.local/.env.production/.env.production.localを含めない。プロセスの環境はOS起動に必要な値だけにし、実認証/実DBの値を渡さない。
2. 両方それぞれのlockで通常npm ci/buildする。候補でscriptsを無効にした場合はnpm run prepare:dependenciesが必要。npm run test:dependencies（7）とtest:pwa-dependencies（1）、npm test、lint/buildを実行する。Workbox getManifestの期待4assetが0件にならずignoreが効くことを確認する。
3. baselineのpublic/sw.jsとworkbox-*.js、.next/staticを含む通常buildを保持し、PWA_BASELINE_DIRへその隔離ディレクトリを設定する。PLAYWRIGHT_BROWSERS_PATH/TMP/TEMPと--outputをtask scratchへ指定する。
4. npm run test:pwa -- --output=<scratch>/normal-results。生成workerの起動、start page offline、認証GETがcacheされず既存staleも使われないことを確認する。
5. npm run test:pwa-migration -- --output=<scratch>/migration-results。38220候補/38222元版/38221専用proxyを使用。通常App Router読込で旧新ともSW自動登録/controller/window.workboxが増えないことを確認する。
6. 同一タブで元版SWを明示登録→旧制御・online probe→合成stale cache seed→proxyを候補へ切替→registration.update。SHAとcontrollerchangeで新workerを照合し、意図的に欠けさせたprecache assetが補充されることを確認する。
7. 認証GETは新network responseを返し、別fresh requestがCacheStorageへ書かれないことを確認。proxyでTCPを遮断し、offline表示が維持される一方、認証GETは失敗しstaleを返さないことを確認する。ブラウザーoffline指定だけで通信遮断を証明しない。

本番URL・本番DB・実LINE送信・利用者profileを使用しない。proxyは127.0.0.1限定、GET/HEAD転送と専用制御endpointのみ。実施結果はPR本文に記録し、この手順へ完了チェックを書かない。
