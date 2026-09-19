# 保有の正本をPortfolioへ統合し、旧マイ銘柄の通常導線を終了する

## 決定

- 対象はV2 Phase 6 / MiniTools UI-4の統合基盤。意思決定ワークスペース全体の完成とはしない。
- 保有明細はPortfolio、追跡対象・ウォッチ・分析は銘柄分析ダッシュボードへ集約する。ホームと開示通知は両者の国内銘柄の和集合を使う。
- 2026-09-18の利用者指示で、普段のブラウザーの未同期メモの確認・救済を撤去条件から外した。端末データは未確認であり、存在しないと認定したわけではない。
- 同期済み旧保有31件のメモは口座区分・数量・取得単価の形式で、自由記述の投資判断は確認されなかった。メモ機能の新設・移行、CSV再取込はしない。個別の資産情報は本書に保存しない。

## 取得と権限

Portfolio画面とaudience APIで同じTypeScript選択処理を使う。ユーザーセッションとRLSを維持し、service roleは使わない。保有部分は既存Premium認証も必要。ウォッチはSupabase認証のみで利用できる。

既存Portfolioと同じくdefault優先、updated_at・id降順で対象Portfolioを選ぶ。公式（互換上null scopeを含む）かつreadyに絞ってからas_of・imported_at・id降順で1件を選ぶ。manualも対象で、CSVに限定しない。直近20件の履歴にreadyがなくても過去の有効snapshotを取得する。基準日を表示し、現在時刻の保有と偽らない。

既存DB viewの並び順と画面側のimported_at順が異なるため、今回は画面とAPIの共通selectorに統一する。DDL・view変更はしない。V2の全producer/consumer共有契約を完成扱いしない。

国内株式のquantity > 0をコード単位で重複排除し、価格・金額は通知APIで返さない。参考資産・外国株等は個別通知に含めないが、Portfolioからは消さない。ページング中のsnapshot変更・参照欠損は未取得扱い。未登録、snapshotなし、権限不足、失敗、正常0件は別状態。

## UIと保存

- 分析画面の保有タブ・要対応の保有優先はPortfolio由来。旧category=holdingは表示互換のみ。実保有中のarchived銘柄も隠さない。
- 旧category=holdingで現在保有されていない銘柄は「新規調査」タブで閲覧・分類変更できる。売却後に分析履歴への入口を失わせない。DB分類の一括変更はしない。
- 未登録保有は件数を案内するだけで自動登録しない。登録・分類変更に保有の手動選択肢は設けない。
- audience APIはprivate/no-store。保有コードはダッシュボード永続キャッシュから除く。旧版キャッシュはversionで無効化する。認証イベント・画面focusで再確認する。
- `/tools/my-stocks` は移行先案内のみ。通常カタログ・下部ナビ・sitemapから外す。通常同期は旧キーを送受信しない。
- 旧LocalStorageとtool_dataのレコード、Portfolioと分析の元データは削除しない。専用救済UIは作らない。

## 検証とロールバック

Tier 3相当として関連単体テスト、全テスト、build、独立レビュー、UATを確認する。実施結果はPRに記録し、本人の認証済み実データ画面が未確認なら明示する。コードrevertで旧導線へ戻せる。データ移行・削除をしないためデータ復元作業は不要。

- [銘柄分析仕様](../specs/tools/stock-notes.md)
- [Portfolio仕様](../specs/tools/portfolio.md)
- [UAT](../uat/stock-notes.md)
