# 2026-04-04 premium ログイン導線の暫定実装方針

## 背景

- header の王冠マークから premium へ移動できる入口を先に作りたい要望が出た
- 現状の premium ボタンはプレースホルダー表示のみで、遷移先ページがなかった
- 本格的な認証基盤は未導入のため、まずは最小構成で「パスワード入力後に次ページへ進む」フローを用意する

## 今回決めたこと

- header の王冠ボタンは `/premium` に遷移する導線に切り替える
- `/premium` は保護ページとし、未認証時は `/premium/login?next=/premium` にリダイレクトする
- `/premium/login` ではパスワード入力フォームを表示し、成功時に Cookie をセットして `/premium` へ遷移する
- 認証情報は環境変数 `PREMIUM_ACCESS_PASSWORD` と `PREMIUM_ACCESS_SECRET` で管理する
- premium ページは当面、TOPIX33 premium 構想の仮トップページとして使う
- ログイン画面には `開発中` の表記を明示する

## 判断理由

- パスワード文字列をクライアントへ直接埋め込むより、サーバー側で照合するほうが暫定実装として安全
- middleware まで入れず、対象を `/premium` 配下に限定したほうが構成が軽い
- まずは「導線が通ること」と「次ページを見せられること」を優先し、会員管理や外部認証は後続に分離する

## 影響範囲

- `components/ShareButtons.tsx`: premium ボタンの遷移先を有効化
- `app/premium/login/page.tsx`: ログイン画面
- `app/api/premium/login/route.ts`: パスワード照合と Cookie 発行
- `app/premium/page.tsx`: 認証後の仮トップページ
- `lib/premium-auth.ts`: Cookie 名と照合処理
- `.env.local.example`: premium 仮ログイン用の環境変数説明を追加

## 残課題

- 本格的なログイン基盤導入時に Cookie 方式を置き換えるか検討する
- premium ページを単なる仮トップから、実際の機能一覧や個別ページ導線へ拡張する
- パスワード単体運用から、ユーザー単位の認証へ移行する場合の設計整理

## 関連

- Issue: なし（会話での方針決定）
- PR: なし
- 参照 docs:
  - `docs/decision-log/2026-04-03-premium-feature-placeholder.md`
  - `docs/decision-log/2026-04-04-topix33-premium-visualization-plan.md`
