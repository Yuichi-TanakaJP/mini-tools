# Workspace Control Center read proxy UAT

## 対象・前提

Tier 2。対象は `GET /api/premium/workspace-core?mode=control-center` と、これを利用する Workspace Core のホーム画面。仕様は [read proxy operations](../workspace-core-read-proxy-ops.md)、実装は `lib/workspace-core/control-center-read-pages.ts` / `control-center.ts` / `data.ts` を参照する。既存の overview / product / provider も回帰確認する。

これは恒久的な手順書であり、実施済みの証明ではない。実施結果は PR 本文へ、対象 commit SHA、環境、deployment ID、実施日時、確認項目、実際の結果、残る制約を記載する。未実施は未実施とする。

| 環境 | 確認先・条件 |
|---|---|
| Local | `http://localhost:3000`。失敗・大量データは fixture/mock を使う。 |
| Mini Tools Preview | PR #693 の Vercel コメントにある URL。対象 SHA と deployment の一致を確認する。 |
| Mini Tools Production | `https://mini-tools-rho.vercel.app`。固定 projection の適用・権限確認済み環境で読み取りのみ行う。 |
| Workspace Core | 対象 UI PR の Preview、続いて production の認証済みホームと既存 `/dev` / `/product-map` / `/product-map/dashboard`。 |

秘密値はチャット・PR・ログ・スクリーンショットへ貼らない。Bearer テストは認可済みの server-side 環境で実施し、token を URL や browser code に入れない。既存 Premium cookie での確認はログイン済みブラウザーを利用する。Production の設定・権限・データを壊して異常系を作らない。

## 1. 認証と入力

以下は DB 接続設定が有効な環境で確認する。認証方式は Bearer **または** Premium cookie であり、AND 条件ではない。

| 操作・入力 | 期待結果 |
|---|---|
| cookie も Authorization も付けず GET | HTTP 401、`status=unauthenticated`、`data=null`。 |
| 不正な Bearer のみで GET | HTTP 401。DB の内容を返さない。 |
| 有効な server-side Bearer のみで GET | HTTP 200、`status=ok`、固定 Control Center response。 |
| 有効な Premium cookie のみで GET | HTTP 200、同じ固定 response。 |
| 不正な Bearer と有効な Premium cookie で GET | Premium 認証で許可される。これを Bearer bypass の新規挙動と誤認しない。 |
| 認証済みで `mode=unsupported` | HTTP 400、`data=null`。 |
| 認証済みで `mode=control-center&slug=mini-tools` | HTTP 400。overview でも non-empty slug は HTTP 400。 |
| product / provider に不正な slug を指定 | HTTP 400。既存の slug validation を維持する。 |
| `mode=control-center&table=auth.users&schema=auth&sql=select` | 余分なパラメーターは無視される。任意の table/schema/SQL が実行されず、固定 response の範囲を超えない。全て 400 になるとは要求しない。 |

各 response は `Cache-Control: private, no-store`。この API には共通 UAT index の 300 秒 cache の記載を適用しない。

## 2. 正常応答・完全性・出力境界

認証済み GET の応答について、`generatedAt`、`work`、`operations`、`evolution`、`architecture` が存在することを確認する。

- Work: active/blocked/paused の集計は固定 projection の全対象行から計算する。items は最大 12 件。blocked が優先される。検査時点の read-only 集計と照合する。
- Operations: total と各 status count の合計が一致する。全 Current State を取得してから件数・鮮度・source coverage・severity 順を計算し、attention は最大 20 件にする。recentEvents は最大 12 件。
- Evolution: confirmed projection の全対象行を取得してから意味上の日付で並べ、最大 8 件にする。GitHub activity や Workstream Update を混ぜない。
- Architecture: registry 全体の Product / Repository / Service count と照合する。19 / 21 / 3 は過去の検証値であって恒久的な期待値ではない。
- raw Observability `message`、DB credential、proxy token が応答へ含まれない。レスポンス全体の公開保存をせず、確認結果と必要最小限の集計だけを記録する。

## 3. 大量データ・取得異常（Local fixture）

```sh
npm test -- lib/workspace-core/__tests__/control-center-pagination.test.ts lib/workspace-core/__tests__/control-center.test.ts
npm run build
```

既存依存でテストする。追加依存や Production への 1001 行投入は不要。

各 fixed loader について、1001 行を最後まで取得し、全ページに固有キーによる明示的な順序があることを確認する。空、1 行、ちょうど 1000 行、server cap が 250 行のケースも確認する。Workstream は固定 status filter、Current State は固定選択列を維持する。

exact count 不在、ページ間 count 変化、完了前の空ページ、ページ取得失敗、count と返却サイズの矛盾では、部分結果を成功として返さず失敗する。ページごとの HTTP 読み取りは DB の同一トランザクション snapshot ではなく、同数の入替・更新を全て検出する保証はない。

