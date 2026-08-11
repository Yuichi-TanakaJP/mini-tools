"use client";

// 銘柄の登録フォーム用。証券コード入力から銘柄名を補完するための銘柄マスター取得。
// app/tools/my-stocks/useStockMaster.ts と同じ「モジュールスコープで1回だけ fetch し、
// 以後はメモリのキャッシュを使い回す」パターンを踏襲する（重いデータのため）。
// 取得元は自前ルート app/api/stock-notes/stock-master/route.ts（{code,name}の配列のみ）。
import { useCallback, useEffect, useState } from "react";

export type StockMasterEntry = { code: string; name: string };

const MASTER_URL = "/api/stock-notes/stock-master";

let cachedMaster: StockMasterEntry[] | null = null;
let inflight: Promise<StockMasterEntry[]> | null = null;

async function fetchMaster(): Promise<StockMasterEntry[]> {
  if (cachedMaster) return cachedMaster;
  if (inflight) return inflight;

  inflight = (async () => {
    const res = await fetch(MASTER_URL);
    if (!res.ok) throw new Error(`Failed to load stock master: HTTP ${res.status}`);
    const list = (await res.json()) as StockMasterEntry[];
    cachedMaster = list;
    return list;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export type StockNotesStockMasterState = {
  ready: boolean;
  error: boolean;
  /** 証券コード（完全一致）から銘柄名を引く。見つからなければ null（手入力を促す）。 */
  lookupByCode: (code: string) => string | null;
};

export function useStockNotesStockMaster(): StockNotesStockMasterState {
  const [ready, setReady] = useState(cachedMaster !== null);
  const [error, setError] = useState(false);
  const [all, setAll] = useState<StockMasterEntry[]>(cachedMaster ?? []);

  useEffect(() => {
    if (cachedMaster) return;
    let active = true;
    fetchMaster()
      .then((list) => {
        if (!active) return;
        setAll(list);
        setReady(true);
      })
      .catch(() => {
        if (!active) return;
        // 取得失敗は致命的ではない。名前の自動補完ができないだけで、手入力での登録は続けられる。
        setError(true);
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const lookupByCode = useCallback(
    (code: string): string | null => {
      const normalized = code.trim();
      if (!normalized) return null;
      const hit = all.find((m) => m.code === normalized);
      return hit?.name ?? null;
    },
    [all],
  );

  return { ready, error, lookupByCode };
}
