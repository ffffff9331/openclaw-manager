#!/bin/zsh
set -euo pipefail

QUEUE_DIR="$HOME/.openclaw/manager-runtime/gateway-control/requests"
STATE_DIR="$HOME/.openclaw/manager-runtime/gateway-control/state"
mkdir -p "$QUEUE_DIR" "$STATE_DIR"

run_action() {
  local action="$1"
  local uid label target
  uid="$(id -u)"
  label="ai.openclaw.gateway"
  target="gui/${uid}/${label}"

  case "$action" in
    start)
      zsh -lc "launchctl kickstart -k '$target' >/tmp/openclaw-manager-gateway-start.log 2>&1 || openclaw gateway start >/tmp/openclaw-manager-gateway-start.log 2>&1"
      ;;
    stop)
      zsh -lc "launchctl kill SIGTERM '$target' >/tmp/openclaw-manager-gateway-stop.log 2>&1 || openclaw gateway stop >/tmp/openclaw-manager-gateway-stop.log 2>&1"
      ;;
    restart)
      zsh -lc "openclaw gateway restart >/tmp/openclaw-manager-gateway-restart.log 2>&1"
      ;;
    *)
      echo "invalid action: $action" >&2
      return 2
      ;;
  esac
}

drain_queue() {
  local req action stamp processed=0
  for req in "$QUEUE_DIR"/*.action(.N); do
    action="$(cat "$req")"
    stamp="$(basename "$req" .action)"
    printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$action" > "$STATE_DIR/last-request.txt"
    if run_action "$action"; then
      printf '%s %s success\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$action" > "$STATE_DIR/last-result.txt"
    else
      printf '%s %s failed\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$action" > "$STATE_DIR/last-result.txt"
    fi
    rm -f "$req"
    processed=1
  done
  return $processed
}

case "${1:---drain}" in
  --drain) drain_queue ;;
  *) echo "unknown mode: $1" >&2; exit 2 ;;
esac
