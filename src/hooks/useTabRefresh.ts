import { useEffect, useRef } from "react";

interface UseTabRefreshOptions<TTab extends string> {
  activeTab: TTab;
  refreshers: Partial<Record<TTab, () => Promise<void> | void>>;
  initialRefreshers?: Array<() => Promise<void> | void>;
  minIntervalMs?: number;
}

export function useTabRefresh<TTab extends string>({ activeTab, refreshers, initialRefreshers = [], minIntervalMs = 15000 }: UseTabRefreshOptions<TTab>) {
  const initialRanRef = useRef(false);
  const lastActiveTabRef = useRef<TTab | null>(null);
  const lastRefreshAtRef = useRef<Partial<Record<TTab, number>>>({});

  useEffect(() => {
    if (initialRanRef.current) {
      return;
    }
    initialRanRef.current = true;
    initialRefreshers.forEach((refresh) => {
      void refresh();
    });
  }, [initialRefreshers]);

  useEffect(() => {
    if (lastActiveTabRef.current === activeTab) {
      return;
    }
    lastActiveTabRef.current = activeTab;
    const refresh = refreshers[activeTab];
    if (!refresh) return;

    const now = Date.now();
    const lastAt = lastRefreshAtRef.current[activeTab] || 0;
    if (now - lastAt < minIntervalMs) {
      return;
    }

    lastRefreshAtRef.current[activeTab] = now;
    void refresh();
  }, [activeTab, minIntervalMs, refreshers]);
}
