/**
 * localStorage-based rate limiter for startup background tasks.
 * Fail-open: returns true (= due) on any storage error.
 */

export function isThrottleDue(storageKey: string, intervalMs: number): boolean {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return true;
    const last = Number(raw);
    if (!Number.isFinite(last)) return true;
    return Date.now() - last >= intervalMs;
  } catch {
    return true;
  }
}

export function markThrottleCompleted(storageKey: string): void {
  try {
    localStorage.setItem(storageKey, String(Date.now()));
  } catch {
    // ignore
  }
}