## 4. エラー・設定不足（隔離環境のみ）

有効な認証を保ったまま Local で接続設定を未設定にすると HTTP 503、`status=unconfigured`、`data=null` になることを確認する。秘密値を含まない設定名の案内だけを返す。

Local mock で projection 読み取り失敗またはページ途中失敗を再現し、API は HTTP 500、`data=null`、一般化されたエラーメッセージとなることを確認する。成功・正常ゼロ件と誤表示しない。Workspace Core UI は remote read unavailable とし、保存済み Development や既存画面への導線を維持する。Production で view を削除したり権限を外したりしない。

## 5. Workspace Core 利用画面

認証済みのデスクトップおよび狭いスマートフォン幅で、Work / Operations / Development / Evolution / Architecture を確認する。UI の表示 cap は API cap より小さくてもよい。

mirror が古いケースと、一部 source のみ古いケースでは、現在の障害件数として見せず stale / historical / Last Mirrored Health と表示する。`observed_at` と `mirrored_at` を区別し、source ごとの watermark を確認する。古い observed fact の再配送だけを最新の検査実施と説明しない。

Development は 2026-09-27 の保存済み Chronicle snapshot と出典を表示し、live GitHub 値と説明しない。ログアウト後は保護画面に入れない。workspace-core runtime に新しい Supabase secret / service-role を追加せず、ブラウザーへ proxy token を渡さない。

既存 overview、既知 Product slug、既知 Provider slug の取得が従来どおり動作し、Product Map / Dashboard / Development の導線が壊れていないことを確認する。

## 6. リリース・復旧

順序は、固定 DB projection の既存適用・権限証跡確認 → Mini Tools の変更後 SHA の CI/独立レビュー/Preview UAT → #693 merge と Production READY → Workspace Core UI のレビュー・デプロイ → 認証済み Production UAT とする。

ビルド成功・文書追加・管理接続の成功を認証済み Production UAT の代用にしない。workspace-core Issue #13 はその release acceptance を満たすまで open のままとする。

失敗時は直前の承認済みアプリ deployment へ戻す。既存 DB projection はそのまま残し、DB を drop しない。独立した旧 Product Map / Dashboard を残す。本手順自体は deployment 操作や DB 変更を実行しない。

PR 本文の実施記録には、確認者 / 日時 / commit SHA / 環境・deployment / 認証方式（秘密値なし）/ 確認ケース / pass・fail・未実施 / 残る blocking gate を記載する。


## Preview UAT rebuild marker — 2026-10-06

Branch-scoped Preview runtime settings were provisioned for Control Center V1 UAT. This marker intentionally triggers a fresh Preview build so Vercel captures the new environment scope. It is not itself evidence that UAT passed; actual results must still be recorded separately.


## 7. Control Center Summary V2 / Slice 1A

対象は固定 provider selector `GET /api/premium/workspace-core?mode=control-center-v2`。これは **GET-only / fixed-contract の read-only public endpoint** とし、Bearer token / Premium cookie を要求しない。Claude Code / Codex 等のクラウド開発環境から秘密値を共有せず参照できることを目的とする。V1 `mode=control-center` を置き換えず、Slice 1A の additive provider acceptance にだけ使用する。Workspace Core UI consumer の V2 切替は Slice 1B の別Gateであり、このUATでは行わない。

### 7.1 実施前Gate

- Workspace Core側の4つのV2 read modelが、レビュー済みmigrationとして対象Preview DBへ適用済みであること。
- 対象 mini-tools commit SHA と Vercel Preview deployment ID が一致すること。
- Previewのserver-side Supabase設定が対象branchで有効であること。V2 read-only endpoint自体はread-proxy token / Premium cookieを要求しないこと。
- V1 `mode=control-center` は残したままにする。
- Production DBのview削除・grant剥奪・障害注入で異常系を作らない。

### 7.2 認証・入力・error envelope

| 操作・入力 | 期待結果 |
|---|---|
| cookie/Authorizationなしで `mode=control-center-v2` | HTTP 200。contract=`workspace-core.control-center-summary`、version=`2.0`、status=`ok` または `degraded`。 |
| Bearer/Premium cookieを付けて同じV2 GET | HTTP 200。認証情報の有無でread contractの意味は変わらない。 |
| `mode=control-center-v2&slug=mini-tools` | HTTP 400、status=`error`、error.code=`INVALID_REQUEST`。 |
| provider環境設定なし（Local隔離環境） | HTTP 503、status=`unconfigured`、error.code=`PROVIDER_UNCONFIGURED`。 |
| 4つのV2 fixed readがすべて失敗するmock | HTTP 500、status=`error`、error.code=`PROVIDER_FAILURE`。raw DB errorを返さない。 |
| 4 sectionのうち1つだけread失敗するmock | HTTP 200、top-level status=`degraded`。失敗sectionのみstate=`unavailable`、issueCodesに`SOURCE_UNAVAILABLE`。他sectionを0件に偽装しない。 |

