import { dispatchLocalCommand } from "./commandService";

export interface LanDiscoveryCandidate {
  name: string;
  baseUrl: string;
  type: "remote" | "nas" | "docker";
  hint?: string;
}

const LAN_DISCOVERY_COMMAND = String.raw`python3 - <<'PY'
import json, re, subprocess, urllib.request, urllib.error, socket

ips = set()
try:
    out = subprocess.check_output(['arp', '-a'], text=True, stderr=subprocess.DEVNULL)
    ips.update(re.findall(r'(?:\d{1,3}\.){3}\d{1,3}', out))
except Exception:
    pass

# include likely local gateway/self candidates
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(('8.8.8.8', 80))
    local_ip = s.getsockname()[0]
    s.close()
    ips.add(local_ip)
    parts = local_ip.split('.')
    if len(parts) == 4:
        prefix = '.'.join(parts[:3])
        ips.update({f'{prefix}.1', f'{prefix}.2'})
except Exception:
    pass

candidates = []
for ip in sorted(ips):
    if ip.startswith('127.'):
        continue
    base = f'http://{ip}:18789/'
    for path in ('health', ''):
        try:
            req = urllib.request.Request(base + path)
            with urllib.request.urlopen(req, timeout=0.6) as resp:
                if resp.status < 500:
                    candidates.append({
                        'name': f'局域网实例 {ip}',
                        'baseUrl': base,
                        'type': 'remote',
                        'hint': '建议保存后再做连接验证。',
                    })
                    raise StopIteration
        except StopIteration:
            break
        except Exception:
            continue

# de-dup by baseUrl
seen = set()
result = []
for item in candidates:
    if item['baseUrl'] in seen:
        continue
    seen.add(item['baseUrl'])
    result.append(item)

print(json.dumps(result, ensure_ascii=False))
PY`;

export async function discoverLanInstances(): Promise<LanDiscoveryCandidate[]> {
  const result = await dispatchLocalCommand(LAN_DISCOVERY_COMMAND);
  if (!result.success) {
    throw new Error(result.error || result.output || "局域网扫描失败");
  }

  try {
    const parsed = JSON.parse(result.output || "[]");
    if (!Array.isArray(parsed)) {
      throw new Error("局域网扫描结果格式不正确");
    }
    return parsed.filter((item): item is LanDiscoveryCandidate => {
      return Boolean(item && typeof item.name === "string" && typeof item.baseUrl === "string" && typeof item.type === "string");
    });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "局域网扫描结果解析失败");
  }
}
