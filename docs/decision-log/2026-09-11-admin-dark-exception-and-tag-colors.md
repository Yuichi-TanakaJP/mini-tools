# 2026-09-11 管理画面を常時 Dark の例外として確定し、タグ分類色を chart トークンへ寄せる

## 背景

テーマ統一の残課題として、判断保留にしていた 2 件をユーザー確認のうえ確定した。

## 決めたこと 1: 管理画面 `/admin` は常時 Dark

選択テーマに追従しない**公式な例外**とする。

確定にあたり調べたところ、**「常時 Dark」が実際には成立していなかった**。
`.admin-pc`（820px 超）は Dark だが、`.admin-mobile`（820px 以下）は
`color: "#0f172a"` / `background: "#fff"` のライト配色で、
同じ画面が画面幅によって明暗が入れ替わっていた。

そのため次を行った。

- モバイル版をデスクトップ版と同じ Dark へそろえた。
- 散らばっていた直書き色を `ADMIN` 定数（surface / border / text / accent など）へ集約した。
  例外であっても、同じ役割に別の値が散るのは避ける。
- `colorScheme: "dark"` をページの地に指定し、スクロールバーやネイティブ部品も Dark にそろえた。
  これまでは選択テーマ側の `color-scheme` が効いていた。

### なぜ共通トークンを使わないか

`--color-text-muted` などはテーマで明暗が**反転**する。管理画面は地が常に暗いので、
ライトを選んだ利用者には「暗い地に暗い文字」として表示されてしまう。
実際、移行作業中に一度これをやって差し戻している。

**値ではなく役割で判断する必要がある**ことの実例として、
`docs/specs/cross-cutting/ui-color-palette.md` に「テーマに追従しない画面」の表を作り、
**逆にここがテーマへ追従していたら不具合**と扱うことを明記した。

## 決めたこと 2: タグ分類色は `--color-chart-*` から導く

yutai-memo の violet（戦略バッジ）と sky（単元・1株）は、状態でも騰落でもなく
**タグの分類**なので、分類色である `--color-chart-*` を正とする。

背景・hover・境界は、面に対する `color-mix` で作る。

```css
--clr-violet:        var(--color-chart-6);
--clr-violet-light:  color-mix(in srgb, var(--color-chart-6) 10%, var(--color-bg-card));
--clr-violet-border: color-mix(in srgb, var(--color-chart-6) 34%, var(--color-bg-card));
```

こうすると `--color-bg-card` がテーマで変わるのに追従して、
淡い背景も自動的に Light / Dark へ合う。値を 2 組書く必要がない。

あわせて、同ファイルに残っていた `--clr-primary` / `--clr-success` /
`--clr-amber` / `--clr-danger` も共通トークンへ委譲した。
結果、`ToolClient.module.css` の色リテラルは 28 -> **0** になった。

状態色をタグ分類へ流用しない方針も明記した。「緑のタグ」が「成功」の意味に読まれるため。

## 影響範囲

- `app/admin/page.tsx`: モバイル版の配色、`ADMIN` パレット、`color-scheme`。
- `app/tools/yutai-memo/ToolClient.module.css`: `--clr-*` 層すべて。
- docs: デザインコンセプトの「テーマ例外」、カラーパレット仕様に
  「テーマに追従しない画面」「分類色（タグ）の作り方」を追加。
- 非例外の色リテラル: 352 -> 324 箇所。

## 残課題

- 残る 324 箇所（グラフ系列、装飾グラデーション、ブランド色）の段階的な削減。
- [UAT: 表示テーマ](../uat/color-theme.md) の初回実施。特に管理画面は
  **画面幅 820px の前後**で Dark がそろっているかを見る。

## 関連

- Issue: #573 / #572
- 参照 docs: [UI カラーパレット仕様](../specs/cross-cutting/ui-color-palette.md)、
  [UI デザインコンセプト](../specs/cross-cutting/ui-design-concept.md)、
  [直書きを増やさない仕組み](./2026-09-11-color-literal-budget.md)
