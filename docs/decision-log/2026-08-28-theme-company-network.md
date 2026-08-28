# テーマ → 企業 → 関係企業の横断探索

日付: 2026-08-28

## 背景

企業関係ネットワークをテーマ分析へ接続する際、「テーマに直接関係する企業」と「その企業に資本・支配等の関係がある企業」を同一視すると、企業関係があるだけでテーマ受益企業と誤認する危険がある。

そのため Phase 5B では、テーマエッジと企業関係エッジを別の事実として保持・表示する。

## 決定

1. `stock_notes_theme_company_links` をテーマ→canonical company identityの直接エッジとして使う。
2. 直接テーマ企業の根拠は `source_theme_link_id` から `stock_notes_theme_links` の検証状態・出典へ戻れるものを優先する。
3. 既定表示は verified の直接テーマリンクと verified/current の企業関係だけにする。
4. proposed は利用者が明示的に切り替えた場合のみ表示する。
5. 関連企業は、直接テーマ企業に接続する企業関係エッジから1-hopで発見する。
6. 資本関係の方向は探索方向に合わせて反転せず、DBのcanonical directionをそのまま表示する。
7. 関連企業をテーマ受益企業・投資候補とは自動判定しない。テーマ適合性の追加リサーチが必要であることをUIに明示する。
8. taxonomy/industry-mapの役割エッジと企業関係エッジは統合せず、別レイヤーとして扱う。

## 代表ケース

`自動運転産業マップ・商業化競争` に Woven by Toyota を直接企業として追加した。

- テーマ直接関係: Woven by Toyota公式企業概要が主な事業内容として自動運転技術を明示
- theme link: verified / high confidence / enabler
- company identity: 既存の `ウーブン・バイ・トヨタ`
- 企業関係: トヨタ自動車 → ウーブン・バイ・トヨタ、equity_ownership 100%、verified

この結果、

`自動運転テーマ → Woven by Toyota [直接] ← 100%出資 ← トヨタ自動車 [企業関係で発見]`

を表示できる。

ここから「トヨタ自動車は自動運転テーマの受益企業」と自動推論はしない。

## UI

新規Premium画面 `/premium/theme-company-network` を追加する。

- テーマ選択
- verifiedのみ / proposed含む切替
- 直接テーマ企業の根拠・基準日・confidence
- 関連企業との企業関係、ownership、verification、根拠
- 関連企業が直接テーマ企業でもある場合の明示
- `/premium/industry-map` と `/premium/company-network` への導線

## 非対象

- 間接受益スコア
- 自動投資判断
- 2-hop以降のテーマ間接探索
- supplier/customer/joint research等のPhase 6関係
