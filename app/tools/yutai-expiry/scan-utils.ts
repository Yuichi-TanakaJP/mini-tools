// yutai-expiry の画像スキャン関連で共有するユーティリティ。
// PoC ページとカメラボタンの両方から利用する。

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

export type ScanResult = {
  title: string | null;
  company: string | null;
  expiresOn: string | null;
  amountYen: number | null;
  quantity: number | null;
  confidence: number;
};

export async function resizeToJpegBase64(
  file: File
): Promise<{ base64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const longer = Math.max(bitmap.width, bitmap.height);
  const scale = longer > MAX_EDGE ? MAX_EDGE / longer : 1;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) throw new Error("canvas.toBlob failed");

  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return { base64: btoa(binary), mimeType: "image/jpeg" };
}

type ScanApiResponse = {
  result?: ScanResult;
  model?: string;
  error?: string;
  retryable?: boolean;
  upstreamStatus?: number;
};

export type ScanCallResult =
  | { ok: true; result: ScanResult; model: string | null }
  | { ok: false; message: string; retryable: boolean };

export async function callScanApi(file: File): Promise<ScanCallResult> {
  const { base64, mimeType } = await resizeToJpegBase64(file);
  const res = await fetch("/api/yutai-expiry/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, mimeType }),
  });
  const json = (await res.json()) as ScanApiResponse;
  if (!res.ok || !json.result) {
    const message = json.retryable
      ? `Gemini が混雑中です（${json.upstreamStatus ?? res.status}）。数秒〜数分待って再試行してください。`
      : json.error ?? `HTTP ${res.status}`;
    return { ok: false, message, retryable: Boolean(json.retryable) };
  }
  return { ok: true, result: json.result, model: json.model ?? null };
}
