"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./screening.module.css";

export function RevalidateOnRestore({ children }: { children: ReactNode }) {
  const result = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const section = result.current;
    if (!section) return;
    const hide = (event: PageTransitionEvent) => {
      if (event.persisted) section.hidden = true;
    };
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", restore);
    return () => {
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", restore);
    };
  }, []);
  return <div ref={result} className={styles.results}>{children}</div>;
}
