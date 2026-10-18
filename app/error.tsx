"use client";

import { useTransition } from "react";
import { useNavigationActivity } from "@/components/navigation/NavigationProvider";
import Link from "@/components/navigation/Link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const [pending, startTransition] = useTransition();
  useNavigationActivity(pending, "画面");
  return <main className="route-loading" role="alert">
    <h1>画面を表示できませんでした</h1>
    <p>時間をおいて再試行してください。入力内容やエラーの詳細はここには表示しません。</p>
    <button type="button" disabled={pending} aria-busy={pending} onClick={() => startTransition(reset)}>{pending ? "再試行中…" : "同じ画面を再試行"}</button>{" "}<Link href="/">ホームへ</Link>
  </main>;
}
