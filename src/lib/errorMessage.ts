export function getErrorMessage(error: unknown, fallback = "未知错误") {
  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error === "string") {
    return error || fallback;
  }

  if (error && typeof error === "object" && "toString" in error) {
    const value = String(error);
    return value && value !== "[object Object]" ? value : fallback;
  }

  return fallback;
}

export function formatActionError(action: string, error: unknown, fallback?: string) {
  return `${action}: ${getErrorMessage(error, fallback)}`;
}

export function formatInstanceCapabilityError(action: string, detail: string) {
  return `${action}：当前实例暂不支持。${detail}`;
}
