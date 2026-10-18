/** Bounded, cancellable GETs for interactive read-only data switches. */
export async function readNavigationJson<T>(url: string, init: RequestInit = {}, timeoutMs = 10000): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) cancel();
  else init.signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
  try {
    const response = await fetch(url, { ...init, method: "GET", signal: controller.signal });
    if (!response.ok) throw new Error(`取得に失敗しました（HTTP ${response.status}）。`);
    return await response.json() as T;
  } catch (error) {
    if (controller.signal.aborted && !init.signal?.aborted) throw new Error("取得が時間内に完了しませんでした。再試行してください。");
    throw error;
  } finally {
    clearTimeout(timer); init.signal?.removeEventListener("abort", cancel);
  }
}
