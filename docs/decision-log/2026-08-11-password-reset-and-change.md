# 2026-08-11 パスワードのリセット・変更機能の追加

## 背景

- 2026-06-21〜06-22 の決定（[任意ログイン同期方針](./2026-06-21-localstorage-optional-login-sync-policy.md)、[ログイン直後の自動同期を止める判断](./2026-06-22-manual-sync-after-login.md)）で Supabase Auth によるユーザー単位ログインを導入した。
- 実運用で、Supabase ダッシュボードから「Send password recovery」でリセットメールを送ったユーザーが、リンクを開いても通常のログイン画面が表示されるだけで新しいパスワードを設定できない事象が発生した。
- 原因は mini-tools 側にリセットを受け取る実装が無かったこと。Supabase はメール送信とトークン発行までが責務で、「トークンからセッションを確立し、新しいパスワードを入力させる画面」はアプリ側で用意する必要がある。この画面が無かったため、パスワードを忘れたユーザーは実質ログイン不能（＝クラウド同期が使えない）状態だった。
- また、一度設定したパスワードをログイン中に変更する導線も存在しなかった。

## 今回決めたこと

- `/account` に「パスワードを忘れた場合」の申請 UI を追加し、`supabase.auth.resetPasswordForEmail(email, { redirectTo: "<origin>/account/reset-password" })` を呼ぶ。
- `/account/reset-password` を新設し、リセットメールのリンクから遷移してきたときにセッションを確立し、新しいパスワードを入力させる。
- Supabase が発行しうるリンク形式を **3 種類とも**受ける。
  - PKCE: `?code=...` → `exchangeCodeForSession`
  - OTP: `?token_hash=...&type=recovery` → `verifyOtp`
  - 暗黙フロー（ハッシュフラグメント）: `#access_token=...&refresh_token=...` → `setSession`（`detectSessionInUrl` が処理済みなら追加の `getSession()` フォールバックで検出）
- ログイン中ユーザー向けに `/account` へ「パスワードを変更」セクションを追加し、`supabase.auth.updateUser({ password })` で変更できるようにする。
- メールアドレスの存在有無を画面に出さない。`resetPasswordForEmail` の成功/失敗（Supabase 側のレスポンスや通信エラー）に関わらず、常に同じ文言（「メールを送信しました。…」）を表示する。
- URL に含まれるトークンは、セッション確立処理の直後に `history.replaceState` で URL から消す。

## 判断理由

### 3 種類のリンク形式を全部受ける理由

- Supabase の Auth 設定（メールテンプレート、SDK バージョン、`flowType` 設定）によって、実際に届くリンクの形式が変わりうる。特に今回はダッシュボードから手動で送った「Send password recovery」であり、アプリ側の `flowType` 設定が確実に反映されているとは限らない。
- 3 経路を判定ロジックで振り分けておけば、Supabase 側の設定変更（PKCE への統一など）が将来あっても mini-tools 側の実装を都度作り直さずに済む。
- 判定ロジック（`parseResetTokensFromUrl`）を純粋関数として切り出し、URL の `search` / `hash` の組み合わせだけで判定できるようにしたため、テストで全パターンを固定できる。

### アカウント列挙を防ぐ文言の方針

- 「このメールアドレスは存在しません」のような差分のある応答を返すと、第三者が総当たりで登録メールアドレスの存在を調べられる（アカウント列挙攻撃）。
- そのため `handleForgotPassword` では、`resetPasswordForEmail` 呼び出しの成否（Supabase 側のエラー、ネットワーク例外）を問わず、常に「メールを送信しました。届いたリンクから…」という同一文言を表示する。存在しないアドレスでも同じ文言が出る。
- 一方で、リンクを開いた後（`/account/reset-password` 側）のエラーは「期限切れ」「トークンなし」「その他」を分けて丁寧に表示する。こちらは既にメールを受け取った本人向けの画面であり、アカウント列挙のリスクがないため、対処できるように文言を分ける。

### URL からのトークン除去

