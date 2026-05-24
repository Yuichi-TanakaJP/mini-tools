## 結論

`yutai-expiry` に「カメラで優待券を撮影 → 画像認識で銘柄名・有効期限・金額を自動抽出 → 既存の追加フォームに prefill」する機能を追加する。

画像認識は **Gemini API（無料枠）** を一次選択肢とし、まずは PoC（撮影 → Gemini 呼び出し → JSON を console で確認）から段階的に実装する。撮影 UI は将来の横展開を想定して `lib/image-capture/` 配下に置くが、初期実装は yutai-expiry 専用ロジックとして書き、2 例目が出た段階で共通化を判断する（YAGNI）。

## 背景

- `yutai-expiry` の優待登録は現在すべて手入力で、銘柄・期限・金額を 1 件ずつタイプする必要がある
- 紙券・メールスクショなど非定型レイアウトの優待情報を、撮影だけで取り込みたい（PDF はスクリーンショット化した画像を投入する前提とし、Phase 1 では PDF 直接アップロード対応はしない）
- 全工程をクライアント／無料 API 範囲で完結させ、追加コストをゼロに保ちたい

## 採用技術と理由

### 画像認識: Gemini 2.5 Flash-Lite（無料枠）

- 無料枠あり、画像入力対応、JSON 構造化出力（`responseSchema`）が使える
- 具体的な RPM / RPD・モデル選択肢は変動するため、運用時は公式の [pricing](https://ai.google.dev/gemini-api/docs/pricing) / [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) を都度確認する
- 非定型レイアウトの優待券に対する抽出精度が、正規表現＋OCR より大幅に高い
- クレカ登録不要、個人利用では実質無制限
- API key の取り扱いは別途検討（後述「未決事項」）

### 採用しない選択肢と理由

- **Tesseract.js**: 完全無料・無制限だが、優待券の非定型レイアウトでは抽出精度が出にくく、パーサ実装も複雑化する。将来、Gemini フォールバックとして組み込む余地は残す
- **Google Cloud Vision**: 月 1,000 回までで Gemini と比較してメリットが薄い
- **ML Kit (Web 版)**: 提供されていない

### カメラ I/F: `getUserMedia` + Canvas

- 利用端末は **Android Chrome / Windows Chrome** に限定するため、Safari/iOS 固有の制約は考慮対象外
- `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })` で背面カメラを起動
- Canvas で縮小・圧縮してから Gemini に送信（帯域・トークン消費の抑制）

## 想定フロー

```
[ユーザー操作]
  「カメラで追加」ボタン
        ↓
[lib/image-capture（共通想定）]
  getUserMedia で起動 → preview → 撮影
  Canvas で前処理（縮小・JPEG 圧縮）
        ↓
[yutai-expiry/scan ロジック]
  Gemini 2.5 Flash-Lite に画像 + プロンプト送信
  期待 JSON: { brand: string, expiry: string(YYYY-MM-DD), amount?: number, unit?: 'yen' | 'count' }
        ↓
[既存の追加フォームを prefill]
  ユーザーが内容を確認 → 確定 → 既存の保存処理に流す
```

## 段階計画

### Phase 1: PoC（完了）

- 検証用ページ [/tools/yutai-expiry/scan-poc](../../app/tools/yutai-expiry/scan-poc/page.tsx) を新設し、撮影 → Gemini → JSON 表示までを通した
- API route [app/api/yutai-expiry/scan/route.ts](../../app/api/yutai-expiry/scan/route.ts) は `NODE_ENV !== "production"` + `YUTAI_SCAN_POC_ENABLED=1` の二重ガード
- `GEMINI_MODEL` env でモデル切替可能、混雑エラー（503/429）はクライアントに retryable で伝達
- 動作確認: 統合 OK、優待券以外の画像は確信度 0.5 で全 null（プロンプト通り）

### Phase 2: yutai-expiry への組み込み

- 既存の「追加」フローに「📷 カメラで追加」ボタンを追加
- 撮影 → Gemini → 既存の [EditBenefitDialog](../../app/tools/yutai-expiry/components/EditBenefitDialog.tsx) に prefill
- ユーザーが内容を確認・修正してから保存できる導線（既存の `upsertFromDraft` をそのまま利用）
- 失敗時は toast で通知、フォームには進まないので手入力フォールバックは自動

**Phase 2 で採用した方針**:
- スキャンボタンは `NEXT_PUBLIC_YUTAI_SCAN_ENABLED=1` のときだけ表示（production では非表示）
- 撮影/送信のロジックは [scan-utils.ts](../../app/tools/yutai-expiry/scan-utils.ts) に集約、PoC ページとボタンで共用
- 個別ダイアログを新設せず既存ダイアログを再利用（ユーザーの編集導線が一貫する）

**マッピングルール** (`scanResultToDraft`):
- `quantity > 0`: count モード、qty に枚数、unitYen に額面（あれば）
- `amountYen > 0` のみ: amount モード、balanceYen に金額
- どちらも null: count モードで空フォーム

### Phase 3: 改善・共通化判断

- 2 例目（レシート読取 / 名刺取り込み 等）が現実的に出てきたら、`lib/image-capture/` を共通モジュールとして切り出す
- Tesseract.js を Gemini のレート制限ヒット時フォールバックとして組み込むかを再検討

## 影響範囲

- 追加: `app/tools/yutai-expiry/` 配下にカメラ撮影 UI と Gemini 呼び出しロジック
- 追加（想定）: `lib/image-capture/`（Phase 1 では yutai-expiry 内に閉じる）
- 追加: Gemini API キーの環境変数（`.env.example` にキー名のみ追加）
- 既存の保存処理・データ shape は変更しない

## 既知の制約・注意事項

### データ利用懸念（重要）

Gemini API の **無料枠（Unpaid Services）では、送信内容と生成結果が Google のサービス改善・モデル学習に使われる** ことが [公式 terms](https://ai.google.dev/gemini-api/terms) に明記されている。

- 優待券には氏名・会員番号・QR・バーコード・住所などの個人情報が含まれることが多いため、**そのまま無料枠に送信するのは不適切**
- 検証段階では、個人情報・QR・バーコードをマスクした画像 or ダミー画像のみを使う
- Phase 2 以降で実運用する場合は、次のいずれかの方針を選ぶ必要がある:
  - (a) クライアント側で個人情報部分を検出・マスクしてから送信する
  - (b) 課金プロジェクトに切り替えて従量課金 Tier を使う（学習に使われない）
  - (c) 画像を送らず、ユーザーが手入力した文字列のみを Gemini に渡すハイブリッド方式に切り替える

### Billing / 料金

- 無料枠の範囲内に留めれば無料（具体的な上限は公式 pricing を参照）
- 課金プロジェクトに切り替えると従量課金の対象。誤って billing 有効化しないよう注意
- Billing を有効化する場合は予算アラート + API key のリファラ制限を必ず設定する

### `getUserMedia` の secure context 制約

- `getUserMedia` は **HTTPS or localhost のみで動作**
- スマホから PC の dev server に `http://<PCのIP>:3000` 経由でアクセスすると Chrome の secure context 制限で動かない
- Phase 2 で `getUserMedia` に置き換えるなら、次のどちらかが必要:
  - `next dev --experimental-https` で開発サーバを HTTPS 化
  - Vercel Preview など HTTPS ホスティングにデプロイして確認
- 現 Phase 1 PoC は `<input type="file" capture="environment">` を採用しているため、http の IP アクセスでも動く

## 未決事項

- **個人情報マスク方針**: 手動マスクで運用するか、自動マスク（Canvas で塗りつぶし UI 等）を Phase 2 で実装するか
- **画像の保存有無**: 撮影画像をローカルに保存するか、その場で破棄するか（プライバシー観点で破棄が無難）
- **無料枠を超えた場合の挙動**: 日次/分次リクエスト上限を超えたときのエラー表示と、手入力フォールバックの導線
- **PWA 化の優先度**: Android Chrome の「ホーム画面に追加」を前提にするか、当面はブラウザ UI のままにするか

### 確定事項（Phase 1 で決まったこと）

- **API key の置き場所**: Next.js の server route で proxy。クライアントには露出させない（採用済み）
- **PoC エンドポイントの公開制御**: `YUTAI_SCAN_POC_ENABLED=1` の明示フラグでのみ有効化。未設定時は 404 を返して存在を伏せる（Codex review P1 対応）
- **PoC の撮影 I/F**: `<input capture>` を採用。secure context 制限を回避でき、Android Chrome で標準カメラが直接起動する

## 関連

- 実装ディレクトリ: [app/tools/yutai-expiry/](../../app/tools/yutai-expiry/)
- 既存の追加ダイアログ: [app/tools/yutai-expiry/components/ImportBenefitDialog.tsx](../../app/tools/yutai-expiry/components/ImportBenefitDialog.tsx)
- 利用端末前提: Android Chrome / Windows Chrome のみ（iOS/Safari 配慮不要）
