"use client";

import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { internalNavigationTarget } from "./navigation-target";

type Navigation = { id: number; from: string; target: string; started: number };
type Feedback = {
  begin: (target: string, element?: HTMLElement | null) => number;
  finish: (id: number) => void;
  isCurrent: (target: string) => boolean;
  activity: (label: string) => () => void;
  location: (url: string) => void;
};
const Context = createContext<Feedback | null>(null);
export const useNavigationFeedback = () => useContext(Context);

function LocationObserver() {
  const pathname = usePathname();
  const search = useSearchParams();
  const feedback = useNavigationFeedback();
  useEffect(() => { feedback?.location(`${pathname}${search.size ? `?${search}` : ""}`); }, [feedback, pathname, search]);
  return null;
}

export default function NavigationProvider({ children }: { children: ReactNode }) {
  const sequence = useRef(0);
  const currentLocation = useRef("");
  const pending = useRef<Navigation | null>(null);
  const pressed = useRef<HTMLElement | null>(null);
  const [navigation, setNavigation] = useState<Navigation | null>(null);
  const [activities, setActivities] = useState<Map<number, string>>(new Map());
  const [elapsed, setElapsed] = useState(0);
  const activityCount = useRef(0);
  const [activityStarted, setActivityStarted] = useState(0);
  const clearPressed = useCallback(() => {
    if (pressed.current) delete pressed.current.dataset.navigationPending;
    pressed.current = null;
  }, []);
  const finish = useCallback((id: number) => {
    if (pending.current?.id !== id) return;
    pending.current = null;
    clearPressed();
    setNavigation(null);
  }, [clearPressed]);
  const begin = useCallback((target: string, element?: HTMLElement | null) => {
    clearPressed();
    if (element) { element.dataset.navigationPending = "true"; pressed.current = element; }
    const next = { id: ++sequence.current, from: currentLocation.current || window.location.pathname + window.location.search, target, started: Date.now() };
    pending.current = next;
    setElapsed(0);
    setNavigation(next);
    return next.id;
  }, [clearPressed]);
  const activity = useCallback((label: string) => {
    const id = ++sequence.current;
    if (activityCount.current++ === 0) { setElapsed(0); setActivityStarted(Date.now()); }
    let closed = false;
    setActivities(previous => new Map(previous).set(id, label));
    return () => {
      if (closed) return; closed = true; activityCount.current--;
      setActivities(previous => {
        if (!previous.has(id)) return previous;
        const next = new Map(previous); next.delete(id); return next;
      });
    };
  }, []);
  const location = useCallback((url: string) => {
    currentLocation.current = url;
    if (pending.current && pending.current.from !== url) finish(pending.current.id);
  }, [finish]);
  const isCurrent = useCallback((target: string) => pending.current?.target === target, []);
  const feedback = useMemo(() => ({ begin, finish, activity, location, isCurrent }), [begin, finish, activity, location, isCurrent]);
  const busy = navigation !== null || activities.size > 0;
  useEffect(() => {
    if (!busy) return;
    const started = navigation?.started ?? activityStarted;
    const update = () => setElapsed(Date.now() - started);
    const timer = setInterval(update, 50);
    return () => clearInterval(timer);
  }, [busy, navigation, activityStarted]);
  useEffect(() => {
    // Native internal anchors and GET forms also receive feedback, without changing browser semantics.
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.dataset.navigationLink !== undefined || anchor.download || (anchor.target && anchor.target !== "_self")) return;
      const target = internalNavigationTarget(anchor.href, window.location.href);
      if (target) begin(target, anchor);
    };
    const submit = (event: SubmitEvent) => {
      const form = event.target;
      if (event.defaultPrevented || !(form instanceof HTMLFormElement) || form.method.toLowerCase() !== "get" || (form.target && form.target !== "_self")) return;
      const url = new URL(form.action, window.location.href);
      url.search = new URLSearchParams(new FormData(form, event.submitter) as unknown as Record<string, string>).toString();
      if (url.origin !== window.location.origin || !["http:", "https:"].includes(url.protocol)) return;
      const target = url.pathname + url.search;
      if (pending.current?.target === target) { event.preventDefault(); return; }
      begin(target, event.submitter);
    };
    const restore = () => { if (pending.current) finish(pending.current.id); };
    window.addEventListener("pageshow", restore);
    document.addEventListener("click", click);
    document.addEventListener("submit", submit);
    return () => {
      document.removeEventListener("click", click); document.removeEventListener("submit", submit);
      window.removeEventListener("pageshow", restore); clearPressed();
    };
  }, [begin, finish, clearPressed]);
  return <Context.Provider value={feedback}>
    <Suspense fallback={null}><LocationObserver /></Suspense>
    {children}
    <div className="navigation-feedback" data-visible={busy && elapsed >= 150} role="status" aria-live="polite" aria-atomic="true">
      {busy && elapsed >= 150 ? <>
        <span className="navigation-progress" aria-hidden="true" />
        <span>{elapsed >= 3000 ? "取得に時間がかかっています。" : navigation ? "移動中…" : `${Array.from(activities.values()).at(-1) ?? "データ"}を取得中…`}</span>
        {elapsed >= 12000 ? <span className="navigation-recovery">
          <button type="button" onClick={event => {
            event.preventDefault();
            if (navigation) window.location.assign(navigation.target); else window.location.reload();
          }}>再読み込み</button>
          <button type="button" onClick={() => window.history.back()}>戻る</button>
        </span> : null}
      </> : null}
    </div>
  </Context.Provider>;
}

/** Register actual data/fallback work separately from the URL commit. */
export function useNavigationActivity(active: boolean, label = "データ") {
  const feedback = useNavigationFeedback();
  useEffect(() => active ? feedback?.activity(label) : undefined, [feedback, active, label]);
}
