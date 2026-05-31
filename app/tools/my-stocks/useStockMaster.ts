"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StockMaster } from "./types";

const MASTER_URL = "/data/jpx_listed_companies.json";

type RawMaster = {
  code?: unknown;
  name?: unknown;
  market?: unknown;
  sector?: unknown;
};

let cachedMaster: StockMaster[] | null = null;
let inflight: Promise<StockMaster[]> | null = null;

/**
 * 銘柄マスタ（全上場銘柄）を /public から1回だけ fetch してメモリにキャッシュする。
 * 検索クエリはサーバへ送らず、取得したマスタをクライアント上で filter する。
 */
async function fetchMaster(): Promise<StockMaster[]> {
  if (cachedMaster) return cachedMaster;
  if (inflight) return inflight;

  inflight = (async () => {
    const res = await fetch(MASTER_URL);
    if (!res.ok) throw new Error(`Failed to load stock master: HTTP ${res.status}`);
    const raw = (await res.json()) as RawMaster[];
    const list: StockMaster[] = [];
    for (const r of raw) {
      if (typeof r.code === "string" && typeof r.name === "string") {
        list.push({
          code: r.code,
          name: r.name,
          market: typeof r.market === "string" ? r.market : "",
          sector: typeof r.sector === "string" ? r.sector : null,
        });
      }
    }
    cachedMaster = list;
    return list;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export type StockMasterState = {
  ready: boolean;
  error: boolean;
  /** クエリにマッチする銘柄を最大 limit 件返す。 */
  search: (query: string, limit?: number) => StockMaster[];
};

export function useStockMaster(): StockMasterState {
  const [ready, setReady] = useState(cachedMaster !== null);
  const [error, setError] = useState(false);
  const masterRef = useRef<StockMaster[]>(cachedMaster ?? []);

  useEffect(() => {
    if (cachedMaster) {
      // 初期 state が既に ready=true を反映済みなので setState 不要
      masterRef.current = cachedMaster;
      return;
    }
    let active = true;
    fetchMaster()
      .then((list) => {
        if (!active) return;
        masterRef.current = list;
        setReady(true);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const search = useCallback((query: string, limit = 30): StockMaster[] => {
    const q = query.trim();
    if (!q) return [];
    const lower = q.toLowerCase();
    const isCodeLike = /^[0-9a-zA-Z]+$/.test(q);
    const results: StockMaster[] = [];
    for (const m of masterRef.current) {
      const codeHit = isCodeLike && m.code.toLowerCase().startsWith(lower);
      const nameHit = m.name.toLowerCase().includes(lower);
      if (codeHit || nameHit) {
        results.push(m);
        if (results.length >= limit) break;
      }
    }
    return results;
  }, []);

  return { ready, error, search };
}
