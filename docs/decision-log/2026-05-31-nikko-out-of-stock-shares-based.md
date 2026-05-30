# 2026-05-31 日興一般「在庫0」判定を available_shares 基準に変更

## 背景

- 2026-05-30 に新設した `一般—`（売可だが在庫0）バッジは `general_short=true` かつ `available_shares===0` を条件にしていた。
- ジョイフル本田（3191）のライブデータ確認をきっかけに、`/nikko/credit`（基準日 2026-05-30、全 4,251 銘柄）の `general_short` × `available_shares` を集計した。

| general_short | available_shares | 銘柄数 |
|---|---|---|
| false | null | 2,267 |
| true | >0 | 1,299 |
| false | 0 | 678 |
| false | >0 | 7（すべて取引所規制中）|
| **true** | **0** | **0** |

- `true && 0` が 0 件で、旧条件の `一般—` はライブで 1 銘柄も発火しないことが判明した。
- 一方 `general_short ≈ (available_shares>0)` がほぼ成立し（例外は規制中の 7 件のみ）、在庫が尽きた銘柄は `general_short=false` に倒れて `false && 0`（678 件）側に寄っていた。

## 今回決めたこと

- 一般信用の「対象かどうか」は `general_short` ではなく **`available_shares` の有無**で判定する。
  - `available_shares` が数値（0 含む）= 一般信用売建の対象（在庫枠を管理している）
  - `available_shares=null` = 非対象（従来どおり表示しない）
- `isNikkoGeneralOutOfStock` の条件から `general_short` 依存を外し、`available_shares===0 && !hasSellStop` に変更する。
- これによりジョイフル本田を含む `general_short=false && available_shares=0` 銘柄が `一般—` として表示される。

## 判断理由

- `general_short` は在庫連動で `false` に倒れる「今売れるか」のフラグであり、「一般売建の対象か」を表していない。`true && 0` が 0 件であることがその裏付け。
- `available_shares` が明示的な `0`（`null` ではない）であれば、日興がその銘柄の在庫枠を管理している＝一般信用の対象であり、現在の残数が 0 と解釈できる。
- よって `general_short=false && available_shares=0` は「一般売建不可」ではなく「一般売建対象だが在庫0（＝今クロス不可）」と分類するのが実態に合う。

## 影響範囲

- `app/tools/yutai-candidates/ToolClient.tsx` の `isNikkoGeneralOutOfStock`
- ライブデータでのバッジ分布（2026-05-30 時点、シミュレーション値）

| 一般バッジ | 旧 | 新 |
|---|---|---|
| 一般可 | 1,287 | 1,287 |
| 一般注意 | 11 | 11 |
| 一般停止（取引停止） | 342 | 342 |
| 一般×（在庫0） | 0 | 618 |
| (一般なし) | 2,611 | 1,993 |

- `available_shares=null` 銘柄・既存の `一般可/一般注意/一般停止` は不変。
- あわせてラベルを変更した: 旧 `一般×`（取引停止）→ `一般停止`、旧 `一般—`（在庫0）→ `一般×`、旧 `一般規制`（貸株注意喚起）→ `一般注意`。
- `canNikkoGeneralCrossNow`（`一般可`）は今回変更しない。`general_short=false && available_shares>0` の 7 銘柄は規制中で、6 件は `一般停止`、1 件（ＫＬａｂ 3656）は貸株注意喚起のみのため `一般` バッジなしのまま（次の残課題）。

## 残課題

- `general_short=false && available_shares>0`（規制中で在庫数が残存）の扱い。とくに取引停止でない注意喚起のみの銘柄（例: 3656）を `一般注意` 等で出すか、`available_shares` のノイズとして無視するか未確定。
- upstream（market-info-api / 日興スクレイピング側）が `general_short` と `available_shares` をどう生成しているかの正式仕様確認。本決定はライブデータからの推定に基づく。

## 関連

- 参照 docs: [2026-05-30 日興信用バッジの短語化と「売可だが在庫0」追加](./2026-05-30-nikko-general-out-of-stock-badge.md)
- 参照 docs: [2026-05-14 日興信用 JSON contract](./2026-05-14-nikko-credit-json-contract.md)
- 参照 docs: [Market Tools データ取得経路一覧](../specs/cross-cutting/market-tools-data-fetch-paths.md)
