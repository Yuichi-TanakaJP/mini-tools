# 企業関係マップを4ビューへ分離する

## 結論

`/premium/company-network` は単一の固定放射図ではなく、同じ企業関係データを **関係 / 放射 / 系列 / 表** の4表現で切り替える。

業界マップの「問いごとに表現を選ぶ」UI思想を踏襲するが、企業関係は分類木ではなくグラフが中心なのでビュー構成はそのままコピーしない。

## ビューと問い

| ビュー | 担当する問い |
|---|---|
| 関係（既定） | 企業・企業グループ全体がどうつながっているか |
| 放射 | 選択企業から1-hop / 2-hopに何があるか |
| 系列 | 出資・親会社・支配の上位 / 下位がどうつながるか |
| 表 | 関係種別・比率・verification・source_as_ofを正確に確認する |

## 既存資産の再利用

- 現行 `buildReachableNetwork()` は放射ビューでそのまま使う
- 業界マップのpan/zoom hookを企業関係SVGでも利用する
- force配置の考え方を企業関係専用型へ移植する
- 業界マップと同じ white card / sticky toolbar / workspace + detail panel の操作感へ寄せる

## 系列ビューの境界

系列ビューに入れる関係:
- `equity_ownership`
- `parent_of`
- `controls`
- `equity_method_investment`

入れないもの:
- corporate group / keiretsu等のgroup membership
- historical relation

同じ企業グループであることを親子・支配関係として描かない。

## 事実の向き

企業間edgeはDBに保存されたcanonical directionを維持する。UI都合で逆向きedgeを生成しない。

例: `Toyota Motor -> Woven by Toyota / equity_ownership 100%` は、放射・関係・系列・表のどのビューでも事実方向を変えない。

## 今回採らないもの

- 企業×企業マトリクス: 企業数が増えると疎行列になりやすいため保留
- 企業×グループマトリクス: membership coverageが増えた時点で再評価
- supplier / customer / joint research等: Phase 6 #497で関係種別を拡張してから表示設計を追加

## UI共通原則

- verified-onlyを既定にする
- proposedは破線などで区別する
- 企業グループ所属は別edgeとして表示する
- 取得失敗と0件を区別する
- 事実表示から業績連動・テーマ受益・売買判断を自動推論しない
