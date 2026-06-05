#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGINX_BIN="$ROOT_DIR/src/nginx-1.18.0/objs/nginx"
CONF_TEMPLATE="$ROOT_DIR/conf/nginx.conf"
CONF_FILE="$ROOT_DIR/run/nginx.conf"
PID_FILE="$ROOT_DIR/run/nginx.pid"

if [[ ! -f "$CONF_FILE" ]]; then
  mkdir -p "$ROOT_DIR/run"
  ESCAPED_ROOT_DIR="${ROOT_DIR//&/\\&}"
  sed "s#__PROJECT_ROOT__#$ESCAPED_ROOT_DIR#g" "$CONF_TEMPLATE" > "$CONF_FILE"
fi

if [[ ! -f "$PID_FILE" ]]; then
  echo "Nginx is not running."
  exit 0
fi

PID="$(tr -d '[:space:]' < "$PID_FILE")"

if [[ -z "$PID" ]] || ! kill -0 "$PID" 2>/dev/null; then
  rm -f "$PID_FILE"
  echo "Removed stale nginx pid file."
  exit 0
fi

"$NGINX_BIN" -p "$ROOT_DIR/" -c "$CONF_FILE" -s stop
echo "Nginx stopped."
