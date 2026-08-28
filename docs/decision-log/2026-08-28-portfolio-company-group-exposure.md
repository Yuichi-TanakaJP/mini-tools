# ポートフォリオへ企業グループexposureを追加する

日付: 2026-08-28

## 背景

企業関係ネットワーク Phase 1〜4 で、company identity、企業間関係、企業グループ所属、1-hop/2-hop探索、企業関係マップを追加した。Phase 5では、この事実層を投資分析へ接続する。

ポートフォリオV2の正本では、active policy → exposure → gap の順序を維持し、個別銘柄情報を主入力へ戻さないことが重要である。企業グループは33業種・cycle・income・roleを置き換える分類ではなく、セクター横断の集中を補助的に見る独立軸として扱う。

## 決定

1. 最新readyのofficial snapshotを対象にする。
2. 同一instrumentの複数口座positionはmarket_valueを商品単位へ集約してから判定する。
3. portfolio instrumentのstock_idからcompany identityへ解決し、currentなcompany-stock linkだけを使う。
4. corporate group membershipはcurrentかつverifiedのみを既定の集計対象にする。
5. 現代の集中度には `corporate_group` / `capital_group` / `keiretsu` / `presidents_club` を使う。
6. `zaibatsu_lineage` / `historical_group` は歴史的系譜であり、現代の資本集中と同一視しないため集計から除外する。
7. company identity未解決、group membership未整備は「グループ所属なし」に変換せずcoverageとして表示する。
8. 同じグループへの所属は事実として表示するが、業績連動・受益・売買判断を自動推論しない。
9. 企業関係データ取得失敗はポートフォリオ本体の取得失敗と分離し、本体表示を継続する。
10. 一社が複数グループに正式所属する場合は各グループへ表示する。そのためグループ別金額の単純合計はポートフォリオ総額と一致しない場合がある。coverageはinstrumentを重複計上せず算出する。

## V1の表示

`/premium/portfolio` に「企業グループ集中（事実ベース）」カードを追加する。

表示するもの:
- group membershipまで解決できた評価額と公式保有全体に対するcoverage
- group membershipまで解決できた銘柄数
- company identityまで解決できた銘柄数
- group別の評価額・公式保有比率・構成銘柄
- membership basisとsource_as_of
- `/premium/company-network` への導線

## 現時点のデータ品質

実装開始時点の最新official snapshotは41商品・52position、評価額12,480,043円だった。stock_idは多くの国内株に存在する一方、company identity / verified group membershipのcoverageは低かった。

Phase 2で公式情報により作成済みだったトヨタ自動車entity・TSE 7203 listing・トヨタグループmembershipを、既存stock masterの7203へ `primary_listing` として接続した。これにより実保有のトヨタ自動車を、推測なしでトヨタグループexposureとして解決できる。

今後coverageを上げる場合も、企業名の似た文字列から自動でgroup membershipを推定せず、company identity linkと公式根拠を順次整備する。

## 非対象

- group concentrationから売買actionを自動生成すること
- 旧財閥系譜を現代group exposureへ自動合算すること
- 外部参照資産のgroup exposure統合
- theme → company → related company の二次探索（Phase 5B）
