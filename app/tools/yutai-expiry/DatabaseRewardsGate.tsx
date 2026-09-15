"use client";

import { useYutaiWorkspace } from "@/lib/yutai/browser";
import { isSyncConfigured } from "@/lib/supabase/config";
import DatabaseRewards from "./DatabaseRewards";
import styles from "../yutai-memo/DatabaseMemo.module.css";

export default function DatabaseRewardsGate({ scanEnabled = false }: { scanEnabled?: boolean }) {
  const configured = isSyncConfigured();
  const view = useYutaiWorkspace(1, configured);

  if (!configured) {
    return <section className={styles.page}><p role="alert">DB接続設定がありません。従来保存へは戻しません。</p></section>;
  }

  if (view.data) return <DatabaseRewards scanEnabled={scanEnabled} />;

  const kind = view.error?.kind;
  const signedOut = view.status === "signed_out" || kind === "auth";
  const offline = kind === "offline";

  return (
    <section className={styles.page}>
      <h1>株主優待期限帳</h1>
      {!view.error && <p>{signedOut ? "Supabaseへのログインが必要です。" : "優待残高を取得しています。"}</p>}
      {view.error && signedOut && <p role="alert">ログイン状態を確認できません。再ログインしてください。</p>}
      {view.error && offline && <p role="alert">オフラインのため優待データを取得できません。通信が戻ったら再読み込みしてください。</p>}
      {view.error && !signedOut && !offline && (
        <p role="alert">ログインは確認済みですが、優待データの取得処理で失敗しました。再読み込みで直らない場合は、データ形式またはアプリ側の不整合です。</p>
      )}
      {signedOut && <a href="/account">ログイン画面へ</a>}
      {" "}<button type="button" onClick={() => window.location.reload()}>再読み込み</button>
    </section>
  );
}
