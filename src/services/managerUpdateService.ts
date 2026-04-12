import { openUrl } from "@tauri-apps/plugin-opener";
import { readLocalCommand } from "./commandService";
import { isNewerVersion } from "./versionService";

export async function checkManagerUpdates(appVersion: string) {
  const result = await readLocalCommand(
    'curl --connect-timeout 2 --max-time 4 -fsSL "https://api.github.com/repos/ffffff9331/openclaw-manager/releases/latest"',
  );

  if (!(result.success && result.output && result.output.includes("tag_name"))) {
    return { status: "检查失败", downloadUrl: "", hasUpdate: false, latestVersion: "" };
  }

  const tagMatch = result.output.match(/"tag_name"\s*:\s*"v([^"]+)"/);
  const dmgMatch = result.output.match(/"browser_download_url"\s*:\s*"([^"]*(?:dmg|zip|pkg)[^"]*)"/i);
  if (!tagMatch) {
    return { status: "检查失败", downloadUrl: "", hasUpdate: false, latestVersion: "" };
  }

  const latestVersion = tagMatch[1];
  const hasUpdate = isNewerVersion(appVersion, latestVersion);
  if (hasUpdate) {
    return {
      status: `发现新版本 v${latestVersion}`,
      downloadUrl:
        dmgMatch?.[1] || `https://github.com/ffffff9331/openclaw-manager/releases/tag/v${latestVersion}`,
      hasUpdate: true,
      latestVersion: `v${latestVersion}`,
    };
  }

  return { status: "已是最新版本", downloadUrl: "", hasUpdate: false, latestVersion: `v${latestVersion}` };
}

export async function openDownloadPage(url: string) {
  if (url) await openUrl(url);
}
