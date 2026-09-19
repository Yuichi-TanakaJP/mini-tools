# 2026-09-19 TDNETローカル検索プリセットMVP

## 結論

Issue #400 は、現時点では全mini-tools共通の検索設定基盤として完成させず、TDNET適時開示一覧のブラウザ内プリセットMVPとして閉じる。

検索・保存の主力はSupabaseとChatGPT側に置く。mini-tools側は、画面を開いたユーザーが頻繁に使う条件をその場で再利用できる軽量UIに限定し、アカウント同期や他ツール横断の保存基盤はこのMVPの対象外とする。

## 決めたこと

- 対象画面は `/tools/tdnet-disclosures` のみとする。
- 保存対象は、現在表示しているデータに対する絞り込み条件に限定する。
  - キーワード
  - カテゴリ
  - リンク種別
  - テーマ
  - 時間帯
  - 財務関連のみ / 決算短信のみ / 訂正除外
- 日付と検索範囲はデータ取得条件なので、プリセットには含めない。
- 保存先はブラウザ `localStorage` の `tdnet_disclosures_search_presets_v1` とする。
- 名前、メモ、呼び出し、現在条件での上書き、名前・メモ編集、お気に入り、既定設定、削除を提供する。
- 保存失敗や壊れた保存値は画面をクラッシュさせず、安全な空状態または失敗通知として扱う。
- Supabase同期、スマホ・PC間同期、他ツールへの共通化は別判断とする。

## 理由

- TDNETは検索条件が多く、ローカル保存だけでも再利用価値を確認しやすい。
- 日付と範囲を分離すると、URL/APIによるデータ取得と画面内フィルタの責務が混ざらない。
- SupabaseとChatGPTを主力の検索・保存経路とする方針に対して、mini-tools側の実装を小さく保てる。
- 将来、軽いUIを残す判断になっても、保存形式・UAT・判断ログを足場として再利用できる。

## 影響範囲

- `app/tools/tdnet-disclosures/ToolClient.tsx`
- `app/tools/tdnet-disclosures/search-preset-storage.ts`
- `app/tools/tdnet-disclosures/__tests__/search-preset-storage.test.ts`
- `docs/specs/tools/tdnet-disclosures.md`
- `docs/uat/tdnet-disclosures.md`

## 関連

- Issue: #400
- [TDNET適時開示一覧 仕様](../specs/tools/tdnet-disclosures.md)
- [TDNET適時開示一覧 UAT](../uat/tdnet-disclosures.md)
