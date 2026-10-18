"use client";

import NextLink, { useLinkStatus } from "next/link";
import { useCallback, useEffect, useRef, type ComponentProps } from "react";
import { useNavigationFeedback } from "./NavigationProvider";
import { internalNavigationTarget } from "./navigation-target";

function Hint({ token }: { token: { current: number | null } }) {
  const { pending } = useLinkStatus();
  const seen = useRef(false);
  const feedback = useNavigationFeedback();
  useEffect(() => {
    if (pending) seen.current = true;
    else if (seen.current) {
      if (token.current !== null) feedback?.finish(token.current);
      seen.current = false;
    }
  }, [pending, feedback, token]);
  return <span aria-hidden="true" className="navigation-link-hint" data-pending={pending} />;
}

export default function Link({ children, onNavigate, ref, ...props }: ComponentProps<typeof NextLink>) {
  const feedback = useNavigationFeedback();
  const token = useRef<number | null>(null);
  const element = useRef<HTMLAnchorElement | null>(null);
  const setElement = useCallback((node: HTMLAnchorElement | null) => {
    element.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }, [ref]);
  return <NextLink {...props} ref={setElement} data-navigation-link="" onNavigate={event => {
    let prevented = false;
    onNavigate?.({ preventDefault: () => { prevented = true; event.preventDefault(); } });
    if (prevented) return;
    const target = element.current ? internalNavigationTarget(element.current.href, window.location.href) : null;
    if (target && feedback?.isCurrent(target)) { event.preventDefault(); return; }
    if (target) token.current = feedback?.begin(target, element.current) ?? null;
  }}>{children}<Hint token={token} /></NextLink>;
}
