"use client";

import { useRef, useState } from "react";
import { callScanApi, type ScanResult } from "../scan-utils";

type Props = {
  className?: string;
  onResult: (result: ScanResult, model: string | null) => void;
  onError: (message: string) => void;
};

export default function CameraScanButton({
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

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        {busy ? "解析中…" : "📷 カメラで追加"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </>
  );
}
