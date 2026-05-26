"use client";

import { useRef, useState } from "react";
import { callScanApi, type ScanResult } from "../scan-utils";

type Mode = "camera" | "gallery";

type Props = {
  /**
   * camera: capture="environment" を付け、モバイルでカメラ直起動
   * gallery: capture を付けず、ギャラリー / ファイル選択を開く (PC ではファイル選択ダイアログ)
   */
  mode?: Mode;
  className?: string;
  onResult: (result: ScanResult, model: string | null) => void;
  onError: (message: string) => void;
};

export default function CameraScanButton({
  mode = "gallery",
  className,
  onResult,
  onError,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const r = await callScanApi(file);
      if (!r.ok || !r.result) {
        onError(r.message ?? "unknown error");
        return;
      }
      onResult(r.result, r.model);
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const label = busy
    ? "解析中…"
    : mode === "camera"
      ? "📷 撮影"
      : "🖼️ 画像から選択";

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        {label}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        {...(mode === "camera" ? { capture: "environment" as const } : {})}
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </>
  );
}
