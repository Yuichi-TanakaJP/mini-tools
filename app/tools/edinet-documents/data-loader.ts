import { getApiBaseUrl, fetchJson } from "@/lib/market-api";
import type { EdinetDocumentListResponse, EdinetManifest } from "./types";

export async function loadEdinetManifest(): Promise<EdinetManifest | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;
  try {
    return await fetchJson<EdinetManifest>(`${apiBase}/edinet/document-list/manifest`);
  } catch {
    return null;
  }
}

export async function loadEdinetDocumentList(
  date?: string,
): Promise<EdinetDocumentListResponse | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;
  const path = date
    ? `${apiBase}/edinet/document-list/${date}`
    : `${apiBase}/edinet/document-list/latest`;
  try {
    return await fetchJson<EdinetDocumentListResponse>(path);
  } catch {
    return null;
  }
}
