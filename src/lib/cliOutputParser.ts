/**
 * 解析 OpenClaw CLI 输出中的 JSON
 * 自动跳过警告、装饰字符和 banner，找到第一个 '{' 开始解析
 */
export function parseOpenClawJson<T = Record<string, unknown>>(output: string): T {
  if (!output) return {} as T;
  const lines = output.split("\n");
  const jsonStart = lines.findIndex((line) => line.trim().startsWith("{"));
  if (jsonStart === -1) return {} as T;
  const jsonLines = lines.slice(jsonStart);
  const cleanOutput = jsonLines.join("\n").trim();
  try {
    return JSON.parse(cleanOutput || "{}") as T;
  } catch (error) {
    console.error("JSON parse error:", error, "raw output:", output);
    return {} as T;
  }
}

/**
 * 解析 OpenClaw CLI 输出中的布尔 running 状态
 */
export function parseGatewayRunningFromJson(raw?: string): boolean {
  if (!raw?.trim()) return false;
  try {
    const parsed = parseOpenClawJson<{ running?: boolean; service?: { runtime?: { status?: string; state?: string } } }>(raw);
    if (typeof parsed?.running === "boolean") return parsed.running;
    return parsed?.service?.runtime?.status === "running" || parsed?.service?.runtime?.state === "active";
  } catch {
    return false;
  }
}
