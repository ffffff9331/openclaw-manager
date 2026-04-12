import type { AuditLogEntry } from "../types/core";

const STORAGE_KEY = "openclaw-manager.audit-log.v1";
const MAX_ENTRIES = 200;

function safeParse(raw: string | null): AuditLogEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadAuditLogs(): AuditLogEntry[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

export function appendAuditLog(entry: Omit<AuditLogEntry, "id" | "at">): AuditLogEntry[] {
  if (typeof window === "undefined") return [];
  const nextEntry: AuditLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...entry,
  };
  const next = [nextEntry, ...loadAuditLogs()].slice(0, MAX_ENTRIES);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearAuditLogs(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
