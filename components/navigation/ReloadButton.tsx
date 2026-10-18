"use client";
import { useState } from "react";
import { useNavigationFeedback } from "./NavigationProvider";
export default function ReloadButton() {
  const feedback = useNavigationFeedback();
  const [pending, setPending] = useState(false);
  return <button type="button" disabled={pending} aria-busy={pending} onClick={event => {
    setPending(true);
    feedback?.begin(window.location.pathname + window.location.search, event.currentTarget);
    window.location.reload();
  }}>{pending ? "再読み込み中…" : "再読み込み"}</button>;
}
