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
