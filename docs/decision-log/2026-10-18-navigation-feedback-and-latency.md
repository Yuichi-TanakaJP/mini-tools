# 全ページの画面遷移と待機予算

決定日: 2026-10-18。ユーザーから、From/To・通信量・遷移時間を整理して対応を決めるよう依頼された。

## 決めたこと

全内部遷移の受付100ms、150msを超える待機表示、3秒時の遅延案内を共通契約にする。ページ移動、query、Client API、local表示切替は分け、spinnerを一律に足す方式にしない。本文や個人データを増やさず、最後の正常表示と再試行/戻り条件を保持する。

Viewerは上流全体8秒、MiniTools上流待ち10秒、回復可能状態12秒以内を採用する。timeoutと接続エラーを分け、初回は同条件の手動再試行だけを実装する。他APIを一律延長せず、各operationの予算を確認する。

順序は(1)Viewerの現在の失敗と操作反応、(2)共通ナビ/全route入口、(3)query・Client取得・form/aの統一、(4)計測で予算を超える箇所の速度/量改善とする。実装・配備はこの文書変更には含めない。

## 背景と理由

Viewerの413を一覧分割で解消した後、同じ続きURLのAPIがcold start込み5.355秒で200となり、既存5秒timeoutを超える事例を確認した。画像の接続失敗との時間的整合は強いが、Frontendの例外と同一requestを直接紐付けた証拠までは取得していない。同じinstanceのstartupに約3.52秒かかっている。一方、成功時の0.28〜1.40秒だけではcold startと安定性を認定できなかった。

共通ナビにはpendingがなく、loadingは39route中12、router pending hookは5ツールに限定される。既存の2026-04/05判断を全routeへ適用し、同path queryやClientOnlyのJS待機を漏らさない。

## 通信量と時間の扱い

browserのHTML/RSC/asset/JSONと、Server→API、API→DBを分離する。build由来のgzip見積り、実APIのrequest log、将来の受入予算を明示的に区別する。全39routeの実時間が未測定でも、想像の秒数を実測として埋めない。

各routeに量/時間Profileを定義する。予算超過時はcompact/分割/必要時取得で対処し、件数を黙って落とさない。冷間起動を避けるためだけの有料min instance設定変更、DB migration、認証変更、本人応答の共有cacheは初回に含めない。

## 互換性と戻し方

push/replaceの履歴、login後のCookie反映用全画面遷移、修飾クリック/新タブ/外部リンクを維持する。Providerは表示状態だけを扱い、アプリ全体をClient化しない。将来の実装は共通部品と適用先を段階PRにし、不具合時は各段階を戻せるようにする。データ書換えや復元は不要。

## 関連

- [From/To・通信量・時間の正本](../specs/cross-cutting/navigation-transitions.md)
- [受入手順](../uat/navigation-transitions.md)
- [既存pending判断](2026-05-30-router-transition-pending-feedback.md)
