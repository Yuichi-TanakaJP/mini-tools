## 結論

`yutai-expiry` に「カメラで優待券を撮影 → 画像認識で銘柄名・有効期限・金額を自動抽出 → 既存の追加フォームに prefill」する機能を追加する。

画像認識は **Gemini API（無料枠）** を一次選択肢とし、まずは PoC（撮影 → Gemini 呼び出し → JSON を console で確認）から段階的に実装する。撮影 UI は将来の横展開を想定して `lib/image-capture/` 配下に置くが、初期実装は yutai-expiry 専用ロジックとして書き、2 例目が出た段階で共通化を判断する（YAGNI）。

## 背景

- `yutai-expiry` の優待登録は現在すべて手入力で、銘柄・期限・金額を 1 件ずつタイプする必要がある
- 紙券・PDF・メールスクショなど非定型レイアウトの優待情報を、撮影だけで取り込みたい
- 全工程をクライアント／無料 API 範囲で完結させ、追加コストをゼロに保ちたい

## 採用技術と理由

### 画像認識: Gemini 2.5 Flash-Lite（無料枠）

- 無料枠 **15 RPM / 1,000 リクエスト/日**、画像入力対応、JSON 構造化出力可（2026年5月時点）
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

### Phase 1: PoC（最優先）

- ブランチ: 別ブランチで段階的に PR を積む
- 範囲:
  - Gemini API key の取得と `.env.local` への設定方法を確認
  - 単独の検証ページ or 既存 yutai-expiry 内に隠しボタンを設置
  - 「撮影 → Gemini 呼び出し → 返ってきた JSON を console.log」までで完結
  - UI 整形・既存フォーム統合・エラーハンドリングは含めない
- 完了条件:
  - 手元の優待券 3-5 枚で、銘柄／期限／金額が JSON として返ってくることを確認
  - レスポンス時間・実用性を体感で評価

### Phase 2: yutai-expiry への組み込み

- 既存の「追加」フローに「カメラで追加」ボタンを追加
- 撮影 → Gemini → 既存の追加ダイアログ（[ImportBenefitDialog](../../app/tools/yutai-expiry/components/ImportBenefitDialog.tsx) または新規ダイアログ）に prefill
- ユーザーが内容を確認・修正してから保存できる導線
- 失敗時のフォールバック（手入力に戻れる）

### Phase 3: 改善・共通化判断

- 2 例目（レシート読取 / 名刺取り込み 等）が現実的に出てきたら、`lib/image-capture/` を共通モジュールとして切り出す
- Tesseract.js を Gemini のレート制限ヒット時フォールバックとして組み込むかを再検討

## 影響範囲

- 追加: `app/tools/yutai-expiry/` 配下にカメラ撮影 UI と Gemini 呼び出しロジック
- 追加（想定）: `lib/image-capture/`（Phase 1 では yutai-expiry 内に閉じる）
- 追加: Gemini API キーの環境変数（`.env.example` にキー名のみ追加）
- 既存の保存処理・データ shape は変更しない

## 未決事項

- **Gemini API key の置き場所**: クライアントから直接叩くと key が露出するため、Next.js の API route で proxy する設計が妥当か検証する（Phase 1 で確定させる）
- **画像の保存有無**: 撮影画像をローカルに保存するか、その場で破棄するか（プライバシー観点で破棄が無難）
- **無料枠を超えた場合の挙動**: 1 日 1,000 リクエストを超えたときのエラー表示と、手入力フォールバックの導線
- **PWA 化の優先度**: Android Chrome の「ホーム画面に追加」を前提にするか、当面はブラウザ UI のままにするか

## 関連

- 実装ディレクトリ: [app/tools/yutai-expiry/](../../app/tools/yutai-expiry/)
- 既存の追加ダイアログ: [app/tools/yutai-expiry/components/ImportBenefitDialog.tsx](../../app/tools/yutai-expiry/components/ImportBenefitDialog.tsx)
- 利用端末前提: Android Chrome / Windows Chrome のみ（iOS/Safari 配慮不要）
