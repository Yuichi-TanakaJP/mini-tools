"use client";

import { useState } from "react";
import { ThemeListView } from "./ThemeViewer";
import type { ThemeListLoadResult } from "./types";

/** Keep the last good page in this mounted session; never persist personal data. */
export default function ThemeListSession(props: {
  result: ThemeListLoadResult; isContinuation: boolean; cursor?: string;
}) {
  const [lastGood, setLastGood] = useState<typeof props | null>(
    props.result.status === "ok" || props.result.status === "empty" ? props : null,
  );
  const success = props.result.status === "ok" || props.result.status === "empty";
  if (success && lastGood !== props) setLastGood(props);
  return <>
    <ThemeListView {...props} />
    {!success && lastGood ? <section aria-label="前回取得できた一覧">
      <p>前回取得できた一覧です。上のエラーは今回要求したページの結果です。</p>
      <ThemeListView {...lastGood} />
    </section> : null}
  </>;
}
