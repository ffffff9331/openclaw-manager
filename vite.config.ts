import { exec } from "node:child_process";
import { promisify } from "node:util";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const execAsync = promisify(exec);
// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

function openclawDevBridge(): Plugin {
  return {
    name: "openclaw-dev-bridge",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();

        const runJson = async (command: string) => {
          try {
            const { stdout } = await execAsync(command, { cwd: process.cwd() });
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(stdout || "{}");
          } catch (error: any) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: error?.stderr || error?.message || "bridge failed" }));
          }
        };

        if (req.url === "/__openclaw_health") {
          return runJson("curl -s http://127.0.0.1:18789/health");
        }
        if (req.url === "/__openclaw_gateway_status") {
          return runJson("openclaw gateway status --json");
        }
        if (req.url === "/__openclaw_current_model") {
          return runJson("openclaw config get agents.defaults.model");
        }
        if (req.url === "/__openclaw_models") {
          return runJson("openclaw config get models");
        }

        return next();
      });
    },
  };
}

export default defineConfig(async () => ({
  base: "./",
  plugins: [react(), openclawDevBridge()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
