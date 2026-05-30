"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type NavigateMethod = "push" | "replace";

type NavigateOptions = {
  key?: string;
  method?: NavigateMethod;
};

export type RouterTransitionApi = {
  isPending: boolean;
  pendingKey: string | null;
  navigate: (href: string, options?: NavigateOptions) => void;
  /** key と pendingKey が一致するか判定（押された対象だけを視覚化する用途） */
  isPendingFor: (key: string) => boolean;
};

/**
 * Next.js のルーター遷移を useTransition で包み、押下した対象を pendingKey で識別できるようにする。
 * 「同じページ内の searchParams 変更だと loading.tsx が出ない」「全ボタン一律 disabled だと体験が悪い」
 * を避けるため、押した対象だけを視覚化する API を提供する。
 */
export function useRouterTransition(): RouterTransitionApi {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    // 遷移完了 (isPending=false) 時に pendingKey を解除する。
    // useTransition の状態と同期するための effect であり、外部状態同期に相当する。
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!isPending && pendingKey !== null) {
      setPendingKey(null);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isPending, pendingKey]);

  const navigate = useCallback(
    (href: string, options?: NavigateOptions) => {
      const method = options?.method ?? "push";
      if (options?.key !== undefined) {
        setPendingKey(options.key);
      }
      startTransition(() => {
        if (method === "replace") {
          router.replace(href);
        } else {
          router.push(href);
        }
      });
    },
    [router],
  );

  const isPendingFor = useCallback(
    (key: string) => isPending && pendingKey === key,
    [isPending, pendingKey],
  );

  return { isPending, pendingKey, navigate, isPendingFor };
}
