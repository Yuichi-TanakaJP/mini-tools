# Company Network Phase 7G

## Goal
実画面UATで判明した「関係」と「系列」の情報密度不足を解消する。

## Relation view
- グループモードでは企業間relationに参加する企業だけをグラフ本体に表示する。
- relation未登録の所属企業はキャンバスに散らさず、「関係未登録のグループ企業」として別枠へまとめる。
- connected componentをキャンバス内で大きく表示し、relationラベルを読みやすくする。
- company deep modeの既存挙動は維持する。

## Hierarchy view
- 会社カード＋関係カードの反復を廃止し、root→childを1行で読む本当のツリーにする。
- 各枝にrelation種別/比率を表示する。
- 複数階層へ自然に伸びる再帰構造にする。
- relation未登録グループは未登録状態を明示する。

## Follow-up
- 三井グループの上場区分・ticker補完は別Issueで扱う。
