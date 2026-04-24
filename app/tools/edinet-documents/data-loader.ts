import { getApiBaseUrl, fetchJson } from "@/lib/market-api";
import type { EdinetDocumentListResponse } from "./types";

export async function loadEdinetDocumentList(): Promise<EdinetDocumentListResponse | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  try {
    return await fetchJson<EdinetDocumentListResponse>(`${apiBase}/edinet/document-list/latest`);
  } catch {
    return null;
  }
}