- アクセストークン・リフレッシュトークン・PKCE code は、ブラウザ履歴や共有（スクショ・URL コピー）で漏洩しうる機微情報のため、セッション確立に使い終わったら `history.replaceState` で URL から消す。

## 影響範囲

- `app/account/AccountClient.tsx`: 「パスワードを忘れた場合」申請 UI、ログイン中の「パスワードを変更」セクションを追加。既存のログイン/新規登録/同期 UI は変更していない。
- `app/account/reset-password/page.tsx` / `ResetPasswordClient.tsx`: 新設。
- `lib/auth/password.ts`: 新設。`validateNewPassword`（8文字以上・確認一致）、`parseResetTokensFromUrl`（3 リンク形式 + エラー判定の純粋関数）。
- `lib/supabase/*` は変更なし（既存の Browser Client をそのまま利用）。

## 残課題

- パスワード強度の要件は「8文字以上」のみ。今後、Supabase 側のパスワードポリシー設定と足並みを揃えるかは未検討。
- Supabase プロジェクト側の `site_url` / `uri_allow_list` 設定は本 PR の対象外（依頼者が Management API で別途設定）。

## 追記（2026-08-11 codex レビュー対応）

初回実装を codex レビュー（P1×2, P2×1）で指摘され、同ブランチで修正した。

- **P1: PKCE リンクで復旧できない**（`?code=` の交換失敗が即エラー画面になっていた）。`@supabase/ssr` の `createBrowserClient` は `detectSessionInUrl` が既定で有効なため、`ResetPasswordClient` の副作用が走るより先に SDK が同じ `code` を消費してセッションを確立し、code verifier を削除していることがある。その状態で同じ `code` を再交換すると必ず失敗するが、セッション自体は既に確立済み。「交換失敗＝復旧不能」ではないため、`code` / `token_hash` / `access_token` の3経路すべてで、交換失敗時は必ず `getSession()` を確認してからエラー判定する共通ロジック（`lib/auth/reset-session.ts` の `resolveResetSession` / `finishWithSessionCheck`）に切り出した。Supabase 呼び出し部分だけを抽象化した純粋なテスト対象にし、「交換失敗だが `getSession` にセッションがある→`ready`」をユニットテストで固定した。
- **P1: リセットメール送信失敗を成功として表示していた**。`resetPasswordForEmail` の戻り値 `{ error }` を無視して常に成功文言を出していたため、リダイレクトURL不許可・レート制限・通信失敗でも「送信しました」と表示され、利用者が待ち続けて復旧できない状態だった。Supabase は「メールアドレスが存在しない」ケースでは意図的に `error` を返さない仕様（アカウント列挙対策）なので、`error` の有無だけを見て「送信できたか」を判定してもメールアドレスの存在有無は漏れない。`error` があれば「送信に失敗しました。しばらくしてからもう一度お試しください」という再試行可能な一般文言を、無ければ従来通りの「メールを送信しました」を表示するよう分けた。
- **P2: エラーURLの判定漏れ**。`parseResetTokensFromUrl` が `error` パラメータの有無だけでエラー判定しており、Supabase が `error_code` / `error_description` だけを付けて返すケースで `none` 扱いになり、「直接アクセスしないでください」と誤表示されトークンも URL から除去されなかった。`error` / `error_code` / `error_description` のいずれか1つでもあればエラーとして扱うように修正した。

いずれも「有効なリセットリンクなのに動かない」「壊れた通知なのに成功に見える」という、唯一の復旧手段としての信頼性に関わる不具合だったため、テストを追加したうえで対応した。

## 関連

- Issue: なし（会話での方針決定）
- PR: feat/password-reset
- 参照 docs:
  - [2026-06-21 ローカルデータの任意ログイン同期方針](./2026-06-21-localstorage-optional-login-sync-policy.md)
  - [2026-06-22 ログイン直後の自動同期を止める判断](./2026-06-22-manual-sync-after-login.md)
  - [UAT: パスワードのリセット・変更](../uat/password-reset.md)
