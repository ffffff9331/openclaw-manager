#!/bin/zsh
set -euo pipefail

ACTION="${1:-}"
if [[ -z "$ACTION" ]]; then
  echo "missing action" >&2
  exit 2
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
QUEUE_DIR="$HOME/.openclaw/manager-runtime/gateway-control/requests"
STATE_DIR="$HOME/.openclaw/manager-runtime/gateway-control/state"
mkdir -p "$QUEUE_DIR" "$STATE_DIR"

stamp="$(date +%s)-$$"
request_file="$QUEUE_DIR/${stamp}.action"
printf '%s' "$ACTION" > "$request_file"
printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ACTION" > "$STATE_DIR/last-dispatch.txt"

uid="$(id -u)"
worker_label="ai.openclaw.gateway-control"
worker_target="gui/${uid}/${worker_label}"

if launchctl print "$worker_target" >/dev/null 2>&1; then
  launchctl kickstart -k "$worker_target" >/tmp/openclaw-manager-gateway-dispatch.log 2>&1 || true
else
  nohup "$SCRIPT_DIR/gateway_control_worker.sh" --drain >/tmp/openclaw-manager-gateway-dispatch.log 2>&1 &
fi

echo "accepted:$ACTION"
