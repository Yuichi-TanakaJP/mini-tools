import { getApiBaseUrl, fetchJson } from "@/lib/market-api";
import type { EdinetDocumentListResponse, EdinetManifest } from "./types";

const R2_BASE = (process.env.EDINET_R2_BASE_URL ?? "").replace(/\/$/, "");
const R2_PREFIX = `${R2_BASE}/edinet/document-list`;

export async function loadEdinetManifest(): Promise<EdinetManifest | null> {
  if (!R2_BASE) return null;
  try {
    return await fetchJson<EdinetManifest>(`${R2_PREFIX}/manifest.json`, 300);
  } catch {
    return null;
  }
}

export async function loadEdinetDocumentList(
  date?: string,
): Promise<EdinetDocumentListResponse | null> {
  const apiBase = getApiBaseUrl();
  if (apiBase && !date) {
    try {
      return await fetchJson<EdinetDocumentListResponse>(
        `${apiBase}/edinet/document-list/latest`,
      );
    } catch {
      // fall through to R2
    }
  }

  if (!R2_BASE) return null;
  const path = date ? `${R2_PREFIX}/${date}.json` : `${R2_PREFIX}/latest.json`;
  try {
    return await fetchJson<EdinetDocumentListResponse>(path, 300);
  } catch {
    return null;
  }
}
