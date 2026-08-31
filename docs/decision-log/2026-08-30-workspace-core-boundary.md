# Workspace Core のルート境界と ChatGPT-first 運用

Date: 2026-08-30  
Related: #551

## 結論

最後の Supabase Free 枠を開発専用 DB として固定しない。

Project は `workspace-core` という汎用名を採用し、V1 は `platform / registry / ops` のみを作成する。

また、人間が Notion や DB UI を日常的に巡回することを前提にせず、ChatGPT / AI Agent を主インターフェースとして設計する。

## 実装結果

2026-09-01時点で次を実装・監査済み。

- Supabase Project: `workspace-core`
- project ref: `vtqceobocbetkkatycxw`
- region: `ap-northeast-1`
- V1 schemas: `platform`, `registry`, `ops`
- 20 GitHub repositories
- 18 Products
- 26 Technologies
- 15 Service Providers
- evidence-backed Product / Repository / Technology / Provider / Product relations

V1 DB bootstrapは完了し、次工程はread model / Product Map利用層へ移る。

## 背景

当初は Product / Repository / Technology / Service を整理する `product-db` を想定していた。

しかし Supabase Free 枠が残り 1 Project であるため、将来別用途の構造化データを置きたくなった場合に `product-db` というルート概念が制約になる懸念がある。

同時に、Notion は過去の原文・知識を保持しているものの、実運用では人間が直接見に行く頻度が下がっている。今後は「以前こういう話をしていなかったか」と ChatGPT に問い、必要なときだけ元情報を参照する運用の方が現実に近い。

## 決めたこと

### 1. Project は用途固定名にしない

採用:

- `workspace-core`

避ける:

- `product-db`
- `dev-db`
- `mini-tools-meta`

### 2. schema で責務を分離する

V1:

- `platform`: Project 全体のメタ情報
- `registry`: Product / Repository / Technology / Service / Relation
- `ops`: Sync / Import state

将来 domain は需要が発生してから追加する。

### 3. ChatGPT-first

ChatGPT / AI Agent を、各 Source of Truth を横断する主 UI とみなす。

Workspace Core 自体は「人間が毎日表を編集する DB」を目標にしない。

### 4. Notion は廃止しないが主 UI とも決めない

Notion にしか存在しない原文・検証ログ・長文知識は参照価値がある。

ただし Workspace Core に全文複製することも、Notion を日常 UI として維持することも必須にしない。

必要に応じて `external_resources` に pointer / summary / relation を保持する。

### 5. Source of Truth を分散したまま管理可能にする

- GitHub: code / Issues / PRs
- Supabase: operational DB state
- Notion: originating long-form text when applicable
- Runtime provider: live deployment state
- Workspace Core: Product identity and cross-system relationships

### 6. Provider と concrete instance を分離する

Provider利用が証拠付きで判明していても、具体的なproject/deployment identityが分からない場合にfake instanceを作らない。

- `product_service_provider_links`: Provider利用
- `product_service_links`: concrete instance利用

また `monitors_service` はruntime dependencyとは別のrelationとして扱う。

## 理由

1. 最後の Free Project 枠を将来用途からロックしない。
2. 各システムの得意領域を残し、無理なデータ複製を避ける。
3. ChatGPT が問い合わせ時に必要な原文へ戻れるため、人間向け整理画面の維持コストを下げられる。
4. Product / Repository / Service の relation graph は構造化 DB に置く方が再利用・検索・自動化しやすい。
5. generic EAV にせず schema 単位で domain を増やすことで、汎用性と意味の明確さを両立できる。
6. evidence / provenanceを持つことで、AIの推測と確認済み事実を混同しにくくする。

## Security boundary

- V1 custom schemas は private
- `anon` / `authenticated` へ直接公開しない
- RLS enabled / client policyなし
- privileged server-side pathから利用
- secret / token / passwordはregistryへ保存しない

将来UIアクセスが必要なら、registry全体を公開するのではなく dedicated `api` schema またはserver routeを優先する。

## 検証結果

- live DBとrepository seedの最終件数を照合済み
- GitHub-derived technology/provider relationのevidence欠落0件
- Supabase security/performance advisorにERROR/WARNなし
- 006〜009 discovery seedをliveへ再実行し、全件成功・件数不変を確認
- feature branchを最新mainへ同期済み
- Vercel check成功をmerge gateに含める

Codex専用レビューは現在の接続環境から利用できないため、ユーザーの明示許可に基づきV1の必須merge gateから外した。

## 再検討条件

次の場合は boundary を再検討する。

- Workspace Core が Free plan 容量・Project制約に近づく
- 複数ユーザーによる直接クライアントアクセスが必要になる
- knowledge / automation 等が registry と強く競合し、独立 Project の方が安全になる
- ChatGPT / connector から必要な Source of Truth へ安定して到達できなくなる
- evidence-backed relation graphより別のデータモデルが主要用途になる
