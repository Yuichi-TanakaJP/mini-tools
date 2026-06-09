"use client";

import { useCallback, useEffect, useState } from "react";
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
          name: normalizeAscii(r.name),
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

function normalizeAscii(value: string): string {
  return value.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

export type StockMasterState = {
  ready: boolean;
  error: boolean;
  all: StockMaster[];
  /** クエリにマッチする銘柄を最大 limit 件返す。 */
  search: (query: string, limit?: number) => StockMaster[];
};

export function useStockMaster(initialMaster: StockMaster[] = []): StockMasterState {
  const hasInitialMaster = initialMaster.length > 0;
  const [ready, setReady] = useState(hasInitialMaster || cachedMaster !== null);
  const [error, setError] = useState(false);
  const [all, setAll] = useState<StockMaster[]>(
    initialMaster.length > 0 ? initialMaster : cachedMaster ?? [],
  );

  useEffect(() => {
    if (hasInitialMaster || cachedMaster) {
      return;
    }
    let active = true;
    fetchMaster()
      .then((list) => {
        if (!active) return;
        setAll(list);
        setReady(true);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
      });
    return () => {
      active = false;
    };
  }, [hasInitialMaster]);

  const search = useCallback((query: string, limit = 30): StockMaster[] => {
    const q = query.trim();
    if (!q) return [];
    const lower = q.toLowerCase();
    const isCodeLike = /^[0-9a-zA-Z]+$/.test(q);
    const results: StockMaster[] = [];
    for (const m of all) {
      const codeHit = isCodeLike && m.code.toLowerCase().startsWith(lower);
      const nameHit = m.name.toLowerCase().includes(lower);
      if (codeHit || nameHit) {
        results.push(m);
        if (results.length >= limit) break;
      }
    }
    return results;
  }, [all]);

  return { ready, error, all, search };
}
