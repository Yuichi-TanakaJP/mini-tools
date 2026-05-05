# 2026-05-05 baseline-browser-mapping warning 対応

## 背景

- `npm run lint` と `npm run build` で `baseline-browser-mapping` のデータが古いという warning が表示されていた
- `baseline-browser-mapping@latest` へ更新しても、現時点では同梱データ自体が 2 か月超と判定され warning が残った

## 今回決めたこと

- `baseline-browser-mapping` は devDependency として最新版へ更新する
- `lint` と `build` では `BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA=true` と `BROWSERSLIST_IGNORE_OLD_DATA=true` を設定して warning を抑制する
- `lint` で残る同 warning は Node preload で対象メッセージだけを除去する
- `build` で Next.js worker から残る同 warning は build wrapper で対象メッセージだけを除去する
- Windows と CI の両方で同じ script を使えるよう、npm script から OS 非依存の Node 起動を使う

## 判断理由

- 最新版に更新しても warning が消えないため、依存更新だけでは解決できなかった
- warning はビルド失敗ではなくデータ鮮度の通知なので、明示的に抑制して CI / ローカル確認のノイズを減らす
- preload / wrapper の除去対象は `baseline-browser-mapping` の古いデータ warning に限定し、eslint / build のエラーや他の warning は隠さない
- npm script に OS 依存の環境変数構文を書かず、Windows 開発環境でも同じ挙動にする

## 影響範囲

- `package.json`
- `package-lock.json`
- `scripts/suppress-baseline-browser-mapping-warning.mjs`
- `scripts/run-next-build-filtered.mjs`

## 残課題

- 将来の `baseline-browser-mapping` で warning が自然に消える状態になったら、wrapper 継続の必要性を見直す
- `npm audit` の既存脆弱性 warning は今回の対象外

## 関連

- Issue:
- PR:
- 参照 docs:
  - `docs/docs-writing-workflow.md`
