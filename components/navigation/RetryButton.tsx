"use client";

import { useRouterTransition } from "@/app/tools/_shared/use-router-transition";

export default function RetryButton() {
  const { refresh, isPending } = useRouterTransition();
  return <button type="button" onClick={refresh} disabled={isPending} aria-busy={isPending}>
    {isPending ? "再取得中…" : "同じ条件で再試行"}
  </button>;
}
