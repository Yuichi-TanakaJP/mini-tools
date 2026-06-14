// 共有 URL 生成ロジック。
// SSR とクライアント初回描画を一致させるため、ブラウザ依存値 (origin) は
// レンダー中に直接読まず、呼び出し側がマウント後に注入する。
// 仕様: docs/specs/cross-cutting/share-url-spec.md

/**
 * 共有用 URL を生成する。
 *
 * 解決順:
 * 1. 対象 (url prop があればそれ、無ければ pathname + query) が
 *    すでに絶対 URL ならそのまま返す。
 * 2. 相対なら base で絶対化する。base は
 *    `NEXT_PUBLIC_SITE_URL` → `origin`（マウント後に注入）の順。
 * 3. base が未解決（env 未設定 かつ マウント前 / SSR）の場合のみ相対のまま返す。
 *
 * origin をレンダー中に読まないことで、SSR とクライアント初回描画の出力が
 * 一致し、ハイドレーションミスマッチを防ぐ。
 */
export function resolveShareUrl(
  urlProp: string | undefined,
  pathname: string,
  searchParams: URLSearchParams | null,
  origin: string | null,
): string {
  const qs = searchParams?.toString();
  const pathWithQuery = `${pathname}${qs ? `?${qs}` : ""}`;
  const target = urlProp ?? pathWithQuery;

  // すでに絶対 URL（scheme 付き）ならそのまま使う。
  try {
    return new URL(target).href;
  } catch {
    // 相対 URL の場合は下で base を使って絶対化する。
  }

  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") || origin || "";

  try {
    return new URL(target, base).href;
  } catch {
    // base が空（env 未設定 かつ マウント前）のときだけ相対のまま返す。
    // マウント後に origin が注入されると再レンダリングで絶対 URL へ昇格する。
    return target;
  }
}