すべての認識済みV2 error responseには contract / version / generatedAt / data=null / error.code / **required nullable** error.message が存在する。raw database/upstream/log payload、credential、tokenを含めない。

### 7.3 正常responseの契約

Preview responseを**認証情報なし**で取得し、以下を確認する。

- contract = `workspace-core.control-center-summary`
- version = `2.0`
- generatedAt は有効なISO timestamp
- data.work / operations / evolution / architecture の4 sectionが常に存在
- section state は available / degraded / unavailable のいずれか
- empty success と unavailable を区別する

Work:
- counts.active + blocked + paused = workstreams.meta.eligibleTotal
- workstreams.meta.completeness = `ranked_top_n`
- limit=12、returned=min(eligibleTotal,12)
- nextActions / blockers は items / total / returned / limit=5 / truncated を持つ
- itemsはauthoritative stored orderの先頭 min(total,5)

Operations:
- ok + warning + critical + unknown + other = total
- attention limit=20、recentEvents limit=12、sourceCoverage limit=64
- eligible populationを完全評価できた正常系では3 collectionとも completeness=`ranked_top_n`
- observation / delivery freshnessを別フィールドで返す
- Slice 1Aの非空 sourceCoverage では delivery.basis=`row_timestamp_proxy`
- `TRANSITIONAL_DELIVERY_PROXY` はこの一時basisの明示であり、それだけでsectionをdegraded扱いにしない
- asOf はtop64ではなく完全なsource populationのoldest valid watermarkから導出する
- raw Observability messageはresponseに存在しない

Evolution:
- confirmed eventのみ
- limit=8、completeness=`ranked_top_n`
- periodEnd -> periodStart -> updatedAt、eventId tie-breakerの意味順を維持

Architecture:
- products / repositories / services は非負整数
- 取得不能時に synthetic 0 にしない

### 7.4 自動テスト

```sh
npm test -- lib/workspace-core/__tests__/control-center-v2.test.ts lib/workspace-core/__tests__/control-center-v2-loader.test.ts
npm run lint
npm run build
```

確認対象:
- exact success/error envelope
- empty Operations source set
- isolated section failure -> degraded
- all four fixed reads failure -> top-level provider failure
- malformed ordered prefix -> integrity unavailable
- future watermark -> ageHours=null
- V1 control-center testsが引き続き成功

### 7.5 V1 / V2 parity evidence

同じ証拠windowで V1 と V2 をserver-side readし、最低限次を照合する。

- Work active/blocked/paused counts
- Operations status counts / total
- non-ok attentionの意味集合（V2のbounded orderを考慮）
- source count
- confirmed Evolution eligible countとtop event identities
- Architecture counts

V2はwire shapeが異なるためJSON全体のbyte equalityは要求しない。意味上の差分があれば、仕様上意図した差なのかblockerなのかをPR本文へ記録する。

### 7.6 Preview acceptance記録

PR本文へ以下を記載する。UAT文書自体に実施済みcheckは付けない。

- commit SHA
- Preview deployment ID / URL
- 実施日時
- public read-only確認（Bearer / cookieなし）
- V2匿名200 / V2不正input 400 / V1匿名401
- isolated degraded case（mock可）
- complete provider failure 500（mock可）
- bounded/completeness/freshness確認
- V1/V2 parity evidence
- 残る未実施項目

Slice 1A Preview UATがpassしても Workspace Core UIをV2へ切り替えない。Slice 1B implementation GOがIssue #13に明示されるまで、V1がproduction consumer/rollback contractである。


### 7.7 Public read-only boundary

この公開化は `mode=control-center-v2` の **GET固定read contractだけ** に限定する。

必須回帰:

- 匿名 `mode=control-center-v2` -> HTTP 200
- 匿名 `mode=control-center` -> HTTP 401
- 匿名 `mode=overview` -> HTTP 401
- 匿名 `mode=product&slug=...` -> HTTP 401
- 匿名 `mode=provider&slug=...` -> HTTP 401
- V2でslug指定 -> HTTP 400
- V2 responseにcredential / proxy token / raw Observability messageを含めない
- DBへ任意table/schema/SQLを指定できるinterfaceを追加しない
- write method / write routeは公開しない

クラウド開発agentへ渡すのはURLだけでよく、Vercel secret・Premium password・Bearer tokenをagent promptへ貼らない。
